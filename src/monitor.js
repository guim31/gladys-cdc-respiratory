// -----------------------------------------------------------------------------
// The heart of the integration: reads the CDC data every 6 hours (two
// requests: wastewater and hospitals of the followed states), publishes the
// states of the created devices, fires the scene triggers and keeps the
// connection status.
//
// The rows read, their time and a rate-limit pause survive restarts
// (src/store.js): a container that restarts in a loop asks at most every
// 10 minutes, and never during a pause.
//
// Triggers, on a week newer than the last one seen for a place, a virus and
// an indicator (never on the very first one, which only sets the reference):
//   - level_rose_to: one event per level (2 to 5) the new level reaches from
//     below;
//   - level_fell_below: one event per level it goes back under.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat
// every 12 hours (Gladys shows "no recent value" after 48 hours). Everything
// is published again in onDeviceCreated, and on a reconnection.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { CdcClient } from './cdc.js';
import { REFRESH_HOURS } from './config.js';
import { buildDevice, deviceStates, placeIdOfExternalId, placeIds, placeName } from './devices.js';
import { placeSnapshot, VIRUSES } from './levels.js';
import { INDICATOR_NAMES, LEVEL_NAMES, STATUS, VIRUS_NAMES, dateText } from './messages.js';
import { stateOf } from './states.js';

const logger = createLogger({ name: 'cdc-respiratory-monitor' });

