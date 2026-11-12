// -----------------------------------------------------------------------------
// Scene action (manifest `scene_actions`, Gladys 5.1+): `get_summary`.
//
// Returns the week of a place in one sentence, ready for a notification, and
// its figures for the following actions of the scene. A scene action does not
// receive the user's language: the sentence is in the configured `language`.
// -----------------------------------------------------------------------------

import { placeIdOfExternalId } from './devices.js';
import { snapshotWeeks, VIRUSES } from './levels.js';
import { LEVEL_NAMES, SUMMARY, TREND_NAMES, VIRUS_NAMES, dateText, fill } from './messages.js';

export const GET_SUMMARY = 'get_summary';

/** The sentence of a place's snapshot (see levels.js placeSnapshot). */
export function summaryText(placeLabel, snapshot, language) {
  const texts = SUMMARY[language] ?? SUMMARY.fr;
  const weeks = snapshotWeeks(snapshot);
  const week = weeks.wastewater ?? weeks.hospital;
  if (!week) {
    return fill(texts.none, { place: placeLabel });
  }
  const list = [];
  for (const virus of VIRUSES) {
    const { wastewater, hospital } = snapshot[virus];
    const parts = [];
    if (wastewater) {
      const level = LEVEL_NAMES[language][wastewater.level].toLocaleLowerCase(language);
      parts.push(
        wastewater.trend
          ? fill(texts.wastewaterTrend, { level, trend: TREND_NAMES[language][wastewater.trend] })
          : fill(texts.wastewater, { level }),
      );
    }
    if (hospital && hospital.rate !== null) {
      parts.push(fill(texts.rate, { rate: hospital.rate.toLocaleString(language) }));
    }
    if (parts.length > 0) {
      list.push(fill(texts.item, { virus: VIRUS_NAMES[language][virus], parts: parts.join(', ') }));
    }
  }
  return fill(texts.intro, {
    place: placeLabel,
    date: dateText(week, language),
    // "hab." ends a French or Spanish list: no double full stop.
    list: list.join(texts.separator).replace(/\.$/, ''),
  });
}

export const SCENE_ACTIONS = {
  /**
   * @param {object} monitor
   * @param {object} fields { place?: device external id }
   */
  async [GET_SUMMARY](monitor, fields = {}) {
    const language = monitor.config.language;
    let place = monitor.created()[0] ?? null;
    if (typeof fields.place === 'string' && fields.place) {
      place = monitor.place(placeIdOfExternalId(monitor.gladys, fields.place));
      if (!place) {
        throw new Error('This place is not followed by the integration');
      }
    }
    if (!place) {
      throw new Error('No place followed yet: create a device in the Discover tab');
    }
    const snapshot = monitor.snapshot(place);
    const name = monitor.deviceName(place);
    const outputs = { summary: summaryText(name, snapshot, language), place_name: name };
    for (const virus of VIRUSES) {
      const { wastewater, hospital } = snapshot[virus];
      if (wastewater) {
        outputs[`${virus}_wastewater_level`] = wastewater.level;
      }
      if (hospital?.level) {
        outputs[`${virus}_hospital_level`] = hospital.level;
      }
      if (hospital && hospital.rate !== null) {
        outputs[`${virus}_admissions`] = hospital.rate;
      }
    }
    return outputs;
  },
};
