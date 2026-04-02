# RIO Ledger Format Specification

**Version:** 1.0
**Status:** Open Protocol Specification
**License:** Dual-licensed under MIT OR Apache-2.0

---

## 1. Purpose

The RIO Ledger Format defines a tamper-evident, append-only structure for recording receipt hashes and related metadata in a verifiable sequence.

The ledger provides ordering, integrity, and replay capability for receipts generated under the RIO Receipt Protocol or compatible systems.

This specification defines:

- Ledger entry structure
- Hash chaining requirements
- Append-only rules
- Verification expectations

This specification does not define database technology, storage engine, or hosting model. The ledger may be implemented using files, databases, object storage, or distributed systems, as long as the integrity rules are preserved.

---

## 2. Design Goals

The ledger must be:

- **Append-only** — Entries can only be added, never modified or deleted
- **Tamper-evident** — Any modification to any entry is detectable
- **Verifiable independently** — A third party can verify the chain without access to the original system
- **Implementation-neutral** — No dependency on a specific storage technology
- **Deterministic to validate** — Given the same data, verification always produces the same result
- **Portable across systems** — Ledger data can be exported and verified anywhere

---

## 3. Core Model

The ledger is an ordered sequence of entries. Each entry contains a reference to a receipt hash, a reference to the previous ledger hash, a current ledger hash, a timestamp, and an index or sequence number.

Each entry links to the previous entry via a hash chain, making modification detectable.

---

## 4. Ledger Entry Structure

A ledger entry MUST contain the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `ledger_index` | integer | Monotonically increasing integer representing the position in the ledger |
| `timestamp` | string | Canonical UTC timestamp in ISO 8601 format for when the ledger entry was created |
| `receipt_hash` | string | Hash of the associated receipt |
| `previous_ledger_hash` | string | Hash of the previous ledger entry |
| `ledger_hash` | string | Hash of the current ledger entry, computed over the canonical entry payload |

A ledger entry MAY contain additional fields for implementation-specific metadata, provided they do not alter the semantics of the required fields.

---

## 5. Hash Chain Requirement

Each ledger entry MUST be linked to the previous entry via `previous_ledger_hash`.

The `ledger_hash` MUST be computed from a canonical representation of the entry including:

- `ledger_index`
- `timestamp`
- `receipt_hash`
- `previous_ledger_hash`

This creates a tamper-evident chain. If any previous entry is modified, all subsequent hashes will fail verification.

Implementations MUST document:

- The exact fields included in the hash computation
- The order of field concatenation or serialization
- The hash algorithm used (SHA-256 is RECOMMENDED)

---

## 6. Genesis Entry

The first ledger entry (index 0 or 1) is the genesis entry.

Implementations MUST define a genesis rule for the `previous_ledger_hash` of the first entry. Acceptable approaches include:

- A string of 64 zero characters (`"0000...0000"`)
- The string `"GENESIS"`
- A null value
- A predefined constant

The genesis rule MUST be documented and consistent across all ledger operations within an implementation.

---

## 7. Append-Only Rule

A conforming ledger implementation MUST:

- Only allow new entries to be appended
- Never allow modification of existing entries
- Never allow deletion of existing entries
- Never allow reordering of entries

If correction is needed, a new entry must be appended describing the correction. The original entry remains in the chain.

---

## 8. Verification Process

A verifier SHOULD be able to:

1. Iterate through ledger entries in order
2. Recompute each `ledger_hash` from the entry's canonical fields
3. Check that each `previous_ledger_hash` matches the prior entry's `ledger_hash`
4. Verify that each `receipt_hash` corresponds to a valid receipt
5. Confirm monotonically increasing `ledger_index`
6. Confirm valid timestamps

If any hash mismatch occurs, the ledger integrity check fails at the point of mismatch.

---

## 9. Entry Status Values

When implementations track the lifecycle of an action, ledger entries MAY include a status field. Recommended values:

