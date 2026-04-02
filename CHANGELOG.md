# Changelog

All notable changes to the RIO Receipt Protocol will be documented in this file.

## [2.2.0] - 2026-04-01

### Added
- npm package entry point (`index.mjs`) with unified exports for receipts, ledger, and verifier
- TypeScript type declarations (`index.d.ts`) for full IDE support
- Python package (`python/rio_receipt_protocol/`) with v2.2-aligned API mirroring Node.js exactly
- Python conformance tests (`python/tests/test_conformance.py`) — 29 tests across 8 categories
- Integration guide with OpenAI, Anthropic, and LangChain examples (`docs/integration-guide.md`)
- Quickstart section in README for 5-minute onboarding
- `pyproject.toml` for PyPI packaging with zero required dependencies

### Changed
- Receipt schema updated to v2.2: governance fields (`governance_hash`, `authorization_hash`) are now optional
- CLI verifier (`cli/verify.mjs`) updated to support both proof-layer (3-hash) and governed (5-hash) receipts
- Package name changed from `@rio-protocol/receipt` to `rio-receipt-protocol` for easier installation
- Package version bumped to 2.2.0

### Fixed
- CLI verifier no longer requires governance/authorization hashes for proof-layer receipts

## [2.1.0] - 2026-03-29

### Added
- Proof-layer receipt type (3-hash chain: intent, execution, receipt)
- Optional governance extension (5-hash chain)
- Ingestion provenance extension
- Identity binding extension with Ed25519 support
- 29 conformance tests across 8 categories

## [1.0.0] - 2026-03-28

### Added
- Initial receipt schema and ledger specification
- Node.js reference implementation (zero dependencies)
- CLI verifier tool (`rio-verify`)
- Basic conformance test suite
