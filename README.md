# RIO Receipt Protocol

**Cryptographic proof for AI actions.**

The RIO Receipt Protocol is an open standard for generating tamper-evident receipts that prove what an AI system did, when it did it, and whether a human approved it. Any AI system — whether built on OpenAI, Anthropic, Google, Cohere, open-source models, or custom agents — can implement RIO Receipts to produce a verifiable audit trail.

```
Intent → Governance → Authorization → Execution → Receipt → Ledger
  ↓          ↓             ↓              ↓           ↓         ↓
SHA-256   SHA-256       SHA-256        SHA-256     SHA-256   Hash Chain
```

Every stage is hashed. The receipt binds all hashes together. The ledger chains receipts into a tamper-evident sequence. If anything is altered after the fact, the math breaks and the tampering is detectable.

---

## Why This Exists

AI systems are making real decisions — sending emails, moving money, modifying records, scheduling meetings, writing code. Today, there is no standard way to prove:

- What action was taken
- Which AI agent proposed it
- What policy was evaluated
- Whether a human approved it
- What the outcome was
- That the record has not been altered

The RIO Receipt Protocol solves this. It gives every AI action a cryptographic receipt — a signed, hash-chained proof that the action was properly governed. The receipt is written to a tamper-evident ledger where any modification, deletion, insertion, or reordering is immediately detectable.

This is not a framework. It is not a product. It is a **protocol** — a set of rules for how receipts are structured, signed, chained, and verified. Any system can implement it.

---

## What Is in This Repo

```
rio-receipt-protocol/
├── spec/                        # The protocol specification
│   ├── receipt-schema.json      # JSON Schema for RIO Receipts (v2.1)
│   ├── ledger-format.md         # Ledger hash chain specification
│   └── signing-rules.md         # Signing and verification rules
├── reference/                   # Reference implementation (Node.js, zero dependencies)
│   ├── receipts.mjs             # Receipt generation and verification
│   ├── ledger.mjs               # Tamper-evident ledger (in-memory + JSON file)
│   └── verifier.mjs             # Standalone verification (receipts, chains, cross-checks)
├── cli/                         # Command-line verifier tool
│   └── verify.mjs               # rio-verify CLI
├── tests/                       # Conformance test suite
│   └── conformance.test.mjs     # 45 tests across 8 categories
├── examples/                    # Usage examples
│   └── basic-usage.mjs          # Complete flow: intent → receipt → ledger → verify
└── package.json
```

The reference implementation has **zero external dependencies**. It uses only Node.js built-in modules (`crypto`, `fs`). The spec documents define the protocol independent of any implementation language.

---

## Quick Start

### Run the Example

```bash
git clone https://github.com/bkr1297-RIO/rio-receipt-protocol.git
cd rio-receipt-protocol
node examples/basic-usage.mjs
```

This walks through the complete flow: an AI agent proposes an action, governance evaluates it, authorization is granted, the action executes, a receipt is generated, the receipt is written to a ledger, and everything is verified.

### Run the Conformance Tests

```bash
node tests/conformance.test.mjs
```

45 tests across 8 categories: SHA-256 hashing, stage hash functions, receipt generation, receipt verification, ledger hash chain, tamper detection, cross-verification, and edge cases. Exit code 0 means the implementation conforms to the protocol.

### Verify a Live Gateway

```bash
node cli/verify.mjs remote https://rio-gateway.onrender.com
```

The CLI connects to a running RIO Gateway, checks its health, and verifies any available receipts — all locally using SHA-256. No data is sent to any external service.

### Use in Your Own Code

