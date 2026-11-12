// -----------------------------------------------------------------------------
// Test world: the SDK's fake Gladys, the real wiring (src/app.js), and a fake
// fetch serving the real CDC answers recorded under test/fixtures/cdc/
// (12 November 2026, North Dakota, Texas and Vermont, weeks ending 17, 24 and
// 31 October). No network.
//
// `publication: 'previous'` serves the same files without the week ending
// 31 October: the data as they were the week before, to see a new week
// arrive.
// -----------------------------------------------------------------------------

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { API_BASE, HOSPITAL_DATASET, WASTEWATER_DATASET } from '../../src/cdc.js';
import { Store } from '../../src/store.js';

const FIXTURES = new URL('../fixtures/cdc/', import.meta.url);

export const NOV_12 = Date.parse('2026-11-12T12:00:00Z');
export const LATEST_WEEK = '2026-10-31';
export const FIXTURE_STATES = ['ND', 'TX', 'VT'];
const STATE_NAMES = { ND: 'North Dakota', TX: 'Texas', VT: 'Vermont' };

export function response(status, body = '', headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    text: async () => body,
  };
}

export async function fixtureText(name) {
  return readFile(new URL(name, FIXTURES), 'utf8');
}

/**
 * A fetch serving the fixtures, filtered on the states asked for; 404 for
 * anything else. `state.publication` ('latest' or 'previous') can change
 * during a test; `overrides` maps a predicate on the URL to a response, for
 * the error cases.
 */
export function fixtureFetch({
  state = { publication: 'latest' },
  overrides = [],
  calls = [],
} = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    for (const [match, answer] of overrides) {
      if (match(url)) {
        return typeof answer === 'function' ? answer(url) : answer;
      }
    }
    const match = new RegExp(`^${API_BASE}/([a-z0-9-]+)\\.json\\?(.*)$`).exec(url);
    if (!match || ![WASTEWATER_DATASET, HOSPITAL_DATASET].includes(match[1])) {
      return response(404);
    }
    const where = new URLSearchParams(match[2]).get('$where') ?? '';
    const asked = [...where.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const wastewater = match[1] === WASTEWATER_DATASET;
    const rows = JSON.parse(await fixtureText(`${match[1]}.json`)).filter((row) => {
      const week = String(wastewater ? row.week_end : row.weekendingdate).slice(0, 10);
      if (state.publication === 'previous' && week === LATEST_WEEK) {
        return false;
      }
      return asked.includes(wastewater ? row.state_territory : row.jurisdiction);
    });
    return response(200, JSON.stringify(rows), { 'content-type': 'application/json' });
  };
}

/** Name of a fixture state, as the wastewater dataset writes it. */
export const stateName = (code) => STATE_NAMES[code];

/**
 * Starts the integration against the fake Gladys.
 * @param {object} [options]
 * @param {object} [options.config] integration configuration
 * @param {string[]} [options.created] place ids whose device the user created
 * @param {Function} [options.fetch]
 * @param {object} [options.clock] { now } mutable clock
 * @param {string} [options.dataDir] reuse a /data directory (restart)
 * @param {boolean} [options.timers]
 */
export async function createWorld({
  config = { states: ['VT', 'TX'], counties: 'Chittenden, VT' },
  created = [],
  fetch = fixtureFetch(),
  clock = { now: NOV_12 },
  dataDir,
  timers = false,
} = {}) {
  const directory = dataDir ?? (await mkdtemp(join(tmpdir(), 'gladys-cdc-respiratory-')));
  const gladys = createFakeGladys({ config });
  gladys.fake.devices = created.map((id) => ({
    name: `Device ${id}`,
    external_id: gladys.externalIds('place', id).device,
    features: [],
  }));
  const app = registerHandlers(gladys, {
    store: new Store(directory),
    fetch,
    timers,
    now: () => clock.now,
  });
  await gladys.connect();
  await app.ready;
  return {
    gladys,
    fake: gladys.fake,
    app,
    monitor: app.monitor,
    clock,
    directory,
    async cleanup() {
      await app.stop();
      if (!dataDir) {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

/** Captures what the SDK logger writes (console.log / console.error) at `level`. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
