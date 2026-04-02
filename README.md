# RIO Receipt Protocol

**Cryptographic proof for AI actions. Open standard. Zero dependencies.**

---

## What Is a RIO Receipt?

A RIO Receipt is a cryptographic record of an AI action, written to a tamper-evident ledger. It allows an organization to later prove exactly what an AI system did, when it did it, which system was responsible, and that the record has not been altered.

The RIO Receipt Protocol acts as a **"Layer 3" proof layer** that sits beneath application logic, turning AI-assisted decisions and actions into verifiable, auditable records.

**A standard RIO Receipt proves:**

- What action was taken
- Which AI or system initiated it
- When it happened
- What the result was
- That the record has not been altered

When a governance layer is present (such as the full RIO platform), receipts can also prove whether a human approved the action and under what policy. But **the core protocol does not require governance or human approval** — it works as standalone proof infrastructure for any AI system.

Any AI system — whether built on OpenAI, Anthropic, Google, Cohere, open-source models, or custom agents — can implement RIO Receipts to produce a verifiable audit trail.

---

## How It Works

### Core Proof Layer (Open Standard)

```
Intent → Execution → Receipt → Ledger
  ↓          ↓           ↓         ↓
SHA-256   SHA-256     SHA-256   Hash Chain
```

An AI system proposes an action (intent). The action executes. A receipt is generated binding the intent hash and execution hash together. The receipt is written to a tamper-evident ledger. **Three hashes, one chain, complete proof.**

### With Governance Extension (Optional)

```
Intent → Governance → Authorization → Execution → Receipt → Ledger
  ↓          ↓             ↓              ↓           ↓         ↓
SHA-256   SHA-256       SHA-256        SHA-256     SHA-256   Hash Chain
```

Systems that implement human approval workflows can add governance and authorization hashes. The receipt expands from a 3-hash chain to a 5-hash chain. Both types coexist in the same ledger.

This is not a framework. It is not a product. It is a **protocol** — a set of rules for how receipts are structured, hashed, chained, and verified. Any system can implement it.

---

## Why This Exists

AI systems are making real decisions — sending emails, moving money, modifying records, scheduling meetings, writing code. Today, there is no standard way to prove any of it happened the way it was supposed to.

Prompt-level guardrails are bypassable. Policy documents are advisory. Audit logs can be incomplete or fabricated after the fact. Without a proof layer that is architecturally separate from the AI itself, every deployed agent is a liability.

The RIO Receipt Protocol gives every AI action a cryptographic receipt — a hash-chained proof that the action occurred as recorded. The receipt is written to a tamper-evident ledger where any modification, deletion, insertion, or reordering is immediately detectable.

---

## What Is in This Repo

```
rio-receipt-protocol/
├── index.mjs                    # npm package entry point (unified exports)
├── index.d.ts                   # TypeScript type declarations
├── spec/                        # The protocol specification
│   ├── receipt-schema.json      # JSON Schema for RIO Receipts (v2.2)
│   ├── ledger-format.md         # Ledger hash chain specification
│   └── signing-rules.md         # Signing and verification rules
├── reference/                   # Reference implementation (Node.js, zero dependencies)
│   ├── receipts.mjs             # Receipt generation and verification
│   ├── ledger.mjs               # Tamper-evident ledger (in-memory + JSON file)
│   ├── verifier.mjs             # Standalone verification (receipts, chains, cross-checks)
│   └── web_verifier.js          # Browser-compatible verifier (Web Crypto API)
├── python/                      # Python package (pip install rio-receipt-protocol)
│   ├── rio_receipt_protocol/    # Python module (zero required dependencies)
│   ├── tests/                   # Python conformance tests (29 tests)
│   └── pyproject.toml           # PyPI packaging configuration
├── cli/                         # Command-line verifier tool
│   └── verify.mjs               # rio-verify CLI
├── docs/                        # Documentation
│   └── integration-guide.md     # OpenAI, Anthropic, LangChain integration examples
├── tests/                       # Node.js conformance test suite
│   └── conformance.test.mjs     # 29 tests across 8 categories
├── examples/                    # Usage examples
│   └── basic-usage.mjs          # Complete flow: intent → receipt → ledger → verify
├── package.json                 # npm package configuration
└── CHANGELOG.md                 # Version history
```

Both the Node.js and Python implementations have **zero required dependencies**. The Node.js package uses only `node:crypto` and `node:fs`. The Python package uses only the standard library. The spec documents define the protocol independent of any implementation language.

---

## Quick Start

### Install

```bash
# Node.js / npm
npm install rio-receipt-protocol

# Python / pip
pip install rio-receipt-protocol
```

Both packages have **zero required dependencies**. The Node.js package uses only `node:crypto` and `node:fs`. The Python package uses only the standard library.

### Node.js — Hello World

