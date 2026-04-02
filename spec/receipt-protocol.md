# RIO Receipt Protocol Specification

**Version:** 1.0
**Status:** Open Protocol Specification
**License:** Dual-licensed under MIT OR Apache-2.0

---

## 1. Purpose

The RIO Receipt Protocol defines a standard, tamper-evident format for recording, verifying, and exchanging proof that an AI-initiated or system-initiated action was requested, evaluated, and executed.

The protocol is designed to provide a portable, implementation-neutral receipt layer for AI actions, automated workflows, and governed execution systems.

This specification covers:

- Receipt structure
- Required and optional fields
- Hashing and integrity requirements
- Verification expectations
- Interoperability requirements

This specification does not define the full governance engine, policy engine, approval workflow, or execution gateway. Those may exist in systems that implement this protocol, but they are outside the scope of the receipt format itself.

---

## 2. Design Goals

The protocol is designed to be:

- **Verifiable** — Any third party can independently confirm receipt integrity
- **Tamper-evident** — Any modification to a receipt or its chain is detectable
- **Implementation-neutral** — No dependency on a specific language, runtime, or storage system
- **Machine-readable** — Structured data suitable for programmatic verification
- **Human-auditable** — Clear enough for a human reviewer to understand what happened
- **Easy to adopt** — Minimal required fields, zero required dependencies

---

## 3. Scope

The Receipt Protocol standardizes the output record of an action lifecycle.

It is intended to support systems in which an action is proposed or requested, the action is evaluated, a decision is made (approved, denied, or modified), the action may be executed, and a durable proof artifact is required.

The protocol may be used with AI agents, human-in-the-loop systems, automation workflows, robotics systems, financial transaction workflows, and compliance and audit systems.

---

## 4. Core Model

A receipt is a structured record that proves:

- What action was requested
- Which system or actor requested it
- What decision was made
- What was executed
- When it occurred
- How the record can be verified

A receipt may optionally be signed for non-repudiation and linked to an append-only ledger for stronger tamper evidence and replayability.

---

## 5. Receipt Lifecycle

A conforming implementation should support the following conceptual lifecycle:

1. Intent or action request is created
2. Action is evaluated by the implementing system
3. Decision is produced (approved, denied, blocked, pending, etc.)
4. If execution occurs, the execution result is recorded
5. Receipt is generated
6. Receipt hash is computed
7. Receipt may be signed
8. Receipt may be committed to a ledger or append-only store

---

## 6. Required Receipt Fields

A conforming receipt MUST contain the following top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| `receipt_id` | string | A globally unique identifier for the receipt |
| `timestamp` | string | Canonical UTC timestamp for receipt generation (ISO 8601) |
| `protocol_version` | string | The version of the receipt protocol used to generate the receipt |
| `actor_id` | string | Identifier for the system, agent, user, or service that originated the action |
| `action_type` | string | A normalized action category (e.g., `send_email`, `transfer_funds`, `deploy_code`) |
| `action_summary` | string | A concise human-readable description of the action |
| `decision` | string | The final decision recorded by the implementing system |
| `receipt_hash` | string | A deterministic hash of the canonical receipt payload |
| `verification_status` | string | The current verification state of the receipt |

### `decision` Allowed Values

- `approved` — Action was approved and may or may not have been executed
- `denied` — Action was denied
- `blocked` — Action was blocked by policy or system constraint
- `pending` — Action is awaiting evaluation or approval
- `executed` — Action was approved and successfully executed
- `failed` — Action was attempted but execution failed

### `verification_status` Allowed Values

- `verified` — Receipt hash and optional signature have been validated
- `unverified` — Receipt has not yet been verified
- `failed` — Verification was attempted and failed

---

## 7. Optional Fields

Implementations MAY include optional fields to support richer proof models:

| Field | Type | Description |
|-------|------|-------------|
| `intent_id` | string | Identifier linking the receipt to the original intent or request |
| `request_id` | string | Correlation identifier for the request that triggered the action |
| `risk_score` | number | Numeric risk assessment (0.0 to 1.0) |
| `risk_level` | string | Categorical risk level (e.g., `low`, `medium`, `high`, `critical`) |
| `policy_decision` | string | The governance or policy decision that authorized or denied the action |
| `approver_id` | string | Identifier of the human or system that approved the action |
| `execution_status` | string | Outcome of the execution (e.g., `success`, `failure`, `partial`) |
| `execution_result` | string | Summary or hash of the execution result |
| `connector_id` | string | Identifier of the system or service that executed the action |
| `signature` | string | Cryptographic signature over the receipt hash or canonical payload |
| `public_key` | string | Public key corresponding to the signature, for independent verification |
| `ledger_index` | integer | Position of this receipt in the associated ledger |
| `previous_receipt_hash` | string | Hash of the preceding receipt, for receipt-level chaining |
| `metadata` | object | Implementation-specific metadata |