export const WIDGET_KEY = 'respiratory';
export const TRIGGERS = {
  ROSE_TO: 'level_rose_to',
  FELL_BELOW: 'level_fell_below',
};
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);
export const THRESHOLD_LEVELS = [2, 3, 4, 5];
export const INDICATORS = ['wastewater', 'hospital'];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const HEARTBEAT_MS = 12 * HOUR;
// Not two reads closer than this, restarts included.
const MIN_READ_GAP_MS = 10 * MINUTE;
const MAX_REFERENCE_GAP_MS = 21 * DAY;
const RETRY_MS = 30 * MINUTE;
// requestWidgetRefresh is rate-limited to one call every 10 s by the core.
const WIDGET_REFRESH_GAP_MS = 10 * 1000;

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store see store.js
   * @param {Function} [options.fetch]
   * @param {boolean} [options.timers] false in tests: no interval, no delayed refresh
   * @param {Function} [options.now] clock (ms)
   */
  constructor({ gladys, store, fetch, timers = true, now }) {
    this.gladys = gladys;
    this.store = store;
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.client = new CdcClient({ fetch, now: this.now });
    this.config = { places: [], appToken: '', language: 'fr' };
    // { wastewater: rows, hospital: rows, states: codes read, readAt }
    this.data = { wastewater: [], hospital: [], states: [], readAt: 0 };
    // "<place>:<virus>:<indicator>" → { week, level }: the reference of the triggers
    this.seen = {};
    this.running = null;
    this.failing = null; // null, 'source' or 'rate'
    this.statusPublished = false;
    this.cycleTimer = null;
    this.retryTimer = null;
    this.refreshTimer = null;
    this.lastWidgetRefresh = 0;
  }

  async start(config) {
    this.setConfig(config);
    const saved = await this.store.load();
    this.client.restorePause(saved.pausedUntil, saved.strikes);
    const data = saved.data ?? {};
    if (Array.isArray(data.wastewater) && Array.isArray(data.hospital)) {
      this.data = {
        wastewater: data.wastewater,
        hospital: data.hospital,
        states: Array.isArray(data.states) ? data.states : [],
        // A time in the future (clock moved back) counts as old.
        readAt: Number.isFinite(data.readAt) && data.readAt <= this.now() ? data.readAt : 0,
      };
    }
    for (const [key, entry] of Object.entries(saved.seen ?? {})) {
      if (typeof entry?.week === 'string' && Number.isInteger(entry?.level)) {
        this.seen[key] = entry;
      }
    }
    await this.publishDiscovered();
    await this.publishStates(this.created());
    await this.runCycle();
    if (this.timers && !this.cycleTimer) {
      this.cycleTimer = setInterval(() => this.runCycle(), REFRESH_HOURS * HOUR);
      this.cycleTimer.unref?.();
    }
  }

  setConfig(config) {
    this.config = config;
    this.client.appToken = config.appToken;
  }

  /** Gladys restarted: publish the devices and every state again. */
  async resync(config) {
    this.setConfig(config);
    this.gladys.forgetPublishedStates();
    this.statusPublished = false;
    await this.publishDiscovered();
    await this.publishStates(this.created());
    await this.publishStatus();
  }

  async reconfigure(config) {
    const languageChanged = config.language !== this.config.language;
    const tokenChanged = config.appToken !== this.config.appToken;
    this.setConfig(config);
    if (languageChanged) {
      this.gladys.forgetPublishedStates();
    }
    if (tokenChanged) {
      // A new token deserves a try now, even during a pause.
      this.client.restorePause(0, 0);
      this.data.readAt = 0;
    }
    await this.publishDiscovered();
    // A cycle in progress still uses the old configuration: one more after it
    // (it reads only if a new state is followed, or the token changed).
    await this.running;
    await this.runCycle();
    this.refreshWidget();
  }

  async publishDiscovered() {
    const devices = this.config.places.map((place) =>
      buildDevice(this.gladys, place, this.config.language),
    );
    await this.gladys.publishDiscoveredDevices(devices);
  }

  /** Places whose device the user created, in configuration order. */
  created() {
    const ids = new Set(
      (this.gladys.devices ?? []).map((d) => placeIdOfExternalId(this.gladys, d.external_id)),
    );
    // A device of a place removed from the configuration is no longer read.
    return this.config.places.filter((place) => ids.has(place.id));
  }

  /** A followed place by id, or null. */
  place(id) {
    return this.config.places.find((place) => place.id === id) ?? null;
  }

  /** The name the user gave the device in Gladys, else the place's. */
  deviceName(place) {
    const { device } = placeIds(this.gladys, place.id);
    const found = (this.gladys.devices ?? []).find((d) => d.external_id === device);
    return found?.name || placeName(place);
  }

  snapshot(place) {
    return placeSnapshot(this.data, place);
  }

  /** Postal codes of the followed states (a county counts for its state). */
  neededStates() {
    return [...new Set(this.config.places.map((place) => place.state))].sort();
  }

  /** One cycle at a time: a call during a cycle waits for it. */
  runCycle() {
    if (!this.running) {
      this.running = this.cycle()
        .catch((err) => logger.error('Refresh failed', err))
        .finally(() => {
          this.running = null;
        });
    }
    return this.running;
  }

  async cycle() {
    const needed = this.neededStates();
    const covered = needed.every((code) => this.data.states.includes(code));
    const recent = this.now() - this.data.readAt < MIN_READ_GAP_MS;
    let failure = null;
    let read = false;
    if (needed.length > 0 && (!covered || !recent)) {
      try {
        await this.read(needed);
        read = true;
      } catch (err) {
        failure = err;
      }
    }
    await this.setFailure(failure);
    const fired = await this.checkTriggers();
    if (read || failure?.rateLimited || fired) {
      await this.save();
    }
    await this.publishStates(this.created());
    if (read) {
      this.refreshWidget();
    }
    if (failure) {
      this.retryAfterFailure(failure);
    }
  }

  /** Both datasets for the needed states; the old rows stay if one fails. */
  async read(needed) {
    const names = needed.map((code) => stateOf(code).name);
    const wastewater = await this.client.wastewater(names);
    const hospital = await this.client.hospital(needed);
    this.data = { wastewater, hospital, states: needed, readAt: this.now() };
    logger.debug(
      `Read ${wastewater.length} wastewater and ${hospital.length} hospital rows for ${needed.join(', ')}`,
    );
  }

  /**
   * One more cycle when the pause ends, or 30 minutes after another failure (a
   * publication day missed by a passing outage), rather than at the next refresh.
   */
  retryAfterFailure(failure) {
    if (!this.timers || this.retryTimer) {
      return;
    }
    const delay = failure.rateLimited
      ? Math.max(0, this.client.pausedUntil - this.now()) + 1000
      : RETRY_MS;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.runCycle();
    }, delay);
    this.retryTimer.unref?.();
  }

  /** Fires the triggers of the new weeks of the created places. True if a reference moved. */
  async checkTriggers() {
    let moved = false;
    for (const place of this.created()) {
      const snapshot = this.snapshot(place);
      for (const virus of VIRUSES) {
        for (const indicator of INDICATORS) {
          const entry = snapshot[virus][indicator];
          if (!entry?.level) {
            continue;
          }
          const ref = `${place.id}:${virus}:${indicator}`;
          const previous = this.seen[ref];
          if (previous && entry.week <= previous.week) {
            continue;
          }
          this.seen[ref] = { week: entry.week, level: entry.level };
          moved = true;
          // A reference more than 3 weeks old (place followed again, long
          // outage) says nothing about this week: it is only replaced.
          if (
            previous &&
            Date.parse(entry.week) - Date.parse(previous.week) <= MAX_REFERENCE_GAP_MS
          ) {
            await this.fireTriggers(place, virus, indicator, previous.level, entry);
          }
        }
      }
    }
    return moved;
  }

  async fireTriggers(place, virus, indicator, before, entry) {
    const language = this.config.language;
    const levels = LEVEL_NAMES[language];
    const common = {
      place: placeIds(this.gladys, place.id).device,
      place_name: this.deviceName(place),
      virus,
      virus_name: VIRUS_NAMES[language][virus],
      indicator,
      indicator_name: INDICATOR_NAMES[language][indicator],
      level: entry.level,
      level_name: levels[entry.level],
      previous_level_name: levels[before],
      week: dateText(entry.week, language),
    };
    const events = [];
    for (const threshold of THRESHOLD_LEVELS) {
      if (before < threshold && entry.level >= threshold) {
        events.push([TRIGGERS.ROSE_TO, { ...common, threshold: String(threshold) }]);
      }
      if (before >= threshold && entry.level < threshold) {
        events.push([TRIGGERS.FELL_BELOW, { ...common, threshold: String(threshold) }]);
      }
    }
    for (const [key, data] of events) {
      try {
        await this.gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
    }
  }

  async setFailure(err) {
    const kind = err ? (err.rateLimited ? 'rate' : 'source') : null;
    if (kind !== this.failing) {
      if (kind) {
        // One line at the first failure, one at the recovery.
        logger.warn(`Cannot read the CDC data: ${err.message}`);
      } else if (this.failing) {
        logger.info('The CDC data are readable again');
      }
      this.failing = kind;
      this.statusPublished = false;
    } else if (err) {
      logger.debug(`Still cannot read the CDC data: ${err.message}`);
    }
    await this.publishStatus();
  }

  async publishStatus() {
    if (this.statusPublished) {
      return;
    }
    const message =
      this.failing === 'rate' ? STATUS.rateLimited : this.failing ? STATUS.sourceDown : undefined;
    try {
      await this.gladys.setConnectionStatus(!this.failing, message);
      this.statusPublished = true;
    } catch (err) {
      logger.debug(`Cannot publish the connection status: ${err.message}`);
    }
  }

  async publishStates(places, { force = false } = {}) {
    const states = places.flatMap((place) =>
      deviceStates(this.gladys, place, this.snapshot(place), this.config.language),
    );
    if (states.length === 0) {
      return;
    }
    if (force) {
      for (const place of places) {
        this.gladys.forgetPublishedStates(placeIds(this.gladys, place.id).device);
      }
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    } catch (err) {
      // Sent again by the next cycle: publishChangedStates only remembers accepted values.
      logger.warn(`Cannot publish the states: ${err.message}`);
    }
  }

  /** Gladys polls a device (only if it was created with a poll frequency). */
  async poll(device) {
    const place = this.place(placeIdOfExternalId(this.gladys, device?.external_id));
    if (!place) {
      return;
    }
    if (this.now() - this.data.readAt >= (REFRESH_HOURS * HOUR) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates([place]);
    }
  }

  async onDeviceCreated(device) {
    const place = this.place(placeIdOfExternalId(this.gladys, device?.external_id));
    if (place) {
      await this.publishStates([place], { force: true });
      // The reference of the triggers: the week the device shows now.
      if (await this.checkTriggers()) {
        await this.save();
      }
    }
    this.refreshWidget();
  }

  /** A device renamed or deleted: the widget shows Gladys' names and devices. */
  onDeviceChanged() {
    this.refreshWidget();
  }

  refreshWidget() {
    const elapsed = this.now() - this.lastWidgetRefresh;
    if (elapsed >= WIDGET_REFRESH_GAP_MS || !this.timers) {
      this.lastWidgetRefresh = this.now();
      Promise.resolve(this.gladys.requestWidgetRefresh(WIDGET_KEY)).catch((err) =>
        logger.debug(`Widget refresh refused: ${err.message}`),
      );
      return;
    }
    if (!this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.refreshWidget();
      }, WIDGET_REFRESH_GAP_MS - elapsed);
      this.refreshTimer.unref?.();
    }
  }

  save() {
    return this.store.save({
      pausedUntil: this.client.pausedUntil,
      strikes: this.client.strikes,
      data: this.data,
      seen: this.seen,
    });
  }

  async stop() {
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    clearTimeout(this.retryTimer);
    this.cycleTimer = null;
    this.refreshTimer = null;
    this.retryTimer = null;
    await this.running;
    await this.store.flush();
  }
}
