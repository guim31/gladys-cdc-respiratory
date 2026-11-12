// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// A place is what a device follows: a state ("VT"), or a county of a state
// typed by the user ("Chittenden, VT" → id "VT-chittenden"). The id is the
// platform id of the device: it never changes for the same typed county.
// -----------------------------------------------------------------------------

import { stateOf } from './states.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The CDC publishes once a week (Friday for the wastewater, Wednesday to
// Friday for the hospitals); four reads a day see a new week within 6 hours
// and stay two requests each, far from the anonymous limits of the API.
export const REFRESH_HOURS = 6;

// Ten counties keep the device list and the wastewater query small.
export const MAX_COUNTIES = 10;

export const DEFAULT_CONFIG = {
  states: [],
  counties: '',
  language: 'fr',
};

// Words the CDC leaves out of `counties_served` ("Chittenden", not
// "Chittenden County"), removed before matching.
const COUNTY_SUFFIX = /\s+(county|parish|borough|census area|municipality|city and borough)$/i;

/** The matching key of a county name: "St. Louis County" → "st louis". */
export function countyKey(name) {
  return String(name ?? '')
    .trim()
    .replace(COUNTY_SUFFIX, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Counties typed by the user: "Chittenden, VT; Harris County, TX", one per
 * line or separated by semicolons. An entry without a known state code is
 * ignored.
 * @returns {{id: string, state: string, county: string, key: string}[]}
 */
export function parseCounties(value) {
  const entries = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[;\n]+/);
  const places = [];
  for (const entry of entries) {
    const match = /^(.+),\s*([A-Za-z]{2})\s*$/.exec(entry.trim());
    const state = match ? stateOf(match[2]) : null;
    const county = match ? match[1].trim().replace(/\s+/g, ' ') : '';
    const key = countyKey(county);
    if (!state || !key) {
      continue;
    }
    const id = `${state.code}-${key.replace(/ /g, '-')}`;
    if (!places.some((place) => place.id === id)) {
      places.push({ id, state: state.code, county, key });
    }
  }
  return places.slice(0, MAX_COUNTIES);
}

/**
 * @param {object} raw configuration from Gladys
 * @returns {{places: object[], appToken: string, language: string}}
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  let values = config.states;
  if (typeof values === 'string') {
    // A value typed by hand: "VT, TX".
    values = values.split(/[\s,;]+/);
  }
  const places = [];
  for (const value of Array.isArray(values) ? values : []) {
    const state = stateOf(value);
    if (state && !places.some((place) => place.id === state.code)) {
      places.push({ id: state.code, state: state.code, county: null, key: null });
    }
  }
  places.push(...parseCounties(config.counties));
  const appToken = typeof config.app_token === 'string' ? config.app_token.trim() : '';
  const language = LANGUAGES.includes(config.language) ? config.language : DEFAULT_CONFIG.language;
  return { places, appToken, language };
}