These fields are optional to preserve compatibility across different classes of systems. Implementations that include optional fields MUST document which fields they produce.

---

## 8. Canonicalization and Hashing

To ensure deterministic verification across systems:

- Receipts SHOULD be canonicalized before hashing
- Canonicalization SHOULD use stable key ordering
- Hashing SHOULD use SHA-256 unless otherwise declared
- The hash input MUST be well-defined by the implementation

Implementations MUST document:

- The canonicalization method used
- The exact fields included in the hashed payload
- The hash algorithm used
- The order in which fields are concatenated or serialized

A verifier given the same receipt data and the same canonicalization rules MUST produce the same hash.

---

## 9. Signatures

Implementations SHOULD sign receipts using a modern asymmetric signature scheme.

**Recommended:** Ed25519

Implementations MAY support other signature systems if documented.

The signature MUST be verifiable by an external verifier given:

- The canonical payload or payload hash
- The public verification key
- The algorithm identifier

When signatures are used, the `signature` and `public_key` optional fields SHOULD be populated in the receipt.

---

## 10. Verification Requirements

A conforming verifier SHOULD be able to check:

1. Required field presence
2. Schema validity (correct types and formats)
3. Hash recomputation integrity (recompute `receipt_hash` and compare)
4. Signature validity (if signature is present)
5. Timestamp format validity (ISO 8601)
6. Optional ledger linkage validity (if ledger is used)

Verification outcomes MUST be deterministic. Given the same receipt and the same verification rules, the result MUST always be the same.

---

## 11. Ledger Interoperability

The Receipt Protocol may be used independently or with a ledger.

When linked to a ledger, implementations SHOULD support:

- A reference from receipt to ledger entry
- A reference from ledger entry to receipt hash
- Append-only ordering
- Tamper-evident chaining

The ledger format itself is defined separately in the [Ledger Format Specification](ledger-format.md).

---

## 12. Minimal Example

```json
{
  "receipt_id": "rcpt_000001",
  "timestamp": "2026-04-02T15:00:00Z",
  "protocol_version": "1.0",
  "actor_id": "agent_bondi",
  "action_type": "send_email",
  "action_summary": "Send governed email to recipient",
  "decision": "executed",
  "receipt_hash": "a1b2c3d4e5f6...",
  "verification_status": "verified"
}
```

With optional fields:

```json
{
  "receipt_id": "rcpt_000002",
  "timestamp": "2026-04-02T15:05:00Z",
  "protocol_version": "1.0",
  "actor_id": "agent_bondi",
  "action_type": "transfer_funds",
  "action_summary": "Transfer $500 to vendor account",
  "decision": "executed",
  "risk_score": 0.82,
  "risk_level": "high",
  "approver_id": "user_brian",
  "execution_status": "success",
  "receipt_hash": "f7e8d9c0b1a2...",
  "signature": "ed25519:xyz456...",
  "public_key": "ed25519:pub789...",
  "verification_status": "verified"
}
```

---

## 13. Conformance

An implementation conforms to this specification if it:

- Produces receipts with all required fields
- Uses a documented hashing process
- Supports deterministic verification
- Documents any optional extensions used
- Documents the canonicalization method

See the [Conformance Specification](conformance.md) for detailed conformance levels and test requirements.

---

## 14. Extensions

Implementations MAY define extension fields, provided they:

- Do not break required field semantics
- Preserve backward compatibility
- Are clearly namespaced or documented

Extensions SHOULD be described in the implementation's documentation so that verifiers can account for them.

---

## 15. Non-Goals

This specification does not attempt to define:

- Full policy engines
- Human approval semantics
- Execution authorization logic
- Connector behavior
- User interface requirements
- Enterprise governance policy

Those belong to higher-level architectural systems that may use this protocol.

---

## 16. Reference Implementation Mapping (RIO v2.2)

The RIO v2.2 reference implementation uses an internal schema optimized for hash chain computation. This section documents how the canonical protocol fields map to the v2.2 internal representation.

