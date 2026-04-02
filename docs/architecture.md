# Architecture

This document describes where the RIO Receipt Protocol sits in a system, what it does, and what it does not do.

---

## Protocol Scope

The RIO Receipt Protocol defines three things:

1. **Receipt format** — how to structure a cryptographic proof of an AI action
2. **Ledger format** — how to chain receipts into a tamper-evident sequence
3. **Verification rules** — how to independently verify receipts and chains

The protocol does not define how actions are proposed, approved, or executed. It only defines how to prove that they happened.

---

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│         (Your AI agents, workflows, orchestrators)       │
│                                                         │
│   ┌─────────┐   ┌──────────┐   ┌───────────────────┐   │
│   │ OpenAI  │   │ Anthropic│   │ Custom Agents     │   │
│   │ Agent   │   │ Agent    │   │ (LangChain, etc.) │   │
│   └────┬────┘   └────┬─────┘   └────────┬──────────┘   │
│        │              │                  │              │
│        └──────────────┼──────────────────┘              │
│                       │                                 │
│                       ▼                                 │
├───────────────────────────────────────────────────────── │
│              Governance Layer (Optional)                 │
│     (Policy engine, risk assessment, human approval)     │
│                                                         │
│   ┌──────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │ Policy   │  │ Risk         │  │ Human          │   │
│   │ Engine   │  │ Assessment   │  │ Approval       │   │
│   └────┬─────┘  └──────┬───────┘  └───────┬────────┘   │
│        │               │                  │             │
│        └───────────────┼──────────────────┘             │
│                        │                                │
│                        ▼                                │
├─────────────────────────────────────────────────────────┤
│           ┌────────────────────────────────┐            │
│           │   RIO Receipt Protocol         │            │
│           │   ════════════════════         │            │
│           │                                │            │
│           │   hashIntent()                 │            │
│           │   hashExecution()              │            │
│           │   generateReceipt()            │            │
│           │   verifyReceipt()              │            │
│           │   createLedger()               │            │
│           │   ledger.append()              │            │
│           │   ledger.verifyChain()         │            │
│           │                                │            │
│           │   ← THIS REPO                  │            │
│           └────────────────────────────────┘            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    Storage Layer                         │
│          (Your choice: file, database, cloud)            │
│                                                         │
│   ┌──────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │ JSON     │  │ PostgreSQL   │  │ S3 / Cloud     │   │
│   │ File     │  │              │  │ Storage        │   │
│   └──────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Proof-Layer Receipt (3-Hash)

This is the core flow. No governance layer required.

```
1. AI agent proposes an action
   │
   ▼
2. hashIntent({ intent_id, action, agent_id, parameters, timestamp })
   │  → intent_hash (SHA-256)
   │
   ▼
3. Action executes (your application handles this)
   │
   ▼
4. hashExecution({ intent_id, action, result, connector, timestamp })
   │  → execution_hash (SHA-256)
   │
   ▼
5. generateReceipt({ intentHash, executionHash, intentId, action, agentId })
   │  → receipt with receipt_hash = SHA-256(receipt_id + intent_hash + execution_hash + timestamp)
   │  → chain_order: [intent_hash, execution_hash, receipt_hash]
   │
   ▼
6. ledger.append({ intentId, action, agentId, status, detail, receiptHash })
   │  → ledger entry with ledger_hash and prev_hash linkage
   │
   ▼
7. verifyReceipt(receipt)  → { valid: true }
   ledger.verifyChain()    → { valid: true, length: N }
```

### Governed Receipt (5-Hash)

When a governance layer is present, two additional hashes are inserted between intent and execution.

```
1. AI agent proposes an action
   │
   ▼
2. hashIntent() → intent_hash
   │
   ▼
3. Governance layer evaluates risk and policy
   │  → governance_hash (SHA-256 of policy evaluation)
   │
   ▼
4. Human approves (or system auto-approves based on policy)
   │  → authorization_hash (SHA-256 of approval record)
   │
   ▼
5. Action executes
   │  → execution_hash
   │
   ▼
6. generateReceipt({ intentHash, executionHash, governanceHash, authorizationHash, ... })
   │  → receipt_hash = SHA-256(receipt_id + all five hashes + timestamp)
   │  → chain_order: [intent_hash, governance_hash, authorization_hash, execution_hash, receipt_hash]
   │
   ▼
7. Ledger append and verification (same as proof-layer)
```

Both receipt types coexist in the same ledger. The verifier handles both automatically by reading the `verification.chain_order` field.

---

## What the Protocol Controls

| Concern | Protocol Responsibility |
|---------|------------------------|
| Receipt structure | Defines all required and optional fields |
| Hash computation | Specifies SHA-256 inputs and canonical ordering |
| Chain integrity | Defines `prev_hash` linkage rules for the ledger |
| Verification | Provides deterministic verification algorithms |
| Tamper detection | Guarantees that any modification breaks the chain |

## What the Protocol Does Not Control

| Concern | Your Responsibility |
|---------|---------------------|
| Action execution | The protocol records actions; it does not execute them |
| Policy decisions | The protocol records governance hashes; it does not define policies |
| Storage backend | The protocol defines the data format; you choose where to store it |
| Access control | The protocol does not authenticate users or agents |
| Key management | Ed25519 signing is optional; key storage is your responsibility |
| Network transport | The protocol is transport-agnostic; use HTTP, gRPC, message queues, or files |

---

## Integration Points

The protocol is designed to be embedded, not deployed as a standalone service.

**Minimal integration** (proof-layer only): Call `hashIntent()` before execution, `hashExecution()` after execution, `generateReceipt()` to bind them, and `ledger.append()` to record it. Four function calls per action.

**Framework integration**: Wrap the four calls in a middleware, callback handler, or decorator. The [Integration Guide](integration-guide.md) shows examples for OpenAI, Anthropic, and LangChain.

**Governance integration**: If your system has an approval workflow, compute `governanceHash` and `authorizationHash` between intent and execution. Pass all four hashes to `generateReceipt()`.

**Verification integration**: Run `verifyReceipt()` and `ledger.verifyChain()` as part of your audit pipeline. The CLI tool (`rio-verify`) can be used by external auditors without access to your system.

---

## Relationship to the Full RIO System

The RIO Receipt Protocol is the open proof layer. The full [RIO System](https://github.com/bkr1297-RIO/rio-system) builds on top of it:

```
┌──────────────────────────────────────────────┐
│  ONE Interface (Human-in-the-loop dashboard) │  ← Commercial
├──────────────────────────────────────────────┤
│  RIO Gateway (Policy, RBAC, Ed25519 signing) │  ← Reference implementation
├──────────────────────────────────────────────┤
│  RIO Corpus (Constitutional governance docs) │  ← Governing framework
├══════════════════════════════════════════════╡
│  RIO Receipt Protocol (This repo)            │  ← Open standard
│  Receipts · Ledger · Verifier · Conformance  │
└──────────────────────────────────────────────┘
```

You can use the receipt protocol without the gateway. You can use the gateway without ONE. Each layer is independently useful.

For the full governance protocol specification (authorization tokens, state machines, kill switches, policy binding), see the [Internet-Draft](https://github.com/bkr1297-RIO/rio-system/blob/main/spec/draft-rio-governance-00.md).
