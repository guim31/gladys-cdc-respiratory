// -----------------------------------------------------------------------------
// Client of the CDC open data portal (data.cdc.gov, Socrata SODA API, no
// account). Two datasets, by their stable ids:
//   - atcp-73re, "CDC Wastewater Viral Activity Level for SARS-CoV-2,
//     Influenza A and RSV" (NWSS): one row per sampling site, pathogen and
//     week, with the site's level (WVAL) and its category; updated on Fridays;
//   - vdzy-6i9v, "Weekly Hospital Respiratory Admission Levels and Rates by
//     Jurisdiction" (NHSN): one row per state and week, with the admissions
//     per 100,000 residents and their level for each virus.
//
// One request per dataset and cycle, restricted to the followed states and to
// the last four weeks (the latest week and the one before, with some slack for
// a late publication). Without an application token the portal throttles per
// IP: a 429 stops every request for an hour, doubled at each new 429 in a row
// (24 hours at most). The optional token is sent in X-App-Token, never logged.
// -----------------------------------------------------------------------------

export const API_BASE = 'https://data.cdc.gov/resource';
export const WASTEWATER_DATASET = 'atcp-73re';
export const HOSPITAL_DATASET = 'vdzy-6i9v';

const TIMEOUT_MS = 60 * 1000;
const LOOKBACK_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const MAX_PAUSE_MS = 24 * HOUR_MS;
// Far above what four weeks of the largest states return (about 2,500 rows).
const ROW_LIMIT = 50000;

const WASTEWATER_COLUMNS = [
  'state_territory',
  'counties_served',
  'site',
  'site_wval',
  'site_wval_category',
  'week_end',
  'pathogen_target',
];
export const HOSPITAL_COLUMNS = {
  covid: { rate: 'totalconfc19newadmper100k', level: 'totalconfc19newadmper100klevel' },
  flu: { rate: 'totalconfflunewadmper100k', level: 'totalconfflunewadmper100klevel' },
  rsv: { rate: 'totalconfrsvnewadmper100k', level: 'totalconfrsvnewadmper100klevel' },
};

export class SourceError extends Error {
  constructor(message, { rateLimited = false } = {}) {
    super(message);
    this.name = 'SourceError';
    this.rateLimited = rateLimited;
  }
}

/** "2026-10-15": the first week end date asked for, LOOKBACK_DAYS before now. */
export function sinceDate(now) {
  return new Date(now - LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);
}

// SoQL string literal: quotes doubled (state names never contain one).
const literal = (value) => `'${String(value).replace(/'/g, "''")}'`;

export class CdcClient {
  /**
   * @param {object} options
   * @param {Function} [options.fetch]
   * @param {Function} [options.now] clock (ms)
   */
  constructor({ fetch, now } = {}) {
    this.fetch = fetch ?? globalThis.fetch;
    this.now = now ?? (() => Date.now());
    this.appToken = '';
    this.pausedUntil = 0;
    // 429 answers in a row, without a success between them
    this.strikes = 0;
  }

  paused() {
    return this.now() < this.pausedUntil;
  }

  /** Restores a saved pause, never longer than MAX_PAUSE_MS from now. */
  restorePause(until, strikes = 0) {
    if (Number.isFinite(until)) {
      this.pausedUntil = Math.min(until, this.now() + MAX_PAUSE_MS);
    }
    this.strikes = Number.isInteger(strikes) && strikes > 0 ? strikes : 0;
  }

