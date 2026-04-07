# RIO Receipt Protocol — Canonical Rules

> **Version:** 1.0.0
> **Status:** Normative
> **Applies to:** All implementations producing or verifying RIO receipts

This document defines the deterministic rules that every implementation MUST follow to produce and verify receipts. These rules ensure that a receipt produced by **System A** can be verified by **System B** with no shared state — only the receipt, the ledger, and the signer's public key.

---

## 1. Canonical JSON Serialization

All hashing operations in the RIO Receipt Protocol operate on **canonical JSON** — a deterministic string representation of a JavaScript/JSON object.

### Rules

1. **Serialize with `JSON.stringify(object)`** — no replacer, no indentation.
2. **Key order is insertion order** — as defined by the ECMAScript specification (ES2015+). All implementations MUST construct objects with keys in the same order as the spec defines them.
3. **No whitespace** — the canonical form has no spaces, newlines, or indentation between tokens.
4. **Unicode escaping** — follows the default `JSON.stringify` behavior of the runtime. Non-ASCII characters are passed through as UTF-8 (not `\uXXXX` escaped) unless the runtime escapes them by default.
5. **Numbers** — serialized without trailing zeros. `1.0` becomes `1`. `0.5` stays `0.5`.
6. **Null fields** — `null` values MUST be included in the serialized output. A field set to `null` is semantically different from a missing field.
7. **Missing fields** — fields not present in the object are simply absent from the serialized output. Implementations MUST NOT add default values for missing optional fields.
8. **Encoding** — the canonical JSON string is encoded as **UTF-8 bytes** before hashing.

### Example

Given an intent object:

```json
{
  "intent_id": "abc-123",
  "action": "send_email",
  "agent_id": "copilot-001",
  "parameters": {"to": "user@example.com", "subject": "Hello"},
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

The canonical form is the single-line string:

```
{"intent_id":"abc-123","action":"send_email","agent_id":"copilot-001","parameters":{"to":"user@example.com","subject":"Hello"},"timestamp":"2025-01-15T10:30:00.000Z"}
```

The hash is: `SHA-256(UTF-8(canonical_string))` → 64-character lowercase hex string.

### Cross-Language Compatibility

Python's `json.dumps(obj, separators=(',', ':'), sort_keys=False)` produces equivalent output to JavaScript's `JSON.stringify(obj)` **if and only if** the Python dict preserves insertion order (Python 3.7+) and the keys are inserted in the same order as the spec defines.

**Critical:** Both implementations MUST construct the object with keys in the same order. The spec defines the key order for each hashable object (intent, execution, governance, authorization).

---

## 2. Hash Algorithm

| Property | Value |
|----------|-------|
| Algorithm | SHA-256 |
| Input | UTF-8 encoded canonical JSON string |
| Output | 64-character lowercase hexadecimal string |
| Library | Node.js `crypto.createHash('sha256')`, Python `hashlib.sha256()` |

### Hash Chain Construction

A receipt contains a **hash chain** — a sequence of hashes where the final hash (the receipt hash) is derived from the component hashes.

The `receipt_hash` is computed by constructing a **JSON object** containing the `receipt_id`, the component hashes, and the `timestamp`, then hashing the canonical JSON serialization of that object.

**Proof-layer receipt (3-hash chain):**

```
intent_hash      = SHA-256(canonical(intent_object))
execution_hash   = SHA-256(canonical(execution_object))

receipt_content  = {
  receipt_id:     <uuid>,
  intent_hash:    <64-char hex>,
  execution_hash: <64-char hex>,
  timestamp:      <ISO 8601>
}

receipt_hash     = SHA-256(canonical(receipt_content))
```

**Governed receipt (5-hash chain):**

```
intent_hash        = SHA-256(canonical(intent_object))
governance_hash    = SHA-256(canonical(governance_object))
authorization_hash = SHA-256(canonical(authorization_object))
execution_hash     = SHA-256(canonical(execution_object))

receipt_content    = {
  receipt_id:         <uuid>,
  intent_hash:        <64-char hex>,
  governance_hash:    <64-char hex>,
  authorization_hash: <64-char hex>,
  execution_hash:     <64-char hex>,
  timestamp:          <ISO 8601>
}

