# Contributing to the RIO Receipt Protocol

Thank you for your interest in contributing to the RIO Receipt Protocol. This is an open standard for cryptographic proof of AI actions, and contributions that strengthen the spec, improve the reference implementations, or expand test coverage are welcome.

---

## How to Run Tests

The protocol has two reference implementations with independent conformance test suites. Both must pass before any change is merged.

### Node.js

```bash
node tests/conformance.test.mjs
```

Requires Node.js 18 or later. Zero dependencies — uses only `node:crypto` and `node:fs`.

### Python

```bash
cd python
PYTHONPATH=. python tests/test_conformance.py
```

Requires Python 3.9 or later. Zero required dependencies for core tests. The test suite uses a custom runner (not pytest) to maintain the zero-dependency principle. Ed25519 signing tests require the optional `pynacl` package (`pip install rio-receipt-protocol[signing]`).

---

## How to Report a Bug

Open a [GitHub issue](https://github.com/bkr1297-RIO/rio-receipt-protocol/issues) using the **Bug Report** template. Include:

- A clear description of the problem
- Steps to reproduce
- Expected behavior vs. actual behavior
- Environment details (Node.js version, Python version, OS)

For **security vulnerabilities**, do not open a public issue. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

---

## How to Propose a Spec Change

This is a protocol, not just code. Changes to the specification documents (`spec/`) have broader implications than code changes because every conforming implementation depends on the spec being stable.

To propose a spec change:

1. Open a [GitHub issue](https://github.com/bkr1297-RIO/rio-receipt-protocol/issues) using the **Spec Change** template
2. Apply the `spec-change` label
3. Include:
   - Which spec document is affected (`receipt-schema.json`, `ledger-format.md`, or `signing-rules.md`)
   - The proposed change in detail
   - Rationale — why this change is necessary
   - Backward compatibility analysis — does this break existing conforming implementations?

Spec changes are reviewed by the core team before any implementation work begins. Do not submit a PR that modifies spec files without an approved spec-change issue.

---

## Code Style

### Node.js

- ESM modules (`.mjs` extension)
- Zero external dependencies for core modules — only `node:crypto` and `node:fs`
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `spec:`)

### Python

- PEP 8 style
- Zero required dependencies for core modules — only the Python standard library
- Optional dependencies (e.g., `pynacl` for Ed25519) go in the `[signing]` extras group

Both implementations must maintain API parity. If you add a function to one, the equivalent must exist in the other.

---

## Pull Request Process

1. **Fork** the repository
2. **Branch** from `main` (use a descriptive branch name: `fix/ledger-hash-order`, `feat/batch-verify-streaming`, `docs/python-examples`)
3. **Make your changes** — keep PRs focused on a single concern
4. **Run all tests** — both Node.js and Python conformance suites must pass
5. **Submit a PR** to the `main` branch

### PR Requirements

- All conformance tests pass (Node.js and Python)
- If the change affects the spec, link the approved spec-change issue
- If the change adds a new feature, include tests that cover it
- If the change modifies the public API, update the relevant README and integration guide
- Do not introduce external dependencies in core modules

### Review Process

All PRs are reviewed by the core team. PRs that touch spec files, the hash chain logic, or the verification pipeline receive additional scrutiny. Expect questions — this is a security-critical protocol.

---

## Core Invariants

The following properties are non-negotiable. Any PR that violates them will be rejected:

1. **Receipt hashes are deterministic** — the same inputs always produce the same hash
2. **The ledger is append-only** — no update, no delete, no reorder
3. **The hash chain is contiguous** — every entry links to the previous entry's hash
4. **Verification is local** — no external service calls during verification
5. **Zero required dependencies** — core modules use only language standard libraries
6. **Backward compatibility** — new features must not break existing valid receipts or ledger entries

---

## License

By contributing, you agree that your contributions will be dual-licensed under MIT and Apache 2.0, consistent with the project license.