  async query(dataset, params) {
    if (this.paused()) {
      throw new SourceError('rate limit of data.cdc.gov: waiting before asking again', {
        rateLimited: true,
      });
    }
    const url = `${API_BASE}/${dataset}.json?${new URLSearchParams(params)}`;
    const headers = { Accept: 'application/json' };
    if (this.appToken) {
      headers['X-App-Token'] = this.appToken;
    }
    let res;
    try {
      res = await this.fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      throw new SourceError(`data.cdc.gov unreachable (${err.message})`);
    }
    if (res.status === 429) {
      this.strikes += 1;
      const pause = Math.min(HOUR_MS * 2 ** (this.strikes - 1), MAX_PAUSE_MS);
      this.pausedUntil = this.now() + pause;
      throw new SourceError('rate limit of data.cdc.gov (HTTP 429)', { rateLimited: true });
    }
    this.strikes = 0;
    if (res.status === 403 && this.appToken) {
      throw new SourceError('data.cdc.gov refused the application token (HTTP 403)');
    }
    if (res.status < 200 || res.status >= 300) {
      throw new SourceError(`data.cdc.gov answered HTTP ${res.status}`);
    }
    let body;
    try {
      body = JSON.parse(await res.text());
    } catch {
      throw new SourceError('data.cdc.gov answered something that is not JSON');
    }
    if (!Array.isArray(body)) {
      throw new SourceError('data.cdc.gov answered something that is not a list of rows');
    }
    return body;
  }

  /** Wastewater rows of the given state names, last four weeks. */
  async wastewater(stateNames) {
    const rows = await this.query(WASTEWATER_DATASET, {
      $select: WASTEWATER_COLUMNS.join(','),
      $where: `state_territory in(${stateNames.map(literal).join(',')}) AND week_end >= ${literal(sinceDate(this.now()))}`,
      $limit: String(ROW_LIMIT),
    });
    return parseWastewater(rows);
  }

  /** Hospital rows of the given postal codes, last four weeks. */
  async hospital(codes) {
    const columns = Object.values(HOSPITAL_COLUMNS).flatMap((c) => [c.rate, c.level]);
    const rows = await this.query(HOSPITAL_DATASET, {
      $select: ['jurisdiction', 'weekendingdate', ...columns].join(','),
      $where: `jurisdiction in(${codes.map(literal).join(',')}) AND weekendingdate >= ${literal(sinceDate(this.now()))}`,
      $limit: String(ROW_LIMIT),
    });
    return parseHospital(rows);
  }
}

const toNumber = (value) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};
const toDate = (value) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
};

// The `pathogen_target` values of the wastewater dataset.
export const PATHOGENS = { 'SARS-CoV-2': 'covid', 'Influenza A virus': 'flu', RSV: 'rsv' };

/**
 * Compact wastewater rows { state, counties, site, wval, category, week, virus };
 * rows of another pathogen, without a week or a value are skipped.
 */
export function parseWastewater(rows) {
  const parsed = [];
  for (const row of rows) {
    const virus = PATHOGENS[row?.pathogen_target];
    const week = toDate(row?.week_end);
    const wval = toNumber(row?.site_wval);
    if (!virus || !week || wval === null || wval < 0 || typeof row.state_territory !== 'string') {
      continue;
    }
    parsed.push({
      state: row.state_territory,
      counties: typeof row.counties_served === 'string' ? row.counties_served : '',
      site: String(row.site ?? ''),
      wval,
      category: typeof row.site_wval_category === 'string' ? row.site_wval_category : '',
      week,
      virus,
    });
  }
  return parsed;
}

/** Compact hospital rows { state, week, covid: {rate, level}, flu: ..., rsv: ... }. */
export function parseHospital(rows) {
  const parsed = [];
  for (const row of rows) {
    const week = toDate(row?.weekendingdate);
    if (!week || typeof row.jurisdiction !== 'string') {
      continue;
    }
    const entry = { state: row.jurisdiction.toUpperCase(), week };
    for (const [virus, columns] of Object.entries(HOSPITAL_COLUMNS)) {
      const rate = toNumber(row[columns.rate]);
      entry[virus] = {
        rate: rate !== null && rate >= 0 ? rate : null,
        level: typeof row[columns.level] === 'string' ? row[columns.level] : '',
      };
    }
    parsed.push(entry);
  }
  return parsed;
}
