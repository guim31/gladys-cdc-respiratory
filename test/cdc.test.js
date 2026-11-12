// -----------------------------------------------------------------------------
// The CDC rows and what a place makes of them: parsing of the recorded
// answers, the median level of the sites, the trend, the county match.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CdcClient, parseHospital, parseWastewater, sinceDate } from '../src/cdc.js';
import { countyKey, normalizeConfig, parseCounties } from '../src/config.js';
import { hospitalOf, medianLevel, rankOf, trendOf, wastewaterOf } from '../src/levels.js';
import { NOV_12, fixtureText, response } from './helpers/world.js';

const wastewater = parseWastewater(JSON.parse(await fixtureText('atcp-73re.json')));
const hospital = parseHospital(JSON.parse(await fixtureText('vdzy-6i9v.json')));

test('the recorded answers parse into compact rows', () => {
  assert.equal(wastewater.length, 360);
  assert.deepEqual(new Set(wastewater.map((r) => r.virus)), new Set(['covid', 'flu', 'rsv']));
  assert.equal(hospital.length, 9);
  const vt = hospital.find((r) => r.state === 'VT' && r.week === '2026-10-31');
  assert.deepEqual(vt.covid, { rate: 1.7, level: 'Low' });
});

test('malformed rows are skipped', () => {
  assert.deepEqual(
    parseWastewater([
      { pathogen_target: 'Mpox', site_wval: '1', week_end: '2026-10-31', state_territory: 'X' },
      { pathogen_target: 'RSV', site_wval: '', week_end: '2026-10-31', state_territory: 'X' },
      { pathogen_target: 'RSV', site_wval: '2', state_territory: 'X' },
    ]),
    [],
  );
  assert.deepEqual(parseHospital([{ jurisdiction: 'VT' }, null]), []);
});

test('levels: CDC categories to 1-5, unknown ones to null', () => {
  assert.equal(rankOf('Very Low'), 1);
  assert.equal(rankOf('Very High'), 5);
  assert.equal(rankOf('Data Unavailable'), null);
});

test('the median level of an even number of sites uses the lowest value of the upper category', () => {
  const site = (wval, category) => ({ wval, category });
  // Median 4.5, between a Moderate (4) and a High (5) site.
  const sites = [site(1, 'Low'), site(4, 'Moderate'), site(5, 'High'), site(9, 'Very High')];
  assert.deepEqual(medianLevel(sites, [...sites, site(4.4, 'High')]), { level: 4, value: 4.5 });
  assert.deepEqual(medianLevel(sites, sites), { level: 3, value: 4.5 });
  assert.deepEqual(medianLevel([site(3, 'Low'), site(3.2, 'Low')], []), { level: 2, value: 3.1 });
  assert.equal(medianLevel([site(3, '')], []), null);
});

test('trend: +20 % and +0.5 to rise, the mirror to fall', () => {
  assert.equal(trendOf(3, 3.7), 'rising');
  assert.equal(trendOf(1, 1.3), 'stable');
  assert.equal(trendOf(3.7, 3), 'falling');
  assert.equal(trendOf(null, 3), null);
});

test('a county uses the stations serving it, else its state', () => {
  const harris = wastewaterOf(wastewater, { state: 'TX', key: 'harris' }, 'rsv');
  assert.equal(harris.scope, 'county');
  assert.equal(harris.sites, 5);
  assert.equal(harris.level, 4);
  const essex = wastewaterOf(wastewater, { state: 'VT', key: 'essex' }, 'rsv');
  const vermont = wastewaterOf(wastewater, { state: 'VT', key: null }, 'rsv');
  assert.deepEqual(essex, vermont);
  assert.equal(wastewaterOf(wastewater, { state: 'ND', key: null }, 'covid'), null);
});

test('hospital: the latest week of the state', () => {
  assert.deepEqual(hospitalOf(hospital, 'TX', 'flu'), { rate: 2.72, level: 2, week: '2026-10-31' });
  assert.equal(hospitalOf(hospital, 'CA', 'flu'), null);
});

test('the counties typed by the user', () => {
  assert.equal(countyKey('St. Louis County'), 'st louis');
  assert.deepEqual(
    parseCounties('Harris County, TX;  orleans parish , la\nNowhere, ZZ; no state; Harris, tx').map(
      (p) => p.id,
    ),
    ['TX-harris', 'LA-orleans'],
  );
  const config = normalizeConfig({ states: 'vt, TX, VT', counties: 'Harris, TX', language: 'xx' });
  assert.deepEqual(
    config.places.map((p) => p.id),
    ['VT', 'TX', 'TX-harris'],
  );
  assert.equal(config.language, 'fr');
});

test('the client: four weeks back, errors and the 429 pause', async () => {
  assert.equal(sinceDate(NOV_12), '2026-10-15');
  let answer = response(500);
  const client = new CdcClient({ fetch: async () => answer, now: () => NOV_12 });
  await assert.rejects(client.hospital(['VT']), /HTTP 500/);
  answer = response(200, '{"error":true}');
  await assert.rejects(client.hospital(['VT']), /not a list/);
  answer = response(200, 'oops');
  await assert.rejects(client.hospital(['VT']), /not JSON/);
  client.appToken = 'secret';
  answer = response(403);
  await assert.rejects(client.hospital(['VT']), (err) => !err.message.includes('secret'));
  answer = response(429);
  await assert.rejects(client.hospital(['VT']), (err) => err.rateLimited);
  assert.equal(client.pausedUntil, NOV_12 + 3600 * 1000);
  await assert.rejects(client.hospital(['VT']), /waiting/);
});

test('a week the CDC has only begun to fill is not the latest yet', () => {
  const row = (site, week, wval, category) => ({
    state: 'Vermont',
    counties: 'Chittenden',
    site,
    wval,
    category,
    week,
    virus: 'flu',
  });
  const before = ['a', 'b', 'c'].map((site) => row(site, '2026-10-24', 1, 'Very Low'));
  const partial = [...before, row('c', '2026-10-31', 9, 'Very High')];
  const result = wastewaterOf(partial, { state: 'VT', key: null }, 'flu');
  assert.equal(result.week, '2026-10-24');
  assert.equal(result.level, 1);
  const filled = [...partial, row('a', '2026-10-31', 2, 'Low')];
  assert.equal(wastewaterOf(filled, { state: 'VT', key: null }, 'flu').week, '2026-10-31');
  // A latest week without any level does not hide the one before.
  const unavailable = [...before, row('a', '2026-10-31', 0, 'Data Unavailable')];
  assert.equal(wastewaterOf(unavailable, { state: 'VT', key: null }, 'flu').week, '2026-10-24');
});
