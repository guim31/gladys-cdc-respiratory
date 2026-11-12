// -----------------------------------------------------------------------------
// The texts the container produces, in the four languages of Gladys. German
// says "du", Spanish "usted". The keys (viruses, indicators, trends) are
// stored by Gladys (feature ids, scene filters): they never change.
// -----------------------------------------------------------------------------

export const LANGS = ['en', 'fr', 'de', 'es'];

export const VIRUS_NAMES = {
  en: { covid: 'COVID-19', flu: 'Flu', rsv: 'RSV' },
  fr: { covid: 'COVID-19', flu: 'Grippe', rsv: 'VRS' },
  de: { covid: 'COVID-19', flu: 'Grippe', rsv: 'RSV' },
  es: { covid: 'COVID-19', flu: 'Gripe', rsv: 'VRS' },
};

export const INDICATOR_NAMES = {
  en: { wastewater: 'Wastewater', hospital: 'Hospitals' },
  fr: { wastewater: 'Eaux usées', hospital: 'Hôpitaux' },
  de: { wastewater: 'Abwasser', hospital: 'Krankenhäuser' },
  es: { wastewater: 'Aguas residuales', hospital: 'Hospitales' },
};

// The CDC categories, 1 to 5.
export const LEVEL_NAMES = {
  en: { 1: 'Very low', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Very high' },
  fr: { 1: 'Très bas', 2: 'Bas', 3: 'Modéré', 4: 'Élevé', 5: 'Très élevé' },
  de: { 1: 'Sehr niedrig', 2: 'Niedrig', 3: 'Mäßig', 4: 'Hoch', 5: 'Sehr hoch' },
  es: { 1: 'Muy bajo', 2: 'Bajo', 3: 'Moderado', 4: 'Alto', 5: 'Muy alto' },
};

export const TREND_NAMES = {
  en: { rising: 'rising', stable: 'stable', falling: 'falling' },
  fr: { rising: 'en hausse', stable: 'stable', falling: 'en baisse' },
  de: { rising: 'steigend', stable: 'stabil', falling: 'fallend' },
  es: { rising: 'al alza', stable: 'estable', falling: 'a la baja' },
};

// Text of the `week` feature and of the widget caption.
export const WEEK_TEXT = {
  en: {
    same: 'Week ending {date}',
    split: 'Wastewater {wastewater} · hospitals {hospital}',
    stateWide: '{text} · statewide wastewater',
  },
  fr: {
    same: 'Semaine au {date}',
    split: 'Eaux usées {wastewater} · hôpitaux {hospital}',
    stateWide: "{text} · eaux usées de l'État",
  },
  de: {
    same: 'Woche bis {date}',
    split: 'Abwasser {wastewater} · Kliniken {hospital}',
    stateWide: '{text} · Abwasser des Bundesstaats',
  },
  es: {
    same: 'Semana hasta el {date}',
    split: 'Aguas residuales {wastewater} · hospitales {hospital}',
    stateWide: '{text} · aguas residuales del estado',
  },
};

// Sentence of the scene action.
export const SUMMARY = {
  en: {
    intro: '{place}, week ending {date}: {list}.',
    none: 'No CDC data yet for {place}.',
    item: '{virus}: {parts}',
    separator: '; ',
    wastewater: 'wastewater {level}',
    wastewaterTrend: 'wastewater {level} and {trend}',
    rate: '{rate} hospital admissions per 100,000',
  },
  fr: {
    intro: '{place}, semaine au {date} : {list}.',
    none: 'Pas encore de données du CDC pour {place}.',
    item: '{virus} : {parts}',
    separator: ' ; ',
    wastewater: 'niveau {level} dans les eaux usées',
    wastewaterTrend: 'niveau {level} et {trend} dans les eaux usées',
    rate: '{rate} hospitalisations pour 100 000 hab.',
  },
  de: {
    intro: '{place}, Woche bis {date}: {list}.',
    none: 'Noch keine CDC-Daten für {place}.',
    item: '{virus}: {parts}',
    separator: '; ',
    wastewater: 'Abwasser {level}',
    wastewaterTrend: 'Abwasser {level} und {trend}',
    rate: '{rate} Klinikaufnahmen pro 100.000',
  },
  es: {
    intro: '{place}, semana hasta el {date}: {list}.',
    none: 'Aún no hay datos de los CDC para {place}.',
    item: '{virus}: {parts}',
    separator: '; ',
    wastewater: 'nivel {level} en aguas residuales',
    wastewaterTrend: 'nivel {level} y {trend} en aguas residuales',
    rate: '{rate} hospitalizaciones por 100.000 hab.',
  },
};

// Connection status shown by Gladys: the object with the four languages.
export const STATUS = {
  sourceDown: {
    en: 'The CDC open data portal (data.cdc.gov) cannot be read: the values shown are the last ones read.',
    fr: 'Le portail de données ouvertes du CDC (data.cdc.gov) est illisible : les valeurs affichées sont les dernières lues.',
    de: 'Das Open-Data-Portal der CDC (data.cdc.gov) ist nicht lesbar: Die angezeigten Werte sind die zuletzt gelesenen.',
    es: 'No se puede leer el portal de datos abiertos de los CDC (data.cdc.gov): los valores mostrados son los últimos leídos.',
  },
  rateLimited: {
    en: 'data.cdc.gov limits the requests of this address: new try later. An application token raises the limit.',
    fr: "data.cdc.gov limite les requêtes de cette adresse : nouvel essai plus tard. Un jeton d'application relève la limite.",
    de: 'data.cdc.gov begrenzt die Anfragen dieser Adresse: neuer Versuch später. Ein App-Token hebt das Limit an.',
    es: 'data.cdc.gov limita las solicitudes de esta dirección: nuevo intento más tarde. Un token de aplicación eleva el límite.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
    de: 'Die Integration konnte nicht starten: Sieh dir ihre Protokolle an.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
};

/** Replaces {name} placeholders. */
export function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
}

/** "Oct 31" / "31 oct." for a "2026-10-31" date (a calendar date, no time zone). */
export function dateText(date, language) {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Text of the weeks of a snapshot (see levels.js snapshotWeeks), or null. */
export function weekText(weeks, language, stateWide = false) {
  const texts = WEEK_TEXT[language] ?? WEEK_TEXT.fr;
  const { wastewater, hospital } = weeks;
  if (!wastewater && !hospital) {
    return null;
  }
  const text =
    !wastewater || !hospital || wastewater === hospital
      ? fill(texts.same, { date: dateText(wastewater ?? hospital, language) })
      : fill(texts.split, {
          wastewater: dateText(wastewater, language),
          hospital: dateText(hospital, language),
        });
  return stateWide && wastewater ? fill(texts.stateWide, { text }) : text;
}
