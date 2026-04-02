# RIO Signing Rules Specification

**Version:** 2.2.0
**Status:** Standard

---

## 1. Overview

The RIO Receipt Protocol uses two layers of cryptographic integrity:

1. **SHA-256 hash chains** — Every receipt and every ledger entry contains SHA-256 hashes that bind the components together. This is REQUIRED for all implementations.
2. **Ed25519 digital signatures** — Receipts MAY be signed with Ed25519 to bind them to a specific signer identity. This provides non-repudiation and is RECOMMENDED for production deployments.

---

## 2. Hash Algorithm

All hashes in the RIO Receipt Protocol MUST use SHA-256.

- Output: 256-bit (32-byte) hash
- Encoding: lowercase hexadecimal string (64 characters)
- Input: UTF-8 encoded string (typically JSON)

Implementations MUST NOT use MD5, SHA-1, or any other hash algorithm for receipt or ledger hashes.

---

## 3. Receipt Hash Chain

Each receipt contains a `hash_chain` object with hashes computed in order. The **core proof layer** requires two hashes (intent + execution). The **governance extension** adds two more (governance + authorization). All receipts include a final receipt hash.

### 3.1 Intent Hash (REQUIRED)

Computed from the canonical intent object:

```json
{
  "intent_id": "<intent_id>",
  "action": "<action>",
  "agent_id": "<agent_id>",
  "parameters": { ... },
  "timestamp": "<timestamp>"
}
```

### 3.2 Governance Hash (OPTIONAL — Governance Extension)

Present only when a governance layer evaluates the intent. Computed from the canonical governance decision:

```json
{
  "intent_id": "<intent_id>",
  "status": "<status>",
  "risk_level": "<risk_level>",
  "requires_approval": <boolean>,
  "checks": [ ... ]
}
```

### 3.3 Authorization Hash (OPTIONAL — Governance Extension)

Present only when human or policy authorization is required. Computed from the canonical authorization record:

```json
{
  "intent_id": "<intent_id>",
  "decision": "<decision>",
  "authorized_by": "<authorized_by>",
  "timestamp": "<timestamp>",
  "conditions": <conditions or null>
}
```

### 3.4 Execution Hash (REQUIRED)

Computed from the canonical execution record:

```json
{
  "intent_id": "<intent_id>",
  "action": "<action>",
  "result": "<result>",
  "connector": "<connector>",
  "timestamp": "<timestamp>"
}
```

### 3.5 Receipt Hash (REQUIRED)

Computed from the receipt metadata plus all preceding hashes that are present. The receipt's `verification.chain_order` array specifies which hashes are included.

**Proof-layer receipt (3-hash):**

```json
{
  "receipt_id": "<receipt_id>",
  "intent_hash": "<intent_hash>",
  "execution_hash": "<execution_hash>",
  "timestamp": "<timestamp>"
}
```

**Governed receipt (5-hash):**

```json
{
  "receipt_id": "<receipt_id>",
  "intent_hash": "<intent_hash>",
  "governance_hash": "<governance_hash>",
  "authorization_hash": "<authorization_hash>",
  "execution_hash": "<execution_hash>",
  "timestamp": "<timestamp>"
}
```

### 3.6 Canonical JSON Rules

All canonical JSON strings MUST be produced by `JSON.stringify()` (or equivalent) with:
- No whitespace formatting (no pretty-printing)
- Fields in the exact order specified above
- Null values represented as JSON `null`
- No additional fields beyond those specified

---

## 4. Ed25519 Digital Signatures

### 4.1 Key Generation

Ed25519 key pairs MUST be generated using a cryptographically secure random number generator. The recommended library is TweetNaCl (tweetnacl) or libsodium.

- Private key: 64 bytes (seed + public key, per NaCl convention)
- Public key: 32 bytes
- Storage encoding: Base64 for environment variables, hex for display

### 4.2 What Gets Signed

When Ed25519 signing is enabled, the signer signs the `receipt_hash` from the receipt's hash chain. This single signature covers the entire chain of custody because the receipt hash is derived from all preceding hashes.

```
Signature = Ed25519.sign(receipt_hash_bytes, private_key)
```

Where `receipt_hash_bytes` is the UTF-8 encoding of the 64-character hex receipt hash string.

### 4.3 Identity Binding

When a receipt is signed, the `identity_binding` object MUST be included:

| Field | Type | Description |
|-------|------|-------------|
| `signer_id` | string | Identifier of the signing authority |
| `public_key_hex` | string | Hex-encoded Ed25519 public key (64 chars) |
| `signature_hex` | string | Hex-encoded Ed25519 signature (128 chars / 64 bytes) |
| `signature_payload_hash` | string | The receipt_hash that was signed (MUST equal `hash_chain.receipt_hash`) |
| `verification_method` | string | MUST be `"ed25519-nacl"` |
| `ed25519_signed` | boolean | MUST be `true` |

### 4.4 Signature Verification

To verify a signed receipt:

1. Extract `identity_binding.public_key_hex` and decode from hex to bytes
2. Extract `identity_binding.signature_payload_hash` (this is the receipt_hash)
3. Independently recompute the receipt_hash using the hash chain (Section 3.5)
4. Verify that the recomputed hash matches `signature_payload_hash`
5. Verify the Ed25519 signature against the public key and the receipt_hash bytes

If any step fails, the receipt's signature is invalid.

### 4.5 Unsigned Receipts

Receipts without Ed25519 signatures are valid under this protocol. The hash chain alone provides tamper evidence. However, unsigned receipts do not provide non-repudiation — they prove the data has not been modified, but not who produced it.

For unsigned receipts, the `identity_binding` field SHOULD be omitted entirely, or if present, `ed25519_signed` MUST be `false`.

---

## 5. Key Management

### 5.1 Key Rotation

Implementations SHOULD support key rotation. When keys are rotated:
- The new key pair takes effect for all future receipts
- Previously signed receipts remain verifiable using the old public key
- Implementations MUST maintain a registry of historical public keys

### 5.2 Key Storage

Private keys MUST be stored securely:
- Environment variables (minimum)
- Hardware Security Module (recommended for production)
- Azure Key Vault, AWS KMS, or equivalent (recommended for cloud deployments)

Private keys MUST NEVER be:
- Committed to source control
- Logged to console or files
- Transmitted over unencrypted channels
- Stored in the same database as the ledger

---

## 6. Conformance

An implementation conforms to this specification if:

1. All hashes use SHA-256 with lowercase hex encoding
2. Canonical JSON follows the exact field order specified in Section 3
3. Receipt hashes are correctly computed from the chain (3-hash for proof-layer, 5-hash for governed)
4. If Ed25519 signing is implemented, signatures follow Section 4
5. Key management follows the requirements in Section 5
