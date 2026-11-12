// -----------------------------------------------------------------------------
// The `respiratory` widget and the `get_summary` scene action, through the
// real wiring (the fake Gladys calls the registered handlers).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { GET_SUMMARY } from '../src/scenes.js';
import { WIDGET_KEY } from '../src/monitor.js';
import { createWorld } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];
const CONFIG = { states: ['VT', 'ND'], counties: 'Harris, TX', language: 'en' };

async function widget(world, request) {
  const answer = await world.fake.widgetGet(WIDGET_KEY, request);
  assert.equal(answer.success, true, JSON.stringify(answer));
  return answer.data.content;
}

async function summary(world, fields) {
  const answer = await world.fake.sceneAction(GET_SUMMARY, fields);
  if (!answer.success) {
    throw new Error(JSON.stringify(answer));
  }
  return answer.data.outputs;
}

function valid(content) {
  assert.deepEqual(validateWidgetContent(content), [], JSON.stringify(content));
  const texts = content.components.filter((c) => c.type === 'text');
  assert.ok(content.components.length <= 8 && texts.length <= 2);
}

test('a place: heading, six status lines coloured by level, week and source', async () => {
  const world = await createWorld({ created: ['TX-harris', 'VT'], config: CONFIG });
  try {
    for (const language of LANGS) {
      valid(await widget(world, { settings: {}, language }));
    }
    const content = await widget(world, { settings: {}, language: 'en' });
    // The first place followed in the configuration order: Vermont.
    assert.equal(content.components[0].text, 'Device VT');
    const harris = world.gladys.externalIds('place', 'TX-harris').device;
    const chosen = await widget(world, { settings: { place: harris }, language: 'en' });
    const [heading, status, caption] = chosen.components;
    assert.equal(heading.text, 'Device TX-harris');
    assert.deepEqual(
      status.items.map((i) => [i.label, i.value, i.color]),
      [
        ['COVID-19 · Wastewater', 'Low · rising', 'success'],
        ['Flu · Wastewater', 'Moderate · rising', 'warning'],
        ['RSV · Wastewater', 'High · rising', 'danger'],
        ['COVID-19 · Hospitals', '1.15 /100k · Very low', 'success'],
        ['Flu · Hospitals', '2.72 /100k · Low', 'success'],
        ['RSV · Hospitals', '0.34 /100k · Very low', 'success'],
      ],
    );
    assert.equal(caption.text, 'Week ending Oct 31 · CDC · not medical advice');
  } finally {
    await world.cleanup();
  }
});

test('settings: hospitals only, no caption; a state without wastewater', async () => {
  const world = await createWorld({ created: ['ND'], config: CONFIG });
  try {
    const content = await widget(world, {
      settings: { indicators: ['hospital'], show_source: false },
      language: 'fr',
    });
    valid(content);
    assert.equal(content.components.length, 2);
    assert.deepEqual(
      content.components[1].items.map((i) => i.value),
      ['0,77 /100 000 · Très bas', '1,29 /100 000 · Très bas', '0,13 /100 000 · Très bas'],
    );
    const wastewater = await widget(world, { settings: { indicators: ['wastewater'] } });
    assert.deepEqual(
      wastewater.components[1].items.map((i) => [i.value, i.color]),
      Array(3).fill(['No data', 'neutral']),
    );
  } finally {
    await world.cleanup();
  }
});

test('no place created, or a place no longer followed', async () => {
  const world = await createWorld({ config: CONFIG });
  try {
    const empty = await widget(world, { settings: {}, language: 'de' });
    valid(empty);
    assert.match(empty.components[0].text, /^Noch kein Ort/);
    const gone = await widget(world, {
      settings: { place: world.gladys.externalIds('place', 'CA').device },
      language: 'es',
    });
    assert.equal(gone.components[0].text, 'Este lugar ya no se sigue.');
  } finally {
    await world.cleanup();
  }
});

test('the scene action sums the week up in the configured language', async () => {
  const world = await createWorld({ created: ['VT', 'ND'], config: { ...CONFIG, language: 'fr' } });
  try {
    const first = await summary(world, {});
    assert.equal(
      first.summary,
      'Device VT, semaine au 31 oct. : COVID-19 : niveau bas et en hausse dans les eaux usées, ' +
        '1,7 hospitalisations pour 100 000 hab. ; Grippe : niveau bas et stable dans les eaux usées, ' +
        '1,08 hospitalisations pour 100 000 hab. ; VRS : niveau très bas et stable dans les eaux ' +
        'usées, 0 hospitalisations pour 100 000 hab.',
    );
    assert.equal(first.place_name, 'Device VT');
    assert.equal(first.covid_wastewater_level, 2);
    assert.equal(first.flu_hospital_level, 1);
    assert.equal(first.rsv_admissions, 0);
    const nd = await summary(world, { place: world.gladys.externalIds('place', 'ND').device });
    assert.equal(nd.covid_wastewater_level, undefined);
    assert.equal(nd.covid_admissions, 0.77);
    await assert.rejects(
      summary(world, { place: world.gladys.externalIds('place', 'CA').device }),
      /not followed/,
    );
  } finally {
    await world.cleanup();
  }
});