```javascript
import { generateReceipt, verifyReceipt, hashIntent, hashGovernance,
         hashAuthorization, hashExecution } from "@rio-protocol/receipt";
import { createLedger } from "@rio-protocol/receipt/ledger";
import { verifyChain } from "@rio-protocol/receipt/verifier";

// Hash each stage of the AI action
const intentHash = hashIntent({ intent_id, action, agent_id, parameters, timestamp });
const governanceHash = hashGovernance({ intent_id, status, risk_level, requires_approval, checks });
const authorizationHash = hashAuthorization({ intent_id, decision, authorized_by, timestamp });
const executionHash = hashExecution({ intent_id, action, result, connector, timestamp });

// Generate the receipt
const receipt = generateReceipt({
  intent_hash: intentHash,
  governance_hash: governanceHash,
  authorization_hash: authorizationHash,
  execution_hash: executionHash,
  intent_id, action, agent_id, authorized_by,
});

// Verify the receipt
const result = verifyReceipt(receipt);
console.log(result.valid); // true

// Write to a ledger and verify the chain
const ledger = createLedger({ filePath: "./my-ledger.json" });
ledger.append({ intent_id, action, agent_id, status: "executed", detail: "...",
                receipt_hash: receipt.hash_chain.receipt_hash });
const chainResult = ledger.verifyChain();
console.log(chainResult.valid); // true
```

---

## The Receipt

A RIO Receipt is a JSON object that binds together the hashes of every stage in a governed AI action:

```json
{
  "receipt_id": "8494b6e4-f50e-4788-9a3f-50296f276263",
  "receipt_type": "governed_action",
  "intent_id": "e3a19336-dd82-496f-812b-e6f1636e96f2",
  "action": "send_email",
  "agent_id": "copilot-agent-001",
  "authorized_by": "POLICY:auto_approve_low_risk",
  "timestamp": "2026-04-01T20:15:00.000Z",
  "hash_chain": {
    "intent_hash": "a1b2c3...64 hex chars",
    "governance_hash": "d4e5f6...64 hex chars",
    "authorization_hash": "789abc...64 hex chars",
    "execution_hash": "def012...64 hex chars",
    "receipt_hash": "345678...64 hex chars"
  },
  "verification": {
    "algorithm": "SHA-256",
    "chain_length": 5,
    "chain_order": ["intent_hash", "governance_hash", "authorization_hash",
                    "execution_hash", "receipt_hash"]
  }
}
```

The `receipt_hash` is computed from the `receipt_id`, all four preceding hashes, and the `timestamp`. Changing any field invalidates the hash.

### v2.1 Extensions (Optional, Backward Compatible)

**Ingestion Provenance** — tracks where the intent originated:

```json
"ingestion": {
  "source": "api",
  "channel": "POST /intent",
  "source_message_id": "msg-123",
  "timestamp": "2026-04-01T20:14:59.000Z"
}
```

**Identity Binding** — Ed25519 cryptographic signature proof:

```json
"identity_binding": {
  "signer_id": "human-root",
  "public_key_hex": "a1b2c3...64 hex chars",
  "signature_payload_hash": "d4e5f6...64 hex chars",
  "verification_method": "ed25519-nacl",
  "ed25519_signed": true
}
```

---

## The Ledger

The ledger is an append-only, hash-chained sequence of entries. Each entry contains:

| Field | Description |
|-------|-------------|
| `entry_id` | UUID for this entry |
| `prev_hash` | SHA-256 hash of the previous entry (genesis = 64 zeros) |
| `ledger_hash` | SHA-256 hash of this entry's canonical content |
| `timestamp` | ISO 8601 timestamp |
| `intent_id` | The intent this entry relates to |
| `action` | The action type |
| `agent_id` | The agent that requested the action |
| `status` | Entry status (submitted, governed, authorized, executed, denied, blocked) |
| `detail` | Human-readable description |
| `receipt_hash` | Hash of the associated receipt (if applicable) |

The hash chain makes the ledger tamper-evident:

- **Modify** an entry → its hash changes → the next entry's `prev_hash` no longer matches
- **Delete** an entry → the chain breaks at the gap
- **Insert** an entry → the surrounding entries' hashes no longer link
- **Reorder** entries → `prev_hash` linkages break

The conformance tests verify all four tamper scenarios.

---

## The Verifier

The verifier CLI (`rio-verify`) is a standalone tool for independent verification:

