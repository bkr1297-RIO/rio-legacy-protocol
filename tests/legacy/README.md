# Legacy Tests

This directory contains conformance tests for the **pre-v2.2 receipt schema** (fields like `id`, `action.type`, `signature`, `public_key`). These tests validate Damon's Ed25519 signing implementation against the legacy format.

**These tests require `pynacl` and the legacy `reference/verifier.py`.**

For the current v2.2 conformance tests, see:

- **Node.js:** `tests/conformance.test.mjs` (29 tests)
- **Python:** `python/tests/test_conformance.py` (29 tests)
