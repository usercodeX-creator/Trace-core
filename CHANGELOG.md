# Changelog

All notable changes to trace-core will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-18

### Added
- Detector 01: Hallucinated dependencies — detects imports of packages not found on npm or PyPI
- CLI `trace-check` with human and JSON output formats
- Python import parser (regex-based, stdlib filtered)
- JavaScript / TypeScript import parser (handles scoped packages, `node:` prefix, relative imports)
- PyPI and npm registry clients with in-memory caching
- 14 unit tests across parsers and detectors
- Plugin-based detector architecture designed for future extensions