```bash
# Verify a single receipt
rio-verify receipt ./my-receipt.json

# Verify a ledger hash chain
rio-verify chain ./ledger-export.json

# Verify multiple receipts
rio-verify batch ./receipts.json

# Cross-verify a receipt against its ledger entry
rio-verify cross ./receipt.json ./entry.json

# Verify a live RIO Gateway
rio-verify remote https://rio-gateway.onrender.com
```

All verification is performed locally using SHA-256. No data is sent to any external service. The verifier can be run by any third party — auditors, regulators, customers — without access to the original system.

---

## Conformance

The conformance test suite (`tests/conformance.test.mjs`) validates 8 categories:

| Suite | Tests | What It Proves |
|-------|-------|----------------|
| SHA-256 Hashing | 4 | Hash function produces correct, deterministic, 64-char hex output |
| Stage Hash Functions | 5 | Intent, governance, authorization, and execution hashes are valid |
| Receipt Generation | 8 | Receipts contain all required fields, types, and optional v2.1 extensions |
| Receipt Verification | 8 | Valid receipts pass; tampered receipts fail; batch verification works |
| Ledger Hash Chain | 6 | Genesis linkage, multi-entry chains, and standalone verifier agreement |
| Tamper Detection | 5 | Modification, hash tampering, insertion, deletion, and reordering are caught |
| Cross-Verification | 3 | Receipt-to-ledger matching and mismatch detection |
| Edge Cases | 5 | v2.1 fields, backward compatibility, empty chains, invalid input |

Any implementation of the RIO Receipt Protocol can run these tests to prove conformance. The test suite is the contract.

---

## Who This Is For

**Enterprise teams** deploying AI agents that need cryptographic audit trails for compliance (SOC 2, ISO 27001, GDPR Article 22, EU AI Act).

**AI platform builders** who want to add verifiable governance to their agent frameworks without building the proof layer from scratch.

**Consultants and integrators** building governed AI workflows for clients who need to prove what their AI systems did.

**Auditors and regulators** who need to independently verify AI action records without trusting the system that produced them.

---

## Relationship to the RIO System

This protocol is the open proof layer. The [RIO System](https://github.com/bkr1297-RIO/rio-system) is the full governance platform built on top of it:

| Layer | What It Does | Status |
|-------|-------------|--------|
| **RIO Receipt Protocol** (this repo) | Receipt schema, ledger, verifier, conformance tests | Open standard |
| **RIO Gateway** | Full governance pipeline with policy engine, RBAC, Ed25519 signing | Reference implementation |
| **RIO Corpus** | Constitutional governance documents, policies, role definitions | Governing framework |
| **ONE Interface** | Human-in-the-loop approval, dashboard, agent management | Commercial platform |

You can use the receipt protocol without the gateway. You can use the gateway without ONE. Each layer is independently useful.

---

## Security Properties

The protocol provides the following security guarantees:

**Tamper evidence** — Any modification to a receipt or ledger entry is detectable by recomputing the SHA-256 hash.

**Chain integrity** — The hash chain ensures entries cannot be inserted, deleted, or reordered without breaking the linkage.

**Independent verification** — Any third party can verify receipts and chains using only the verifier and the data. No access to the original system is required.

**Non-repudiation** (with Ed25519) — When identity binding is used, the signer cannot deny having authorized the action.

**Backward compatibility** — v2.1 extensions (ingestion, identity_binding) are optional. v2.0 receipts remain valid.

---

## Specification Documents

The formal protocol specifications are in the `spec/` directory:

- **[receipt-schema.json](spec/receipt-schema.json)** — JSON Schema defining the receipt format, all fields, types, and constraints
- **[ledger-format.md](spec/ledger-format.md)** — Ledger entry structure, hash chain rules, genesis hash, canonical field ordering
- **[signing-rules.md](spec/signing-rules.md)** — Signing algorithms, key management, verification procedures, Ed25519 requirements

These documents define the protocol independent of the reference implementation. Any language or platform can implement the protocol by following these specs and passing the conformance tests.

---

## License

Dual-licensed under MIT and Apache 2.0. Use whichever fits your project.
