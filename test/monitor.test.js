// -----------------------------------------------------------------------------
// The monitor against the fake Gladys and the recorded CDC answers:
// discovery, states, requests kept to the minimum, triggers on a new week,
// rate limit, restarts, and the container's own timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { placeIds } from '../src/devices.js';
import { STATUS } from '../src/messages.js';
import { HEARTBEAT_MS, TRIGGERS } from '../src/monitor.js';
import { NOV_12, createWorld, fixtureFetch, response } from './helpers/world.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const CYCLE = 6 * HOUR;

test('discovers one device per state and county, without poll frequency', async () => {
  const world = await createWorld({
    config: { states: ['TX', 'VT', 'XX'], counties: 'Harris County, TX; Nowhere, ZZ' },
  });
  try {
    const devices = world.fake.discoveredDevices;
    assert.deepEqual(
      devices.map((d) => d.name),
      ['Texas', 'Vermont', 'Harris County, TX'],
    );
    assert.equal(devices[0].should_poll, false);
    assert.equal(devices[0].poll_frequency, undefined);
    assert.equal(devices[2].external_id, world.gladys.externalIds('place', 'TX-harris').device);
    assert.equal(world.fake.connectionStatus.connected, true);
  } finally {
    await world.cleanup();
  }
});

test('publishes the levels, trend, admissions and week of a created county', async () => {
  const world = await createWorld({
    created: ['TX-harris'],
    config: { counties: 'Harris, TX', language: 'en' },
  });
  try {
    const ids = placeIds(world.gladys, 'TX-harris');
    const last = (key) => world.fake.lastState(ids[key]);
    assert.equal(last('rsv_wastewater_level'), 4);
    assert.equal(last('rsv_wastewater_trend'), 'rising');
    assert.equal(last('flu_wastewater_level'), 3);
    assert.equal(last('covid_wastewater_level'), 2);
    // Hospitals: the state's (no county data at the NHSN).
    assert.equal(last('flu_hospital_level'), 2);
    assert.equal(last('flu_admissions'), 2.72);
    assert.equal(last('rsv_admissions'), 0.34);
    assert.equal(last('week'), 'Week ending Oct 31');
  } finally {
    await world.cleanup();
  }
});

test('a county without a station shows the state wastewater, and says so', async () => {
  const world = await createWorld({
    created: ['VT-essex', 'VT'],
    config: { states: ['VT'], counties: 'Essex, VT' },
  });
  try {
    const county = placeIds(world.gladys, 'VT-essex');
    const state = placeIds(world.gladys, 'VT');
    for (const key of ['covid_wastewater_level', 'flu_wastewater_level', 'rsv_wastewater_level']) {
      assert.equal(world.fake.lastState(county[key]), world.fake.lastState(state[key]), key);
    }
    assert.equal(world.fake.lastState(county.week), "Semaine au 31 oct. · eaux usées de l'État");
    assert.equal(world.fake.lastState(state.week), 'Semaine au 31 oct.');
  } finally {
    await world.cleanup();
  }
});

test('a state without wastewater data publishes its hospitals only', async () => {
  const world = await createWorld({ created: ['ND'], config: { states: ['ND'] } });
  try {
    const ids = placeIds(world.gladys, 'ND');
    assert.equal(world.fake.lastState(ids.covid_wastewater_level), undefined);
    assert.equal(world.fake.lastState(ids.covid_wastewater_trend), undefined);
    assert.equal(world.fake.lastState(ids.covid_admissions), 0.77);
    assert.equal(world.fake.lastState(ids.covid_hospital_level), 1);
  } finally {
    await world.cleanup();
  }
});

test('empty answers (off season, nothing published): no state, no error', async () => {
  const fetch = fixtureFetch({ overrides: [[() => true, () => response(200, '[]')]] });
  const world = await createWorld({ created: ['VT'], config: { states: ['VT'] }, fetch });
  try {
    assert.equal(world.fake.connectionStatus.connected, true);
    const ids = placeIds(world.gladys, 'VT');
    assert.deepEqual(
      world.fake.states.filter((s) => s.device_feature_external_id.startsWith(ids.device)),
      [],
    );
  } finally {
    await world.cleanup();
  }
});

test('two requests per cycle, the followed states only, nothing within 10 minutes', async () => {
  const calls = [];
  const world = await createWorld({
    created: ['VT'],
    config: { states: ['VT'], counties: 'Harris, TX' },
    fetch: fixtureFetch({ calls }),
  });
  try {
    assert.equal(calls.length, 2);
    const where = new URL(calls[0].url).searchParams.get('$where');
    assert.equal(where, "state_territory in('Texas','Vermont') AND week_end >= '2026-10-15'");
    assert.match(new URL(calls[1].url).searchParams.get('$where'), /jurisdiction in\('TX','VT'\)/);
    assert.equal(calls[0].options.headers['X-App-Token'], undefined);
    world.clock.now += 5 * MINUTE;
    await world.monitor.runCycle();
    assert.equal(calls.length, 2);
    world.clock.now += CYCLE;
    await world.monitor.runCycle();
    assert.equal(calls.length, 4);
  } finally {
    await world.cleanup();
  }
});