| Status | Description |
|--------|-------------|
| `submitted` | Intent received and recorded |
| `governed` | Policy evaluation completed |
| `authorized` | Human or policy approval recorded |
| `executed` | Action dispatched to target system |
| `denied` | Action denied by policy or human |
| `blocked` | Action blocked by kill switch or system constraint |
| `verified` | Execution outcome verified |
| `failed` | Execution failed |

---

## 10. Minimal Example

```json
[
  {
    "ledger_index": 0,
    "timestamp": "2026-04-02T15:00:00Z",
    "receipt_hash": "a1b2c3d4e5f6...",
    "previous_ledger_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "ledger_hash": "f7e8d9c0b1a2..."
  },
  {
    "ledger_index": 1,
    "timestamp": "2026-04-02T15:05:00Z",
    "receipt_hash": "b2c3d4e5f6a7...",
    "previous_ledger_hash": "f7e8d9c0b1a2...",
    "ledger_hash": "c3d4e5f6a7b8..."
  }
]
```

---

## 11. Storage Flexibility

The ledger MAY be stored in flat files, SQL databases, NoSQL databases, object storage, distributed ledgers, version control systems, or write-once storage.

The storage mechanism does not define conformance. Integrity and append-only behavior define conformance.

---

## 12. Replay Capability

A conforming ledger SHOULD allow replay by reading entries in order, fetching corresponding receipts, reconstructing the action history, and re-verifying hashes and signatures.

Replay is the process of walking the ledger from genesis to the current tip and confirming that every entry is valid and every link is intact.

---

## 13. Reference Implementation Mapping (RIO v2.2)

The RIO v2.2 reference implementation uses the following field names for ledger entries:

| Canonical Field | RIO v2.2 Field | Notes |
|----------------|----------------|-------|
| `ledger_index` | `index` | Renamed for brevity |
| `timestamp` | `timestamp` | Direct mapping |
| `receipt_hash` | `receipt_hash` | Direct mapping |
| `previous_ledger_hash` | `prev_hash` | Renamed for brevity |
| `ledger_hash` | `ledger_hash` | Direct mapping |

The v2.2 implementation also includes additional fields in each ledger entry:

| v2.2 Field | Description |
|-----------|-------------|
| `receipt_id` | The receipt ID for cross-referencing |
| `action` | The action type for human readability |
| `agent_id` | The agent that produced the receipt |
| `detail` | A human-readable summary of the action |

These additional fields are included for convenience and are included in the v2.2 hash computation. The v2.2 `ledger_hash` is computed from the canonical JSON of: `index`, `timestamp`, `receipt_hash`, `prev_hash`, `receipt_id`, `action`, `agent_id`, `detail`.

The v2.2 genesis hash is 64 zero characters: `"0000000000000000000000000000000000000000000000000000000000000000"`.

### Canonical Content (v2.2)

The v2.2 canonical content for hashing is a JSON string constructed from these fields in this order, produced by `JSON.stringify()` with no whitespace:

```json
{"index":0,"timestamp":"...","receipt_hash":"...","prev_hash":"...","receipt_id":"...","action":"...","agent_id":"...","detail":"..."}
```

---

## 14. Conformance

An implementation conforms to this specification if:

1. All ledger entries contain the required fields from Section 4
2. The genesis entry uses a documented genesis rule (Section 6)
3. Entry hashes are computed using a documented canonical format
4. The hash chain is unbroken from genesis to the latest entry
5. The storage backend satisfies the append-only rule (Section 7)
6. The verification process (Section 8) produces correct results

See the [Conformance Specification](conformance.md) for detailed conformance levels.

---

## 15. Summary

The RIO Ledger Format provides an append-only, hash-chained record of receipt hashes that allows independent verification, tamper detection, and historical replay of governed or recorded actions.

---

## Related Specifications

| Document | Description |
|----------|-------------|
| [Receipt Protocol](receipt-protocol.md) | Receipt structure, fields, hashing, and verification |
| [Conformance](conformance.md) | Conformance levels and test requirements |
| [Signing Rules](signing-rules.md) | Ed25519 signing and identity binding |
