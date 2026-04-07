# RIO Conformance Specification

**Version:** 1.0
**Status:** Open Protocol Specification
**License:** Dual-licensed under MIT OR Apache-2.0

---

## 1. Purpose

The RIO Conformance Specification defines the minimum requirements an implementation must meet to be considered compliant with the RIO Receipt Protocol and Ledger Format.

This document ensures interoperability and verifiability across different implementations.

---

## 2. Conformance Scope

An implementation may conform to:

- Receipt Protocol only
- Ledger Format only
- Receipt + Ledger
- Receipt + Ledger + Verification Tools

Implementations MUST clearly state which components they implement.

---

## 3. Receipt Conformance Requirements

To be compliant with the RIO Receipt Protocol, an implementation MUST:

1. Produce receipts containing all required canonical fields:
   - `receipt_id`
   - `timestamp`
   - `protocol_version`
   - `actor_id`
   - `action_type`
   - `action_summary`
   - `decision`
   - `receipt_hash`
   - `verification_status`

2. Use a documented canonicalization method for hashing

3. Use a documented hash algorithm (SHA-256 is RECOMMENDED)

4. Allow external verification using the receipt payload and the documented hash method

5. Produce deterministic verification results

6. Document any optional fields or extensions used

Implementations that use an internal schema different from the canonical fields MUST provide a documented mapping (see Section 10).

---

## 4. Ledger Conformance Requirements

To be compliant with the RIO Ledger Format, an implementation MUST:

1. Maintain an append-only ledger
2. Use hash-chained ledger entries
3. Store `receipt_hash` in each ledger entry
4. Store `previous_ledger_hash` linking to the prior entry
5. Store `ledger_hash` computed from the canonical entry content
6. Allow full-chain verification from genesis to the latest entry
7. Prevent modification or deletion of past entries
8. Document the genesis rule used for the first entry

---

## 5. Verification Conformance

A conforming verifier SHOULD be able to:

- Validate receipt schema (all required fields present with correct types)
- Recompute receipt hash from canonical fields
- Verify cryptographic signature (if present)
- Verify ledger chain integrity
- Detect tampering (modified hashes, broken chain links)
- Produce a deterministic pass/fail result

---

## 6. Conformance Levels

Implementations may declare conformance at the following levels:

| Level | Name | Description |
|-------|------|-------------|
| Level 1 | **Receipt Generation** | Produces conforming receipts with all required fields and deterministic hashing |
| Level 2 | **Receipt + Verification** | Level 1 plus the ability to verify receipt integrity and detect tampering |
| Level 3 | **Receipt + Ledger** | Level 1 plus conforming ledger with hash chain |
| Level 4 | **Receipt + Ledger + Verification** | Level 3 plus full verification of receipts and ledger chain |
| Level 5 | **Full Pipeline** | Level 4 plus replay capability, cross-verification, and tamper detection |

Implementations SHOULD declare their conformance level in documentation.

---

## 7. Test Categories

The following test categories define what each conformance level must demonstrate:

### Level 1 — Receipt Generation

| Test Category | What It Proves |
|--------------|----------------|
| Hash function correctness | SHA-256 produces correct output for known inputs |
| Hash determinism | Same input always produces same hash |
| Receipt field completeness | All required canonical fields are present |
| Receipt hash computation | `receipt_hash` is correctly computed from canonical fields |

### Level 2 — Receipt + Verification

All Level 1 tests, plus:

| Test Category | What It Proves |
|--------------|----------------|
| Valid receipt passes verification | Correctly generated receipts are accepted |
| Tampered receipt fails verification | Modified receipt hash is detected |
| Missing field fails verification | Incomplete receipts are rejected |

### Level 3 — Receipt + Ledger

All Level 1 tests, plus:

| Test Category | What It Proves |
|--------------|----------------|
| Genesis entry | First entry uses the documented genesis rule |
| Chain linkage | Each entry's `previous_ledger_hash` matches the prior `ledger_hash` |
| Ledger hash determinism | Same entry data produces same `ledger_hash` |
| Append-only enforcement | Entries cannot be modified after creation |