test('nothing configured: no request at all', async () => {
  const calls = [];
  const world = await createWorld({ config: {}, fetch: fixtureFetch({ calls }) });
  try {
    assert.equal(calls.length, 0);
    assert.deepEqual(world.fake.discoveredDevices, []);
  } finally {
    await world.cleanup();
  }
});

test('the application token is sent in its header, and a new token is tried at once', async () => {
  const calls = [];
  const world = await createWorld({
    created: ['VT'],
    config: { states: ['VT'] },
    fetch: fixtureFetch({ calls }),
  });
  try {
    world.clock.now += MINUTE;
    await world.monitor.reconfigure(normalizeConfig({ states: ['VT'], app_token: ' abc ' }));
    assert.equal(calls.length, 4);
    assert.equal(calls[2].options.headers['X-App-Token'], 'abc');
  } finally {
    await world.cleanup();
  }
});

async function worldSeeingANewWeek() {
  const state = { publication: 'previous' };
  const world = await createWorld({
    created: ['TX', 'TX-harris'],
    config: { states: ['TX'], counties: 'Harris, TX', language: 'en' },
    fetch: fixtureFetch({ state }),
  });
  assert.deepEqual(world.fake.sceneEvents, [], 'the first week only sets the reference');
  state.publication = 'latest';
  world.clock.now += CYCLE;
  await world.monitor.runCycle();
  return world;
}

test('a new week fires one event per level crossed', async () => {
  const world = await worldSeeingANewWeek();
  try {
    const events = world.fake.sceneEvents.map((e) => [
      e.key,
      e.data.place_name,
      e.data.virus,
      e.data.indicator,
      e.data.threshold,
    ]);
    assert.deepEqual(events, [
      [TRIGGERS.FELL_BELOW, 'Device TX', 'covid', 'wastewater', '3'],
      [TRIGGERS.FELL_BELOW, 'Device TX', 'rsv', 'wastewater', '2'],
      [TRIGGERS.ROSE_TO, 'Device TX-harris', 'flu', 'wastewater', '3'],
      [TRIGGERS.ROSE_TO, 'Device TX-harris', 'rsv', 'wastewater', '3'],
      [TRIGGERS.ROSE_TO, 'Device TX-harris', 'rsv', 'wastewater', '4'],
    ]);
    const last = world.fake.sceneEvents.at(-1).data;
    assert.equal(last.place, world.gladys.externalIds('place', 'TX-harris').device);
    assert.equal(last.level, 4);
    assert.equal(last.level_name, 'High');
    assert.equal(last.previous_level_name, 'Low');
    assert.equal(last.virus_name, 'RSV');
    assert.equal(last.indicator_name, 'Wastewater');
    assert.equal(last.week, 'Oct 31');
    // The same week again: nothing more.
    world.clock.now += CYCLE;
    await world.monitor.runCycle();
    assert.equal(world.fake.sceneEvents.length, 5);
  } finally {
    await world.cleanup();
  }
});

test('the reference survives a restart: no event fired twice', async () => {
  const first = await worldSeeingANewWeek();
  await first.app.stop();
  const restarted = await createWorld({
    created: ['TX', 'TX-harris'],
    config: { states: ['TX'], counties: 'Harris, TX' },
    dataDir: first.directory,
    clock: { now: first.clock.now + CYCLE },
  });
  try {
    assert.deepEqual(restarted.fake.sceneEvents, []);
  } finally {
    await restarted.cleanup();
    await first.cleanup();
  }
});

test('a restart reads the data from /data, and asks nothing within 10 minutes', async () => {
  const first = await createWorld({ created: ['VT'], config: { states: ['VT'] } });
  await first.app.stop();
  const calls = [];
  const restarted = await createWorld({
    created: ['VT'],
    config: { states: ['VT'] },
    fetch: fixtureFetch({ calls }),
    dataDir: first.directory,
    clock: { now: first.clock.now + 2 * MINUTE },
  });
  try {
    assert.equal(calls.length, 0);
    assert.equal(restarted.fake.lastState(placeIds(restarted.gladys, 'VT').flu_admissions), 1.08);
  } finally {
    await restarted.cleanup();
    await first.cleanup();
  }
});

test('a newly followed state is read at once, even within 10 minutes', async () => {
  const calls = [];
  const world = await createWorld({
    config: { states: ['VT'] },
    fetch: fixtureFetch({ calls }),
  });
  try {
    world.clock.now += MINUTE;
    await world.monitor.reconfigure({
      places: [{ id: 'TX', state: 'TX', county: null, key: null }],
      appToken: '',
      language: 'fr',
    });
    assert.equal(calls.length, 4);
  } finally {
    await world.cleanup();
  }
});

