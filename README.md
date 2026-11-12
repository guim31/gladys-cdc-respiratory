# CDC Respiratory Viruses for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
activity of **COVID-19, flu and RSV** in your US state or county into Gladys, from the open data
of the **CDC**: the wastewater viral activity level (NWSS) and the weekly hospital admissions
(NHSN). Public data, no account, no key.

> **Public health information, not medical advice.** Not affiliated with, nor endorsed by, the
> Centers for Disease Control and Prevention.

## What it does

- One device per place you choose (the 50 states, DC and Puerto Rico, or counties you type),
  with, for each virus: the wastewater level (1 Very low to 5 Very high) and its trend, the
  hospital admissions per 100,000 residents and their level (1 to 5), and the week of the data.
- Scene triggers: **a level rises to** or **falls below** a chosen level (fired once when the new
  week is published).
- A scene action: **the week in one sentence**, ready for a notification.
- A dashboard widget: the levels of a place, coloured from green to red.

Full user documentation: [English](docs/en.md), [français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md).

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- United States only.

## Installation

In Gladys: **Integrations → Install from GitHub**, address of this repository:
`https://github.com/guim31/gladys-cdc-respiratory`. Choose your states, type your counties if you
wish (`Harris, TX; Cook, IL`), save, then create the devices in the **Discover** tab.

## How it works

The data come from [data.cdc.gov](https://data.cdc.gov) (Socrata SODA API, no key):

- `atcp-73re`, CDC Wastewater Viral Activity Level for SARS-CoV-2, Influenza A and RSV (NWSS):
  site levels, updated on Fridays. The level of a state or county is the **median of its sites**
  reporting that week, as on the CDC map, computed by the integration; a county without a plant
  of its own falls back on its state, and says so.
- `vdzy-6i9v`, Weekly Hospital Respiratory Admission Levels and Rates by Jurisdiction (NHSN):
  admissions per 100,000 and their level, per state.

Every 6 hours the integration sends two requests, restricted to the followed states and the
last four weeks, keeps the rows under `/data`, and waits an hour (doubled each time, 24 hours at
most) after a "too many requests" answer, restarts included. An optional data.cdc.gov
application token raises the limit.

## Limits

- **Developed without a running Gladys**: tested against the real data.cdc.gov and the fake
  Gladys of the SDK. Feedback welcome.
- The state and county wastewater levels are computed from the site levels, not read from the
  CDC map: they may rarely differ by one step.
- Hospital data exist per state only. For flu, the wastewater measures influenza A only.
- The trend ignores the small moves (20 % and 0.5 WVAL at least).

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
```

The tests run against the fake Gladys of the SDK and real answers of data.cdc.gov recorded under
`test/fixtures/cdc/` (12 November 2026: North Dakota, Texas and Vermont, weeks ending 17 to
31 October); they never touch the network.

## Credits

- Data: Centers for Disease Control and Prevention, National Wastewater Surveillance System and
  National Healthcare Safety Network, [data.cdc.gov](https://data.cdc.gov), public domain (U.S.
  Government work). Some answers are recorded in `test/fixtures/cdc/` as test data.
- Cover: a simple pictogram drawn for this integration. The CDC logo is not used: the CDC does
  not allow its use by third parties without its permission.
- Built on the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js) and
  [SDK](https://github.com/GladysAssistant/integration-sdk-js).

Not affiliated with, nor endorsed by, the CDC or the U.S. Department of Health and Human
Services.

## License

[Apache-2.0](LICENSE)