receipt_hash       = SHA-256(canonical(receipt_content))
```

> **Key order matters.** The `receipt_content` object MUST be constructed with keys in the exact order shown above. The canonical JSON serialization preserves insertion order (see Section 1), so different key orders produce different hashes.

> **Why a JSON object instead of simple concatenation?** The receipt hash binds the `receipt_id` and `timestamp` to the component hashes, ensuring that two receipts with identical component hashes but different IDs or timestamps produce different receipt hashes. This prevents receipt substitution attacks.

---

## 3. Digital Signatures (Ed25519)

### Algorithm

| Property | Value |
|----------|-------|
| Algorithm | Ed25519 (RFC 8032) |
| Key size | 256-bit (32 bytes) |
| Signature size | 512-bit (64 bytes) |
| Library | Node.js `crypto.sign('ed25519')`, Python `cryptography.hazmat.primitives.asymmetric.ed25519` |

### What Is Signed

The **signed payload** is the receipt's `receipt_hash` field — the 64-character lowercase hex string.

```
signature = Ed25519.sign(private_key, UTF-8(receipt_hash))
```

The signature is computed over the **UTF-8 byte encoding** of the 64-character hex string, NOT the raw 32-byte hash bytes. This is intentional — it means the signed payload is human-readable and can be verified by inspecting the receipt JSON directly.

### Signature Fields

After signing, the receipt's `identity_binding` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `signature_hex` | string | 128-character hex encoding of the 64-byte Ed25519 signature |
| `public_key_hex` | string | 64-character hex encoding of the 32-byte Ed25519 public key |
| `signer_id` | string | Human-readable identifier of the signing entity (e.g., `"rio-gateway-prod"`) |
| `verification_method` | string | Always `"ed25519-nacl"` for this version |
| `signature_payload_hash` | string | Copy of `receipt_hash` — the value that was signed |
| `signed_at` | string | ISO 8601 timestamp of when the signature was created |

### Public Key Distribution

Verifiers obtain the signer's public key through one of:

1. **Embedded in receipt** — the `public_key_hex` field in `identity_binding`. This is sufficient for hash verification but requires an out-of-band trust anchor to confirm the key belongs to the claimed signer.
2. **Published key registry** — the signer publishes their public key at a well-known URL (e.g., `https://gateway.example.com/.well-known/rio-keys.json`). Verifiers fetch and cache this.
3. **Out-of-band exchange** — the signer provides their public key directly to the verifier (e.g., in a contract, configuration file, or API response).

For the reference implementation, the public key is embedded in the receipt. Production deployments SHOULD use a published key registry.

---

## 4. Verification Steps

A verifier performs these steps in order. If any step fails, the receipt is **INVALID**.

### Step 1: Schema Validation

Verify the receipt has the required fields:
- `receipt_id` (UUID string)
- `receipt_type` (`"action"` or `"governed_action"`)
- `hash_chain.intent_hash` (64-char hex)
- `hash_chain.execution_hash` (64-char hex)
- `hash_chain.receipt_hash` (64-char hex)
- `verification.chain_length` (3 or 5)
- `verification.chain_order` (array of hash field names)
- `verification.algorithm` (`"sha256"`)

### Step 2: Hash Recomputation

Recompute the receipt hash from the component hashes by constructing the `receipt_content` object:

```
if chain_length == 3:
    receipt_content = {
      receipt_id:     receipt.receipt_id,
      intent_hash:    receipt.hash_chain.intent_hash,
      execution_hash: receipt.hash_chain.execution_hash,
      timestamp:      receipt.timestamp
    }
elif chain_length == 5:
    receipt_content = {
      receipt_id:         receipt.receipt_id,
      intent_hash:        receipt.hash_chain.intent_hash,
      governance_hash:    receipt.hash_chain.governance_hash,
      authorization_hash: receipt.hash_chain.authorization_hash,
      execution_hash:     receipt.hash_chain.execution_hash,
      timestamp:          receipt.timestamp
    }

expected = SHA-256(canonical(receipt_content))
```

Compare `expected` with `receipt.hash_chain.receipt_hash`. If they differ → **INVALID**.

### Step 3: Signature Verification (if signed)

If `identity_binding.signature_hex` exists and is non-empty:

1. Reconstruct the Ed25519 public key from `identity_binding.public_key_hex`
2. The signed payload is `identity_binding.signature_payload_hash` (which should equal `receipt_hash`)
3. Verify: `Ed25519.verify(public_key, UTF-8(signature_payload_hash), signature_bytes)`
4. If verification fails → signature is **INVALID** (receipt hash may still be valid)

If `identity_binding` is absent or `signature_hex` is not present, the signature check is **skipped** (not failed). The receipt can still be hash-valid without a signature.

### Step 4: Ledger Cross-Verification (if ledger entry provided)

If a ledger entry is available:
1. Compare `receipt.hash_chain.receipt_hash` with `ledger_entry.receipt_hash`
2. Compare `receipt.hash_chain.intent_hash` with `ledger_entry.intent_hash` (if present)
3. Compare `receipt.intent_id` with `ledger_entry.intent_id`
4. If any mismatch → **INVALID**

### Step 5: Ledger Chain Verification (if full ledger provided)

For each entry in the ledger (starting from entry 0):
1. Entry 0: `prev_hash` must equal the genesis hash (`0000...0000`, 64 zeros)
2. Entry N (N > 0): `prev_hash` must equal `ledger_hash` of entry N-1
3. Recompute `ledger_hash` from the entry data and compare with stored value
4. If any mismatch → chain is **BROKEN** at that entry

---

## 5. Determinism Guarantees

The following properties ensure cross-system verification:

1. **Same input → same hash** — given identical intent/execution objects with keys in the same order, any conformant implementation produces the same SHA-256 hash.
2. **Same receipt_hash → same signature** — given the same private key and receipt_hash, Ed25519 produces the same signature (Ed25519 is deterministic per RFC 8032).
3. **Same ledger entries → same chain** — given the same sequence of entries, any implementation produces the same hash chain.
4. **No shared secrets required** — verification requires only the receipt JSON, the public key, and optionally the ledger. No API calls, no tokens, no session state.

---

## 6. Spec Ambiguities and Decisions

The following ambiguities were discovered during implementation and resolved as documented:

| Issue | Resolution | Rationale |
|-------|-----------|-----------|
| `receipt_hash` field ordering in schema | Not explicitly specified in schema; the hash chain section defines the computation order | The schema defines the fields; the signing rules define the computation. These are separate concerns. |
| `signature_hex` not in original schema | Added to `identity_binding` as an optional field | Required for Ed25519 signing. Optional because unsigned receipts are valid for hash-only verification. |
| Canonical JSON key order | Insertion order (ES2015+) | Both Node.js and Python 3.7+ preserve insertion order. Implementations MUST construct objects in spec-defined order. |
| `null` vs missing fields | `null` is included; missing is absent | `null` means "this field exists but has no value." Missing means "this field is not applicable." They produce different hashes. |
| Timestamp precision | ISO 8601 with milliseconds | `new Date().toISOString()` in Node.js produces millisecond precision. Python should use `.isoformat()` with matching precision. |
| Signed payload format | UTF-8 encoding of hex string, not raw bytes | Human-readable, inspectable, and avoids binary encoding ambiguities across languages. |

---

## 7. Implementation Checklist

For a new implementation to be conformant:

- [ ] SHA-256 hashing produces 64-char lowercase hex
- [ ] Canonical JSON uses no whitespace, preserves key insertion order
- [ ] Proof-layer receipt hash = SHA-256(canonical({receipt_id, intent_hash, execution_hash, timestamp}))
- [ ] Governed receipt hash = SHA-256(canonical({receipt_id, intent_hash, governance_hash, authorization_hash, execution_hash, timestamp}))
- [ ] Ed25519 key generation produces 32-byte keys
- [ ] Signing payload is UTF-8(receipt_hash), not raw bytes
- [ ] Signature is 64 bytes (128 hex chars)
- [ ] Verification recomputes receipt_hash and compares
- [ ] Signature verification uses embedded public_key_hex
- [ ] Unsigned receipts are valid (signature check skipped, not failed)
- [ ] Ledger chain uses prev_hash → ledger_hash linking
- [ ] Genesis entry has prev_hash = 64 zeros
- [ ] All 44 Node.js conformance tests pass
- [ ] All 29 Python conformance tests pass