### Level 4 — Receipt + Ledger + Verification

All Level 1, 2, and 3 tests, plus:

| Test Category | What It Proves |
|--------------|----------------|
| Full chain verification | Walking the chain from genesis to tip produces a valid result |
| Tampered entry breaks chain | Modified entry is detected during chain verification |

### Level 5 — Full Pipeline

All Level 1, 2, 3, and 4 tests, plus:

| Test Category | What It Proves |
|--------------|----------------|
| Receipt-ledger cross-verification | `receipt_hash` in ledger entry matches the receipt's computed hash |
| Replay capability | Full action history can be reconstructed from the ledger |
| Tamper detection across layers | Modification to either receipt or ledger entry is detected |

---

## 8. Test Vectors

A conforming implementation SHOULD publish example receipts, example ledger entries, expected hash outputs, and expected signature verification results.

### SHA-256 Test Vectors

Implementations MUST produce identical output for these inputs:

| Input | Expected SHA-256 (hex) |
|-------|----------------------|
| `""` (empty string) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `"hello"` | `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` |
| `"RIO Receipt Protocol"` | Implementation MUST produce a 64-character lowercase hex string |

---

## 9. Versioning

Implementations MUST declare:

- Protocol version used (e.g., "1.0")
- Ledger format version used (e.g., "1.0")
- Hash algorithm (e.g., "SHA-256")
- Signature algorithm (e.g., "Ed25519"), if signing is supported

---

## 10. Implementation Mapping Requirement

When an implementation uses internal field names or structures that differ from the canonical protocol fields, the implementation MUST provide a documented mapping that shows:

- How each canonical required field is represented internally
- How a canonical receipt view can be derived from the internal representation
- Any additional fields included in hash computation beyond the canonical set

This mapping allows verifiers to translate between the implementation's format and the canonical protocol format.

### RIO v2.2 Reference Implementation

The RIO v2.2 reference implementation uses an internal schema optimized for multi-hash chain computation. Full mapping details are documented in the [Receipt Protocol Specification, Section 16](receipt-protocol.md#16-reference-implementation-mapping-rio-v22).

The v2.3 reference test suite contains 44 Node.js tests and 29 Python tests, covering all five conformance levels:

**Node.js:**
```bash
git clone https://github.com/bkr1297-RIO/rio-receipt-protocol.git
cd rio-receipt-protocol
node tests/conformance.test.mjs
```

**Python:**
```bash
cd rio-receipt-protocol/python
PYTHONPATH=. python3 tests/test_conformance.py
```

Expected output: Node.js 44 tests, 44 passed. Python 29 tests, 29 passed.

---

## 11. Extension Policy

Implementations MAY add fields beyond those required by the spec, but:

- Required fields MUST remain intact and unmodified
- Existing fields MUST NOT change meaning
- Extensions SHOULD be documented
- Backward compatibility SHOULD be preserved
- Extension fields MUST NOT interfere with hash computation of required fields

---

## 12. Conformance Statement Example

An implementation may publish a statement such as:

> "This system implements RIO Receipt Protocol v1.0 and RIO Ledger Format v1.0 at Conformance Level 4. Receipts are hashed using SHA-256 and signed using Ed25519. The ledger is append-only and hash-chained. Verification tools are available for independent validation."

---

## 13. Summary

The purpose of conformance is to ensure that receipts and ledgers generated by one system can be verified by another system without requiring trust in the original system.

---

## Related Specifications

| Document | Description |
|----------|-------------|
| [Receipt Protocol](receipt-protocol.md) | Receipt structure, fields, hashing, and verification |
| [Ledger Format](ledger-format.md) | Append-only, hash-chained ledger structure |
| [Signing Rules](signing-rules.md) | Ed25519 signing and identity binding |
