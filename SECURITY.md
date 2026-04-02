# Security Policy

## 1. Vulnerability Reporting

We take the security of the RIO Receipt Protocol seriously. If you discover a security vulnerability, please report it responsibly.

**How to Report:**

- **Email:** riomethod5@gmail.com (preferred for sensitive information)
- **GitHub Issues:** For non-sensitive bugs, open a standard issue. Do not disclose exploitable vulnerabilities in public issues.

Please include the following in your report:

- A clear description of the vulnerability.
- Steps to reproduce the issue.
- The potential impact.
- Any proof-of-concept code.

We will acknowledge your report within 48 hours and provide a detailed response within 5 business days. A dedicated security email (security@rioprotocol.org) will be established as the project matures.

## 2. Security Guarantees

The RIO Receipt Protocol provides the following cryptographic guarantees when implemented correctly:

**Tamper Evidence.** Every receipt contains a `receipt_hash` computed from the ordered concatenation of its component hashes. Any modification to a receipt's fields — or to any entry in a ledger chain — is detectable by recomputing hashes and comparing them to the stored values.

**Chain Integrity.** The ledger's `prev_hash` linkage ensures that the ordering of entries cannot be altered, and no entry can be inserted, removed, or reordered without breaking the chain. Verification requires only the ledger data itself — no access to the original system is needed.

**Non-Repudiation (with Ed25519 Signing).** When Ed25519 digital signatures are used via the `identity_binding` extension, a signed receipt is cryptographically bound to a specific public key. The signer cannot later deny having produced the receipt, provided the private key was not compromised.

**Independent Verifiability.** Any party — auditor, regulator, counterparty, or automated system — can verify receipts and ledger chains using only the receipt data and the open-source verifier. No API access, credentials, or trust relationship with the generating system is required.

## 3. Threat Model

### 3.1 Assumptions

The protocol's guarantees hold under these assumptions:

- **Signer keys are secure.** Private keys used for Ed25519 signing are protected from unauthorized access. Key management (HSM, rotation, revocation) is outside the protocol scope but is addressed in `spec/signing-rules.md` Section 5.
- **Canonicalization is correct.** Implementations follow the canonical JSON field ordering defined in `spec/signing-rules.md` Section 3. Deviations will produce different hashes and cause verification failures.
- **Ledger storage is append-only.** The underlying storage mechanism enforces append-only semantics. The protocol detects tampering but does not prevent a storage system from silently discarding entries.
- **Cryptographic primitives are sound.** SHA-256 and Ed25519 are assumed to be computationally secure. If either is broken, the protocol's guarantees are void.

### 3.2 Explicit Limitations

The following are **not** protected by the protocol. Enterprise teams evaluating this standard should understand these boundaries clearly.

**Fabrication.** The protocol does not prevent a malicious or compromised system from generating a valid receipt for an action that never happened. The hash chain proves internal consistency — that the hashes match each other — but it does not prove truthfulness — that the described action actually occurred. Truthfulness requires trust in the generating system, or external attestation (e.g., a co-signature from the receiving system, or a third-party witness).

**Compromised Signer.** If an Ed25519 private key is compromised, an attacker can sign fraudulent receipts that will pass verification. The protocol does not include key revocation or rotation mechanisms — those are the responsibility of the implementing system's key management infrastructure.

**Timestamp Accuracy.** The protocol records timestamps provided by the generating system but does not verify them against an external time source. A compromised system could backdate or future-date receipts. Trusted timestamping (e.g., RFC 3161 timestamp authorities) is outside the protocol scope but can be layered on top.

**Availability.** The protocol does not guarantee that receipts or ledger entries will be stored, replicated, or made available. Persistence and redundancy are the responsibility of the implementing system.

**Privacy.** Receipt contents — including action type, agent ID, parameters, and timestamps — are stored in plaintext and are not encrypted. The protocol is an audit trail, not a privacy layer. Systems handling sensitive data should consider encrypting receipt payloads before hashing, or storing receipts in access-controlled environments.

### 3.3 Out-of-Scope Threats

The following are explicitly outside the protocol's threat model:

- Attacks on the underlying cryptographic primitives (SHA-256, Ed25519).
- Compromise of the operating system or hardware where the protocol runs.
- Social engineering attacks against users or operators.
- Denial-of-service attacks against verification endpoints.

## 4. Scope

This security policy applies to the core RIO Receipt Protocol specification, its reference implementations (JavaScript, Python), and the associated CLI tools within this repository.

**In Scope:**

- Receipt schema and hash computation (`spec/receipt-schema.json`, `spec/signing-rules.md`)
- Ledger format and chain verification (`spec/ledger-format.md`)
- Reference implementations (`reference/receipts.mjs`, `reference/verifier.mjs`, `reference/ledger.mjs`)
- Python package (`python/rio_receipt_protocol/`)
- CLI verifier (`cli/verify.mjs`)
- Conformance tests (`tests/`)

**Out of Scope:**

- Security of external systems that integrate with the RIO Receipt Protocol.
- Key management systems (HSMs, cloud key vaults) used by implementing systems.
- Application-level vulnerabilities in systems built on top of the protocol.
- The RIO Platform's governance, authorization, and execution control layers (those have their own security policies).
