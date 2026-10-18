# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-10-18
### Added
- Crossref fallback for `DOI search`, `DOI list search`, and `URL DOI search` when a DOI is not yet indexed in Europe PMC (for example, recently published Cell/Elsevier articles).
- Shared `PaperMetadata` model that normalizes Europe PMC and Crossref results before note creation.

### Changed
- Refactored DOI article creation into a shared `writeArticleNote` path used by both providers.
- Bumped plugin version to `1.2.0` and added the missing `1.1.0` and new `1.2.0` entries to `versions.json`.

## [1.1.0] - 2026-02-15
### Added
- New article filename sanitization to prevent invalid file path segments before note creation.
- More specific modal errors for Europe PMC no-results and unexpected hit counts, duplicate article conflicts, invalid generated article names, and no-results in arXiv and bioRxiv.

### Changed
- Bumped plugin version to `1.1.0` in `manifest.json`.
- Updated `README.md` with current plugin behavior, commands, settings, and development usage.
- Updated `manifest.json` description text and removed `fundingUrl`.
- Updated `Justfile` `localbuild` recipe to ensure plugin directory exists and copy both `main.js` and `manifest.json`.

### Fixed
- Improved article creation error reporting by surfacing the underlying file creation error message.
