// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `respiratory`.
//
// One place (the one chosen, else the first followed): a heading with its
// name (the one given in Gladys), one status list with, for each virus, the
// wastewater level and trend and the hospital admissions and level, coloured
// by level, and a caption with the week and the source. A setting hides an
// indicator, another the caption. Budget: 2 texts, 1 status (6 lines at most).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { placeIdOfExternalId } from './devices.js';
import { snapshotWeeks, usesStateWastewater, VIRUSES } from './levels.js';
import { INDICATOR_NAMES, LEVEL_NAMES, TREND_NAMES, VIRUS_NAMES, weekText } from './messages.js';
import { INDICATORS, WIDGET_KEY } from './monitor.js';

export const TTL_SECONDS = 1800;
const MAX_STATUS_TEXT = 40;

export const TEXT = {
  empty: {
    en: 'No place yet: choose your states or counties in the configuration of the integration, then create the devices in the Discover tab.',
    fr: "Aucun lieu pour l'instant : choisissez vos États ou comtés dans la configuration de l'intégration, puis créez les appareils dans l'onglet Découverte.",
    de: 'Noch kein Ort: Wähle deine Bundesstaaten oder Countys in der Konfiguration der Integration aus und lege dann die Geräte im Tab „Entdecken“ an.',
    es: 'Aún no hay lugares: elija sus estados o condados en la configuración de la integración y, después, cree los dispositivos en la pestaña Descubrir.',
  },
  gone: {
    en: 'This place is no longer followed.',
    fr: "Ce lieu n'est plus suivi.",
    de: 'Dieser Ort wird nicht mehr verfolgt.',
    es: 'Este lugar ya no se sigue.',
  },
  noData: {
    en: 'No data',
    fr: 'Pas de données',
    de: 'Keine Daten',
    es: 'Sin datos',
  },
  perHundredThousand: {
    en: '/100k',
    fr: '/100 000',
    de: '/100.000',
    es: '/100.000',
  },
  source: {
    en: 'CDC · not medical advice',
    fr: 'CDC · pas un avis médical',
    de: 'CDC · keine ärztliche Beratung',
    es: 'CDC · no es consejo médico',
  },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/** Colour of a level 1 to 5: green up to Low, orange Moderate, red from High. */
export function levelColor(level) {
  if (!level) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (level >= 4) {
    return WIDGET_COLORS.DANGER;
  }
  return level === 3 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;
}

const TREND_ICONS = { rising: 'trending-up', falling: 'trending-down', stable: 'minus' };

/** "High · rising" (40 characters at most). */
export function wastewaterValue(entry, language) {
  if (!entry) {
    return t(TEXT.noData, language);
  }
  const trend = entry.trend ? ` · ${TREND_NAMES[language][entry.trend]}` : '';
  return clip(`${LEVEL_NAMES[language][entry.level]}${trend}`);
}

/** "2.1 /100k · Moderate" (40 characters at most). */
export function hospitalValue(entry, language) {
  if (!entry) {
    return t(TEXT.noData, language);
  }
  const parts = [];
  if (entry.rate !== null) {
    parts.push(`${entry.rate.toLocaleString(language)} ${t(TEXT.perHundredThousand, language)}`);
  }
  if (entry.level) {
    parts.push(LEVEL_NAMES[language][entry.level]);
  }
  return clip(parts.join(' · '));
}

function placeContent(monitor, place, language, settings) {
  const snapshot = monitor.snapshot(place);
  const shown = Array.isArray(settings.indicators)
    ? INDICATORS.filter((key) => settings.indicators.includes(key))
    : INDICATORS;
  const components = [{ type: 'text', variant: 'heading', text: clip(monitor.deviceName(place)) }];
  const items = [];
  for (const indicator of shown) {
    for (const virus of VIRUSES) {
      const entry = snapshot[virus][indicator];
      const label = `${VIRUS_NAMES[language][virus]} · ${INDICATOR_NAMES[language][indicator]}`;
      items.push(
        indicator === 'wastewater'
          ? {
              label,
              value: wastewaterValue(entry, language),
              color: levelColor(entry?.level),
              icon: TREND_ICONS[entry?.trend] ?? 'droplet',
            }
          : {
              label,
              value: hospitalValue(entry, language),
              color: levelColor(entry?.level),
              icon: 'activity',
            },
      );
    }
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }
  if (settings.show_source !== false) {
    const week = weekText(snapshotWeeks(snapshot), language, usesStateWastewater(snapshot, place));
    components.push({
      type: 'text',
      variant: 'caption',
      text: clip(week ? `${week} · ${t(TEXT.source, language)}` : t(TEXT.source, language), 80),
    });
  }
  return components;
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' } = {}) {
      const lang = VIRUS_NAMES[language] ? language : 'en';
      const created = monitor.created();
      const chosen = typeof settings?.place === 'string' && settings.place ? settings.place : null;
      let place = created[0] ?? null;
      if (chosen) {
        const id = placeIdOfExternalId(monitor.gladys, chosen);
        place = created.find((p) => p.id === id) ?? null;
        if (!place) {
          return {
            ttl_seconds: TTL_SECONDS,
            components: [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }],
          };
        }
      }
      if (!place) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }],
        };
      }
      return {
        ttl_seconds: TTL_SECONDS,
        components: placeContent(monitor, place, lang, settings ?? {}),
      };
    },
  },
};