```javascript
import {
  hashIntent, hashExecution, generateReceipt,
  verifyReceipt, createLedger
} from "rio-receipt-protocol";

// 1. Hash the intent (what was requested)
const intentHash = hashIntent({
  intent_id: "i-001", action: "send_email", agent_id: "agent-1",
  parameters: { to: "user@example.com", subject: "Hello" },
  timestamp: new Date().toISOString(),
});

// 2. Hash the execution (what actually happened)
const executionHash = hashExecution({
  intent_id: "i-001", action: "send_email",
  result: "sent", connector: "smtp",
  timestamp: new Date().toISOString(),
});

// 3. Generate a receipt binding both hashes
const receipt = generateReceipt({
  intentHash, executionHash,
  intentId: "i-001", action: "send_email", agentId: "agent-1",
});

// 4. Verify it
console.log(verifyReceipt(receipt).valid); // true

// 5. Write to a tamper-evident ledger
const ledger = createLedger();
ledger.append({
  intentId: "i-001", action: "send_email", agentId: "agent-1",
  status: "executed", detail: "Email sent",
  receiptHash: receipt.hash_chain.receipt_hash,
});
console.log(ledger.verifyChain().valid); // true
```

### Python — Hello World

```python
from rio_receipt_protocol import (
    hash_intent, hash_execution, generate_receipt,
    verify_receipt, create_ledger
)

# 1. Hash the intent
intent_hash = hash_intent(
    intent_id="i-001", action="send_email", agent_id="agent-1",
    parameters={"to": "user@example.com", "subject": "Hello"},
    timestamp="2026-04-01T00:00:00.000Z",
)

# 2. Hash the execution
execution_hash = hash_execution(
    intent_id="i-001", action="send_email",
    result="sent", connector="smtp",
    timestamp="2026-04-01T00:00:01.000Z",
)

# 3. Generate and verify a receipt
receipt = generate_receipt(
    intent_hash=intent_hash, execution_hash=execution_hash,
    intent_id="i-001", action="send_email", agent_id="agent-1",
)
assert verify_receipt(receipt)["valid"]

# 4. Write to a tamper-evident ledger
ledger = create_ledger()
ledger.append(
    intent_id="i-001", action="send_email", agent_id="agent-1",
    status="executed", detail="Email sent",
    receipt_hash=receipt["hash_chain"]["receipt_hash"],
)
assert ledger.verify_chain()["valid"]
```

Three hashes, one receipt, one ledger entry. Your AI system now produces verifiable proof of every action.

### Run From Source

```bash
git clone https://github.com/bkr1297-RIO/rio-receipt-protocol.git
cd rio-receipt-protocol

# Run the example
node examples/basic-usage.mjs

# Run conformance tests (Node.js — 29 tests)
node tests/conformance.test.mjs

# Run conformance tests (Python — 29 tests)
cd python && PYTHONPATH=. python3 tests/test_conformance.py

# Verify a live gateway
node cli/verify.mjs remote https://rio-gateway.onrender.com
```

### Framework Integration

See the **[Integration Guide](docs/integration-guide.md)** for complete examples with:

- **OpenAI** (Node.js + Python)
- **Anthropic Claude** (Node.js + Python)
- **LangChain** (callback handler for automatic receipt generation)
- **Multi-agent systems** (shared ledger across agents)
- **Governed receipts** (human-in-the-loop 5-hash chains)

---

## The Receipt

### Proof-Layer Receipt (Core)

The minimal receipt — proof of what happened, no governance required:

```json
{
  "receipt_id": "8494b6e4-f50e-4788-9a3f-50296f276263",
  "receipt_type": "action",
  "intent_id": "e3a19336-dd82-496f-812b-e6f1636e96f2",
  "action": "send_email",
  "agent_id": "copilot-agent-001",
  "authorized_by": null,
  "timestamp": "2026-04-01T20:15:00.000Z",
  "hash_chain": {
    "intent_hash": "a1b2c3...64 hex chars",
    "governance_hash": null,
    "authorization_hash": null,
    "execution_hash": "def012...64 hex chars",
    "receipt_hash": "345678...64 hex chars"
  },
  "verification": {
    "algorithm": "SHA-256",
    "chain_length": 3,
    "chain_order": ["intent_hash", "execution_hash", "receipt_hash"]
  }
}
```

The `receipt_hash` is computed from the `receipt_id`, the intent and execution hashes, and the `timestamp`. Changing any field invalidates the hash.

### Governed Receipt (Extension)

When governance and human approval are present, the receipt expands:

```json
{
  "receipt_type": "governed_action",
  "authorized_by": "HUMAN:cfo@example.com",
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

Both receipt types coexist in the same ledger. The verifier handles both automatically.

### Optional Extensions (v2.2, Backward Compatible)

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
| `status` | Entry status (submitted, executed, denied, blocked) |
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
| Proof-Layer Receipts | 5 | Core 3-hash receipts generate and verify correctly |
| Governed Receipts | 4 | Extended 5-hash receipts with governance/authorization |
| Hash Integrity | 5 | SHA-256 produces correct, deterministic output; tampering detected |
| Ledger Operations | 5 | Genesis linkage, multi-entry chains, standalone verifier agreement |
| Cross-Verification | 2 | Receipt-to-ledger matching and mismatch detection |
| Batch Verification | 2 | Multi-receipt verification with tamper detection |
| Mixed Receipt Types | 2 | Proof-layer and governed receipts coexist in one ledger |
| Optional Extensions | 3 | Ingestion provenance, identity binding, backward compatibility |

Any implementation of the RIO Receipt Protocol can run these tests to prove conformance. The test suite is the contract.

---

## Who This Is For

**Any team deploying AI agents** that needs to prove what their AI systems did. The proof layer works regardless of which AI provider, framework, or orchestration system you use.

**Enterprise teams** that need cryptographic audit trails for compliance (SOC 2, ISO 27001, GDPR Article 22, EU AI Act).

**AI platform builders** who want to add verifiable proof to their agent frameworks without building the proof layer from scratch.

**Consultants and integrators** building AI workflows for clients who need accountability and audit trails.

**Auditors and regulators** who need to independently verify AI action records without trusting the system that produced them.

---

## What You Can Build With This

- **Audit trail for AI agents** — Every action your AI takes gets a receipt. Every receipt goes on the ledger. You can prove the full history.
- **Compliance infrastructure** — Plug receipts into your SOC 2 / ISO 27001 / EU AI Act evidence pipeline.
- **Customer-facing proof** — Show your customers verifiable proof of what your AI did on their behalf.
- **Multi-agent accountability** — When multiple AI agents collaborate, each action gets its own receipt. The ledger shows who did what.
- **Governance layer** (with extension) — Add human approval workflows on top of the proof layer. The full RIO platform does this.

---

## Relationship to the RIO System

This protocol is the **open proof layer**. The [RIO System](https://github.com/bkr1297-RIO/rio-system) is the full governance platform built on top of it:

| Layer | What It Does | Status |
|-------|-------------|--------|
| **RIO Receipt Protocol** (this repo) | Receipt schema, ledger, verifier, conformance tests | **Open standard** |
| **RIO Gateway** | Full governance pipeline with policy engine, RBAC, Ed25519 signing | Reference implementation |
| **RIO Corpus** | Constitutional governance documents, policies, role definitions | Governing framework |
| **ONE Interface** | Human-in-the-loop approval, dashboard, agent management | Commercial platform |

You can use the receipt protocol without the gateway. You can use the gateway without ONE. Each layer is independently useful.

The full RIO authorization and commit protocol is specified in the [RIO Governance Protocol Internet-Draft](https://github.com/bkr1297-RIO/rio-system/blob/main/spec/draft-rio-governance-00.md), covering token models, state machines, kill switch semantics, and policy binding. The receipt protocol defined in this repo is the open proof layer that the governance protocol builds on.

In simple terms:
- **Receipts prove** (open — this repo)
- **Ledger remembers** (open — this repo)
- AI proposes (application layer)
- Governance decides (commercial)
- Humans approve when required (commercial)
- Connectors execute (commercial)

**For platform builders and enterprise teams:** If you are building governance, compliance, or agent orchestration infrastructure and want to integrate or build on the RIO protocol, contact us at riomethod5@gmail.com.

---

## Security Properties

The protocol provides the following security guarantees:

**Tamper evidence** — Any modification to a receipt or ledger entry is detectable by recomputing the SHA-256 hash.

**Chain integrity** — The hash chain ensures entries cannot be inserted, deleted, or reordered without breaking the linkage.

**Independent verification** — Any third party can verify receipts and chains using only the verifier and the data. No access to the original system is required.

**Non-repudiation** (with Ed25519 extension) — When identity binding is used, the signer cannot deny having authorized the action.

**Backward compatibility** — v2.2 extensions (ingestion, identity_binding, governed receipts) are optional. Core proof-layer receipts remain valid.

---

## Specification Documents

The formal protocol specifications are in the `spec/` directory:

- **[receipt-schema.json](spec/receipt-schema.json)** — JSON Schema defining the receipt format, required and optional fields, types, and constraints
- **[ledger-format.md](spec/ledger-format.md)** — Ledger entry structure, hash chain rules, genesis hash, canonical field ordering
- **[signing-rules.md](spec/signing-rules.md)** — Signing algorithms, key management, verification procedures, Ed25519 requirements

These documents define the protocol independent of the reference implementation. Any language or platform can implement the protocol by following these specs and passing the conformance tests.

For the full RIO governance protocol specification (authorization tokens, state machines, kill switches, policy binding), see the [Internet-Draft](https://github.com/bkr1297-RIO/rio-system/blob/main/spec/draft-rio-governance-00.md) in the RIO System repository.

---

## License

Dual-licensed under MIT and Apache 2.0. Use whichever fits your project.
