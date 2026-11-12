# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-12

### Added

- One device per place followed (a US state, DC, Puerto Rico, or a county typed in the
  configuration), with, for COVID-19, flu and RSV: the CDC wastewater viral activity level
  (1 Very low to 5 Very high) and its trend, the hospital admissions per 100,000 residents and
  their level, and the week of the data, from the open data of the CDC (NWSS and NHSN).
- Scene triggers: a respiratory virus level rises to, or falls below, a chosen level.
- Scene action: the week of a place in one sentence, ready for a notification.
- Dashboard widget: the wastewater and hospital levels of a place, coloured by level.
- Optional data.cdc.gov application token.
- Feature names and texts in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-cdc-respiratory/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-cdc-respiratory/releases/tag/v1.0.0
