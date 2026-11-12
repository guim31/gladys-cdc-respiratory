# CDC Respiratory Viruses

COVID-19, flu and RSV in your US state or county, from the open data of the **CDC** (Centers for Disease Control and
Prevention): the **wastewater viral activity level** of the National Wastewater Surveillance System (NWSS) and the
**hospital admissions** of the National Healthcare Safety Network (NHSN). One device per place, scene triggers, a
scene action and a dashboard widget.

> **Public health information, not medical advice.** These are levels for a whole state or a few treatment plants.
> For your health, ask your doctor.

Not affiliated with the CDC.

## What you get

- **One device per place** you choose: a state (the 50 states, the District of Columbia and Puerto Rico), or a county
  you type.
- For COVID-19, flu and RSV: the **wastewater level** (1 Very low to 5 Very high) and its **trend**, the **hospital
  admissions per 100,000 residents** of the week and their **level** (1 to 5).
- The **week of the data** ("Week ending Oct 31").
- Two **scene triggers** (a level rises to, or falls below, a chosen level), a **scene action** (the week in one
  sentence) and a **dashboard widget**.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from Gladys. No account and no key.
- United States only.

## Configuration

### Settings

| Setting                       | Default | What it does                                                                     |
| ----------------------------- | ------- | -------------------------------------------------------------------------------- |
| States                        | none    | The states to follow, one device each.                                           |
| Counties                      | empty   | `County, ST` entries separated by semicolons, 10 at most: `Harris, TX; Cook, IL` |
| Application token (optional)  | empty   | A free data.cdc.gov token, only if the request limit of your address is reached. |
| Language of the feature names | French  | Names of new features, language of their texts and summary.                      |

Save, then open the **Discover** tab of the integration and create the devices you want.

A county is matched by its name against the counties each treatment plant serves ("Harris County" and "Harris" are
the same). A county with **no plant of its own** shows the levels of its whole state, and its week says "statewide
wastewater". Its hospital figures are always those of its state: the NHSN publishes no county data.

## Devices

| Feature (× COVID-19, flu, RSV) | Type   | Value                                                          |
| ------------------------------ | ------ | -------------------------------------------------------------- |
| … wastewater level             | number | 1 Very low, 2 Low, 3 Moderate, 4 High, 5 Very high             |
| … wastewater trend             | text   | rising, stable or falling                                      |
| … hospital level               | number | 1 to 5, the NHSN level of the admissions of the state          |
| … admissions /100,000          | number | new hospital admissions per 100,000 residents in the week      |
| Week of the data               | text   | end date of the week (Saturday), of each source if they differ |

The **wastewater level of a state or a county** is the median of the levels of its plants reporting that week, as the
CDC map does; the integration computes it from the site levels the CDC publishes, so it may rarely differ by one step
from the CDC map. For flu, the wastewater measures **influenza A**; the hospitals count every flu.

A week counts once at least half of the plants of the week before reported it: until then, the
device keeps the week before.

The **trend** compares the median wastewater value with the week before: "rising" from +20 % (and at least +0.5),
"falling" from −1/6 (and at least −0.5), else "stable".

The levels are numbers: a scene condition such as "RSV wastewater level ≥ 4" works directly.

## Dashboard widget

**Respiratory viruses**: the place chosen (else the first one followed), with one line per virus for the wastewater
(level and trend) and one for the hospitals (admissions and level), green up to Low, orange at Moderate, red from
High, and a caption with the week and the source. One setting chooses the indicators shown, another hides the caption.

## Scene triggers

- **Respiratory virus level rises**: when a new week is published, a wastewater or hospital level of a place reaches
  the chosen level (Low to Very high) from below. Filters: place, virus, indicator, level.
- **Respiratory virus level falls**: the same, downwards: the level goes back below the chosen one.

Variables: place, virus, indicator, level (number), level name, previous level, week. The first week read after the
installation only sets the reference: it fires nothing.

## Scene action

**CDC: get the week in one sentence**: returns, for a place (empty: the first one followed), a sentence ready for a
notification, such as "Texas, week ending Oct 31: COVID-19: wastewater low and falling, 1.15 hospital admissions per
100,000; Flu: …", in the language of the configuration, with each level and rate as separate outputs.

## Scene examples

- Every Saturday at 9 am, send the sentence of your county to the family group.
- When the flu wastewater level of your county reaches High, remind everyone to wash their hands, or plan the flu
  shot.
- When the RSV level falls back below Moderate, say the wave is over.

## Data sources, licence and quotas

- Source: **CDC**, [data.cdc.gov](https://data.cdc.gov), public domain (U.S. Government work), read without an
  account:
  - `atcp-73re`, "CDC Wastewater Viral Activity Level for SARS-CoV-2, Influenza A and RSV" (NWSS), updated on
    Fridays;
  - `vdzy-6i9v`, "Weekly Hospital Respiratory Admission Levels and Rates by Jurisdiction" (NHSN), updated weekly.
- The data are **weekly**; the integration reads them **every 6 hours** (two requests, only for the followed states
  and the last four weeks), so a new week shows within 6 hours of its publication.
- Without a token, data.cdc.gov limits the requests of each address; a home stays far below. After a "too many
  requests" answer the integration waits an hour (then longer), restarts included. An application token (free, on
  data.cdc.gov) raises the limit.

## Troubleshooting

- **No value after creating the device**: wait a few seconds for the first read; check that Gladys has internet
  access.
- **No wastewater value**: no plant of the state reported in the last four weeks (North Dakota and Oklahoma, for
  example, in November 2026). The hospital values still come.
- The connection status says data.cdc.gov cannot be read: the portal is unreachable; the last values are kept and
  the integration tries again 30 minutes later, then every 6 hours.
- The connection status says data.cdc.gov limits the requests: the integration waits and tries again on its own; add
  an application token if it happens often.

## Limits

- Developed and tested against the real data.cdc.gov, not inside a running Gladys yet: feedback welcome.
- The state and county wastewater levels are computed by the integration from the site levels (median), not read
  from the CDC map.
- Hospital data exist only per state; a county gets its state's.
- Off season, a level may stay unpublished ("Data Unavailable"): the device keeps its last value.
