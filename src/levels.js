// -----------------------------------------------------------------------------
// From the CDC rows to what a place shows, for each virus:
//   - wastewater: level 1 to 5, median WVAL, trend, week, number of sites,
//     and whether a county fell back on its whole state;
//   - hospital: admissions per 100,000 residents and their level 1 to 5, week.
//
// The wastewater dataset only has site levels. Like the CDC map, the level of
// a state (or county) is the median of the levels of its sites reporting that
// week. With an odd number of sites the middle site gives the category. With
// an even number the median falls between two sites; if their categories
// differ, the median gets the upper one only when it is at least the lowest
// WVAL read anywhere in that upper category that week (so certainly above the
// CDC threshold), else the lower one.
//
// The latest week of a place is the newest one where at least half of the
// sites of the week before reported (a week the CDC has only begun to fill is
// skipped until it fills up).
//
// Trend: median WVAL of the latest week against the week before, "rising"
// from +20 % (and at least +0.5), "falling" from -1/6 (and at least -0.5),
// else "stable". Computed by the integration, not published by the CDC.
// -----------------------------------------------------------------------------

import { countyKey } from './config.js';
import { stateOf } from './states.js';

export const VIRUSES = ['covid', 'flu', 'rsv'];
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;

const RANKS = {
  minimal: 1,
  'very low': 1,
  low: 2,
  moderate: 3,
  high: 4,
  'very high': 5,
};

/** 1 (Very Low) to 5 (Very High), or null ("Data Unavailable", "No Data"...). */
export function rankOf(category) {
  return (
    RANKS[
      String(category ?? '')
        .trim()
        .toLowerCase()
    ] ?? null
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const previousWeek = (week) => new Date(Date.parse(week) - WEEK_MS).toISOString().slice(0, 10);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round2 = (value) => Math.round(value * 100) / 100;

export function trendOf(previous, current) {
  if (previous === null || current === null) {
    return null;
  }
  if (current >= previous * 1.2 && current - previous >= 0.5) {
    return 'rising';
  }
  if (current <= previous / 1.2 && previous - current >= 0.5) {
    return 'falling';
  }
  return 'stable';
}

/** The sites of a county: one of the names of `counties_served` matches. */
function servesCounty(row, key) {
  return String(row.counties ?? '')
    .split(',')
    .some((name) => countyKey(name) === key);
}

/**
 * Level and median of a set of site rows of one week. `all` is every row of
 * the state for that virus and week, for the boundary: the level of a place
 * never depends on the other places followed.
 */
export function medianLevel(sites, all) {
  const ranked = sites
    .map((row) => ({ wval: row.wval, rank: rankOf(row.category) }))
    .filter((site) => site.rank !== null)
    .sort((a, b) => a.wval - b.wval);
  if (ranked.length === 0) {
    return null;
  }
  const value = median(ranked.map((site) => site.wval));
  const middle = Math.floor(ranked.length / 2);
  if (ranked.length % 2) {
    return { level: ranked[middle].rank, value };
  }
  const lower = ranked[middle - 1].rank;
  const upper = ranked[middle].rank;
  if (lower === upper) {
    return { level: lower, value };
  }
  const boundary = Math.min(
    ...all.filter((row) => (rankOf(row.category) ?? 0) >= upper).map((row) => row.wval),
  );
  return { level: value >= boundary ? upper : lower, value };
}

/**
 * Wastewater of a place for a virus, or null without any site in its state.
 * @param {object[]} rows see cdc.js parseWastewater
 * @param {{state: string, key: string|null}} place
 */
export function wastewaterOf(rows, place, virus) {
  const state = stateOf(place.state);
  const ofState = rows.filter((row) => row.virus === virus && row.state === state?.name);
  let selected = ofState;
  let scope = place.key ? 'county' : 'state';
  if (place.key) {
    selected = ofState.filter((row) => servesCounty(row, place.key));
    if (selected.length === 0) {
      // No station serves the county: the state's level, said in the week text.
      selected = ofState;
      scope = 'state';
    }
  }
  if (selected.length === 0) {
    return null;
  }
  // Sites with a level, per week.
  const ranked = new Map();
  for (const row of selected) {
    if (rankOf(row.category) !== null) {
      ranked.set(row.week, (ranked.get(row.week) ?? new Set()).add(row.site));
    }
  }
  // The latest week counts once at least half of the sites of the week before
  // reported it: a week of which the CDC has published one site out of five
  // says little (and would fire triggers that the other sites contradict).
  const weeks = [...ranked.keys()].sort().reverse();
  const week = weeks.find(
    (w) => ranked.get(w).size * 2 >= (ranked.get(previousWeek(w))?.size ?? 0),
  );
  if (!week) {
    return null;
  }
  const before = previousWeek(week);
  const ofWeek = (w) => ofState.filter((row) => row.week === w);
  const current = medianLevel(
    selected.filter((row) => row.week === week),
    ofWeek(week),
  );
  const previous = medianLevel(
    selected.filter((row) => row.week === before),
    ofWeek(before),
  );
  return {
    level: current.level,
    value: round2(current.value),
    trend: trendOf(previous?.value ?? null, current.value),
    week,
    sites: ranked.get(week).size,
    scope,
  };
}

/** Hospital admissions of a state for a virus (latest week with a value), or null. */
export function hospitalOf(rows, code, virus) {
  let found = null;
  for (const row of rows) {
    if (row.state !== code) {
      continue;
    }
    const entry = row[virus];
    const level = rankOf(entry?.level);
    if (entry?.rate === null && level === null) {
      continue;
    }
    if (!found || row.week > found.week) {
      found = { rate: entry.rate === null ? null : round2(entry.rate), level, week: row.week };
    }
  }
  return found;
}

/** Everything a place shows: { covid: { wastewater, hospital }, ... }. */
export function placeSnapshot(data, place) {
  const snapshot = {};
  for (const virus of VIRUSES) {
    snapshot[virus] = {
      wastewater: wastewaterOf(data.wastewater ?? [], place, virus),
      hospital: hospitalOf(data.hospital ?? [], place.state, virus),
    };
  }
  return snapshot;
}

/** Latest week of each source in a snapshot ("2026-10-31"), null if none. */
export function snapshotWeeks(snapshot) {
  const latest = (source) =>
    VIRUSES.map((virus) => snapshot[virus][source]?.week ?? '').reduce(
      (a, b) => (b > a ? b : a),
      '',
    ) || null;
  return { wastewater: latest('wastewater'), hospital: latest('hospital') };
}

/** True if the county of the snapshot has no station of its own (state levels). */
export function usesStateWastewater(snapshot, place) {
  return Boolean(place.key) && VIRUSES.some((v) => snapshot[v].wastewater?.scope === 'state');
}