test('a 429 pauses the requests, says so, and the pause survives a restart', async () => {
  const calls = [];
  let limited = true;
  const fetch = fixtureFetch({ calls, overrides: [[() => limited, () => response(429)]] });
  const world = await createWorld({ created: ['VT'], config: { states: ['VT'] }, fetch });
  assert.equal(calls.length, 1);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.deepEqual(world.fake.connectionStatus.message, STATUS.rateLimited);
  await world.app.stop();

  const restarted = await createWorld({
    created: ['VT'],
    config: { states: ['VT'] },
    fetch,
    dataDir: world.directory,
    clock: { now: world.clock.now + 30 * MINUTE },
  });
  try {
    assert.equal(calls.length, 1, 'nothing asked during the pause, even after a restart');
    limited = false;
    restarted.clock.now += 31 * MINUTE;
    await restarted.monitor.runCycle();
    assert.equal(calls.length, 3);
    assert.equal(restarted.fake.connectionStatus.connected, true);
  } finally {
    await restarted.cleanup();
    await world.cleanup();
  }
});

test('the source down: status with the four languages, values kept', async () => {
  let down = false;
  const fetch = fixtureFetch({ overrides: [[() => down, () => response(502)]] });
  const world = await createWorld({ created: ['VT'], config: { states: ['VT'] }, fetch });
  try {
    down = true;
    world.clock.now += CYCLE;
    await world.monitor.runCycle();
    assert.equal(world.fake.connectionStatus.connected, false);
    assert.deepEqual(world.fake.connectionStatus.message, STATUS.sourceDown);
    assert.equal(world.fake.lastState(placeIds(world.gladys, 'VT').covid_admissions), 1.7);
    down = false;
    world.clock.now += CYCLE;
    await world.monitor.runCycle();
    assert.equal(world.fake.connectionStatus.connected, true);
  } finally {
    await world.cleanup();
  }
});

test('onDeviceCreated publishes everything again and refreshes the widget', async () => {
  const world = await createWorld({ config: { states: ['VT'] } });
  try {
    const device = { external_id: world.gladys.externalIds('place', 'VT').device, name: 'Ici' };
    world.fake.devices = [device];
    const before = world.fake.widgetRefreshes.length;
    await world.monitor.onDeviceCreated(device);
    assert.equal(world.fake.lastState(placeIds(world.gladys, 'VT').covid_wastewater_level), 2);
    assert.ok(world.fake.widgetRefreshes.length > before);
  } finally {
    await world.cleanup();
  }
});

test('the heartbeat republishes an unchanged value after 12 hours', async (t) => {
  // The SDK dates the published states with Date.now().
  t.mock.timers.enable({ apis: ['Date'], now: NOV_12 });
  const world = await createWorld({ created: ['VT'], config: { states: ['VT'] } });
  try {
    const id = placeIds(world.gladys, 'VT').covid_admissions;
    const count = () => world.fake.states.filter((s) => s.device_feature_external_id === id).length;
    const initial = count();
    world.clock.now += HOUR;
    await world.monitor.runCycle();
    assert.equal(count(), initial);
    world.clock.now += HEARTBEAT_MS;
    t.mock.timers.tick(HOUR + HEARTBEAT_MS);
    await world.monitor.runCycle();
    assert.equal(count(), initial + 1);
  } finally {
    await world.cleanup();
  }
});

test("the container's own timer refreshes every 6 hours, without onPoll", async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const calls = [];
  const world = await createWorld({
    created: ['VT'],
    config: { states: ['VT'] },
    fetch: fixtureFetch({ calls }),
    timers: true,
  });
  try {
    assert.equal(calls.length, 2);
    world.clock.now += CYCLE;
    t.mock.timers.tick(CYCLE);
    await world.monitor.running;
    assert.equal(calls.length, 4);
  } finally {
    await world.cleanup();
  }
});

test('a reference older than 3 weeks is replaced without firing', async () => {
  const state = { publication: 'previous' };
  const world = await createWorld({
    created: ['TX-harris'],
    config: { counties: 'Harris, TX' },
    fetch: fixtureFetch({ state }),
  });
  try {
    for (const entry of Object.values(world.monitor.seen)) {
      entry.week = '2026-09-26';
    }
    state.publication = 'latest';
    world.clock.now += CYCLE;
    await world.monitor.runCycle();
    assert.deepEqual(world.fake.sceneEvents, []);
    assert.ok(Object.values(world.monitor.seen).every((e) => e.week === '2026-10-31'));
  } finally {
    await world.cleanup();
  }
});

test('after a failure other than a 429, one more try 30 minutes later', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const calls = [];
  let down = true;
  const fetch = fixtureFetch({ calls, overrides: [[() => down, () => response(503)]] });
  const world = await createWorld({
    created: ['VT'],
    config: { states: ['VT'] },
    fetch,
    timers: true,
  });
  try {
    assert.equal(calls.length, 1);
    assert.equal(world.fake.connectionStatus.connected, false);
    down = false;
    world.clock.now += 30 * MINUTE;
    t.mock.timers.tick(30 * MINUTE);
    await world.monitor.running;
    assert.equal(calls.length, 3);
    assert.equal(world.fake.connectionStatus.connected, true);
  } finally {
    await world.cleanup();
  }
});