### Receipt Field Mapping

| Canonical Field | RIO v2.2 Field | Notes |
|----------------|----------------|-------|
| `receipt_id` | `receipt_id` | Direct mapping |
| `timestamp` | `timestamp` | Direct mapping |
| `protocol_version` | `version` | Renamed for brevity |
| `actor_id` | `agent_id` | v2.2 uses agent-specific terminology |
| `action_type` | `action` | Renamed for brevity |
| `action_summary` | Derived from `action` + execution context | v2.2 hashes the action and result separately |
| `decision` | `receipt_type` | v2.2 uses `"action"` (proof-layer) or `"governed_action"` (governed) |
| `receipt_hash` | `hash_chain.receipt_hash` | Nested inside the `hash_chain` object in v2.2 |
| `signature` | `identity_binding.signature` | Optional extension in v2.2 |
| `verification_status` | Computed at verification time | Not stored in v2.2 receipts; determined by `verifyReceipt()` |

### Hash Chain Model

The v2.2 implementation extends the canonical `receipt_hash` into a multi-hash chain that provides finer-grained proof:

**Proof-layer receipt (3-hash chain):**

| v2.2 Hash Field | Canonical Equivalent | Description |
|-----------------|---------------------|-------------|
| `hash_chain.intent_hash` | Part of `receipt_hash` computation | SHA-256 of the intent parameters |
| `hash_chain.execution_hash` | Part of `receipt_hash` computation | SHA-256 of the execution result |
| `hash_chain.receipt_hash` | `receipt_hash` | SHA-256 binding all hashes together |

**Governed receipt (5-hash chain):**

| v2.2 Hash Field | Canonical Equivalent | Description |
|-----------------|---------------------|-------------|
| `hash_chain.intent_hash` | Part of `receipt_hash` computation | SHA-256 of the intent parameters |
| `hash_chain.governance_hash` | Related to `policy_decision` | SHA-256 of the governance evaluation |
| `hash_chain.authorization_hash` | Related to `approver_id` | SHA-256 of the authorization decision |
| `hash_chain.execution_hash` | Part of `receipt_hash` computation | SHA-256 of the execution result |
| `hash_chain.receipt_hash` | `receipt_hash` | SHA-256 binding all hashes together |

The `verification` object in v2.2 contains `chain_order` (the ordered list of hash field names) and `algorithm` (always `"sha256"`), which together define how `receipt_hash` is computed from the component hashes.

### Ledger Field Mapping

| Canonical Field | RIO v2.2 Field | Notes |
|----------------|----------------|-------|
| `ledger_index` | `index` | Renamed for brevity |
| `timestamp` | `timestamp` | Direct mapping |
| `receipt_hash` | `receipt_hash` | Direct mapping |
| `previous_ledger_hash` | `prev_hash` | Renamed for brevity |
| `ledger_hash` | `ledger_hash` | Direct mapping |

### Exporting a Canonical Receipt from v2.2

An implementation consuming v2.2 receipts can produce a canonical receipt view:

```javascript
function toCanonical(v22Receipt) {
  return {
    receipt_id: v22Receipt.receipt_id,
    timestamp: v22Receipt.timestamp,
    protocol_version: v22Receipt.version,
    actor_id: v22Receipt.agent_id,
    action_type: v22Receipt.action,
    action_summary: v22Receipt.action,
    decision: v22Receipt.receipt_type === "governed_action" ? "executed" : "executed",
    receipt_hash: v22Receipt.hash_chain.receipt_hash,
    signature: v22Receipt.identity_binding?.signature || null,
    verification_status: "unverified"
  };
}
```

This mapping allows any system that understands the canonical protocol to verify receipts produced by the RIO v2.2 reference implementation.

---

## 17. Summary

The RIO Receipt Protocol provides a portable, auditable proof layer for AI and system actions. It is intended to serve as a foundational open standard for tamper-evident action receipts across governed and non-governed execution environments.

---

## Related Specifications

| Document | Description |
|----------|-------------|
| [Ledger Format](ledger-format.md) | Append-only, hash-chained ledger structure |
| [Conformance](conformance.md) | Conformance levels and test requirements |
| [Signing Rules](signing-rules.md) | Ed25519 signing and identity binding |
| [Receipt Schema (v2.2)](receipt-schema.json) | JSON Schema for the v2.2 reference implementation |
