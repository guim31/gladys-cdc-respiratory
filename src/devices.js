// -----------------------------------------------------------------------------
// One Gladys device per followed place (a state, or a county of a state).
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js), for each virus of levels.js VIRUSES:
//   - <virus>_wastewater_level: risk/integer, 1 (Very low) to 5 (Very high),
//     the CDC wastewater viral activity level;
//   - <virus>_wastewater_trend: text/text, rising / stable / falling;
//   - <virus>_hospital_level: risk/integer, 1 to 5, the NHSN level of the
//     admissions of the state;
//   - <virus>_admissions: unknown/unknown, new hospital admissions per 100,000
//     residents in the week (decimal: Gladys has no unitless decimal sensor
//     nor a "per 100,000" unit, it is in the name);
// and once per device:
//   - week: text/text, the week of the data.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js). The place id ("VT", "VT-chittenden") is the platform id.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { LEVEL_MAX, LEVEL_MIN, snapshotWeeks, usesStateWastewater, VIRUSES } from './levels.js';
import { TREND_NAMES, VIRUS_NAMES, weekText } from './messages.js';
import { stateOf } from './states.js';

export const DEVICE_TYPE = 'place';
const KINDS = ['wastewater_level', 'wastewater_trend', 'hospital_level', 'admissions'];
export const FEATURE_KEYS = [
  ...VIRUSES.flatMap((virus) => KINDS.map((kind) => `${virus}_${kind}`)),
  'week',
];

// A flu peak reaches about 15 admissions per 100,000 and per week in a state
// (COVID-19 reached 40 in January 2021); the bound only frames the chart.
const MAX_ADMISSIONS = 100;

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    wastewater_level: '{virus} wastewater level',
    wastewater_trend: '{virus} wastewater trend',
    hospital_level: '{virus} hospital level',
    admissions: '{virus} admissions /100,000',
    week: 'Week of the data',
  },
  fr: {
    wastewater_level: 'Eaux usées {virus}, niveau',
    wastewater_trend: 'Eaux usées {virus}, tendance',
    hospital_level: 'Hôpital {virus}, niveau',
    admissions: 'Hospitalisations {virus} /100 000',
    week: 'Semaine des données',
  },
  de: {
    wastewater_level: 'Abwasser {virus}, Stufe',
    wastewater_trend: 'Abwasser {virus}, Tendenz',
    hospital_level: 'Klinik {virus}, Stufe',
    admissions: 'Klinikaufnahmen {virus} /100.000',
    week: 'Datenwoche',
  },
  es: {
    wastewater_level: 'Aguas residuales {virus}, nivel',
    wastewater_trend: 'Aguas residuales {virus}, tendencia',
    hospital_level: 'Hospital {virus}, nivel',
    admissions: 'Hospitalizaciones {virus} /100.000',
    week: 'Semana de los datos',
  },
};

/** Feature name in a language. */
export function featureName(key, language) {
  const names = NAMES[language] ?? NAMES.fr;
  if (key === 'week') {
    return names.week;
  }
  const virus = key.slice(0, key.indexOf('_'));
  const kind = key.slice(key.indexOf('_') + 1);
  const viruses = VIRUS_NAMES[language] ?? VIRUS_NAMES.fr;
  return names[kind].replace('{virus}', viruses[virus]);
}

/** Device name: the state's, or the county as typed and the state code. */
export function placeName(place) {
  return place.county ? `${place.county}, ${place.state}` : (stateOf(place.state)?.name ?? '');
}

/** External ids of a place device and of its features. */
export function placeIds(gladys, id) {
  const ids = gladys.externalIds(DEVICE_TYPE, String(id));
  return {
    device: ids.device,
    ...Object.fromEntries(FEATURE_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

/** The place id of a device or feature external id (null if not ours). */
export function placeIdOfExternalId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

function feature(key, ids, language) {
  const base = {
    name: featureName(key, language),
    external_id: ids[key],
    read_only: true,
    has_feedback: false,
  };
  if (key.endsWith('_level')) {
    return {
      ...base,
      category: CATEGORIES.RISK,
      type: TYPES.RISK.INTEGER,
      keep_history: true,
      min: LEVEL_MIN,
      max: LEVEL_MAX,
    };
  }
  if (key.endsWith('_admissions')) {
    return {
      ...base,
      category: CATEGORIES.UNKNOWN,
      type: TYPES.UNKNOWN.UNKNOWN,
      keep_history: true,
      min: 0,
      max: MAX_ADMISSIONS,
    };
  }
  return {
    ...base,
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    keep_history: false,
    min: 0,
    max: 0,
  };
}

/** The discovery payload of a place. */
export function buildDevice(gladys, place, language = 'fr') {
  const ids = placeIds(gladys, place.id);
  return {
    name: placeName(place),
    external_id: ids.device,
    model: 'CDC NWSS / NHSN',
    should_poll: false,
    params: [{ name: 'PLACE', value: place.id }],
    features: FEATURE_KEYS.map((key) => feature(key, ids, language)),
  };
}

/**
 * States of a place device; nothing for a value the CDC does not publish (the
 * values are not invented).
 * @param {object} snapshot see levels.js placeSnapshot
 */
export function deviceStates(gladys, place, snapshot, language) {
  const ids = placeIds(gladys, place.id);
  const trends = TREND_NAMES[language] ?? TREND_NAMES.fr;
  const states = [];
  const push = (key, state) => states.push({ device_feature_external_id: ids[key], ...state });
  for (const virus of VIRUSES) {
    const { wastewater, hospital } = snapshot[virus];
    if (wastewater) {
      push(`${virus}_wastewater_level`, { state: wastewater.level });
      if (wastewater.trend) {
        push(`${virus}_wastewater_trend`, { text: trends[wastewater.trend] });
      }
    }
    if (hospital?.level) {
      push(`${virus}_hospital_level`, { state: hospital.level });
    }
    if (hospital && hospital.rate !== null) {
      push(`${virus}_admissions`, { state: hospital.rate });
    }
  }
  const week = weekText(snapshotWeeks(snapshot), language, usesStateWastewater(snapshot, place));
  if (week) {
    push('week', { text: week });
  }
  return states;
}
