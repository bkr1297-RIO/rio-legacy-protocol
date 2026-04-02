# RIO System Overview

This document provides a high-level overview of the broader RIO architecture. The RIO Receipt Protocol is one layer of this system. This overview is intended for teams evaluating how the receipt protocol fits into a larger governed execution environment.

---

## What Is RIO?

RIO is a governed execution system that sits between AI agents, humans, and real-world actions. It translates goals into structured intent, evaluates risk and policy, requires approval when necessary, controls execution, verifies outcomes, and generates cryptographically signed receipts recorded in a tamper-evident ledger.

The system enforces the rules — not the AI. The AI proposes; the system decides, executes, records, and learns.

---

## Architecture Layers

The RIO architecture is organized into distinct layers, each with a defined responsibility:

```
┌──────────────────────────────────────────────────────────────┐
│                        ONE Interface                          │
│            Human-in-the-loop dashboard and controls            │
│     Approvals · Kill switch · Audit trail · Transparency       │
├──────────────────────────────────────────────────────────────┤
│                       Bondi Gateway                           │
│            Policy engine, RBAC, risk assessment                │
│     Intent evaluation · Governance decisions · Routing         │
├──────────────────────────────────────────────────────────────┤
│                      RIO Control Plane                        │
│         Authorization · Execution control · State machine      │
│     Token lifecycle · Connector dispatch · Kill switch          │
├──────────────────────────────────────────────────────────────┤
│                          MANTIS                               │
│            Observation, recording, and learning                │
│     Corpus · Ledger · Drift monitoring · Policy feedback       │
├══════════════════════════════════════════════════════════════╡
│                   RIO Receipt Protocol                        │
│          Receipts · Ledger · Verifier · Conformance            │
│                    ← THIS REPO (Open Standard)                 │
├──────────────────────────────────────────────────────────────┤
│                        Connectors                             │
│          Integrations to external systems and services          │
│     Email · Calendar · Finance · Code · APIs · Databases       │
└──────────────────────────────────────────────────────────────┘
```

The double line (`═══`) marks the boundary between the open protocol layer and the broader system. Everything below the double line is open and implementation-neutral. Everything above is part of the RIO platform architecture.

---

## Layer Descriptions

### ONE Interface

ONE is the human-facing dashboard that provides visibility into what AI agents are doing. It surfaces pending approvals, active executions, audit trails, and kill switch controls. ONE is the primary interface for human oversight of governed AI actions.

### Bondi Gateway

Bondi is the policy and governance gateway. When an intent enters the system, Bondi evaluates it against configured policies, assesses risk, and determines whether the action requires human approval, can be auto-approved, or should be denied. Bondi produces the governance decision that becomes the `governance_hash` in a governed receipt.

### RIO Control Plane

The control plane manages the authorization and execution lifecycle. It issues authorization tokens, dispatches actions to connectors, enforces the state machine (intent → governance → authorization → execution → verification), and provides kill switch capability to halt execution at any stage.

### MANTIS

MANTIS is the observation and recording layer. It maintains the corpus of governance documents, writes to the ledger, monitors for behavioral drift (rubber-stamping, risk creep, automation bias), and feeds observations back into policy refinement. MANTIS sees and records everything — if an event is not recorded by MANTIS, it is considered as if it did not happen.

### RIO Receipt Protocol (This Repo)

The receipt protocol is the open proof layer. It defines how receipts are structured, hashed, chained, and verified. It is the only layer that is fully specified as an open standard with reference implementations in multiple languages. Any system can implement the receipt protocol without using any other RIO component.

### Connectors

Connectors are integrations to external systems — email providers, calendar services, financial platforms, code repositories, APIs, and databases. The control plane dispatches authorized actions to connectors, and connectors return execution results that become the `execution_hash` in a receipt.

---

## The Three Loops

The RIO architecture operates through three interconnected loops:

### Intake Loop

The intake loop handles goal-to-intent translation. A user or system expresses a goal (natural language, API call, scheduled trigger). The intake layer translates the goal into a structured intent with defined parameters, target connector, and risk classification. The intent enters the governance loop.

### Governance Loop

The governance loop is the core execution cycle: intent → governance evaluation → authorization → execution → verification → receipt → ledger. Every action passes through this loop. The loop enforces that no action executes without evaluation, no high-risk action executes without explicit authorization, every execution produces a receipt, and every receipt is recorded in the ledger.

### Learning Loop

The learning loop feeds ledger data back into policy. MANTIS monitors approval patterns, execution outcomes, and behavioral signals. If a human approver is rubber-stamping (approving without review), if risk classifications are drifting, or if automation is introducing bias, the learning loop surfaces these patterns for policy adjustment.

---

## What Is Open vs. What Is Platform

| Component | Status | Description |
|-----------|--------|-------------|
| Receipt Protocol | **Open Standard** | Receipt format, hash chain, verification, ledger format |
| Reference Implementations | **Open Source** | Node.js and Python packages, CLI verifier |
| Conformance Tests | **Open Source** | 58 tests across two languages |
| ONE Interface | Platform | Human dashboard and approval UI |
| Bondi Gateway | Platform | Policy engine and risk assessment |
| RIO Control Plane | Platform | Authorization, execution, state machine |
| MANTIS | Platform | Observation, recording, learning |
| Connectors | Platform | External system integrations |

The receipt protocol is designed to be useful on its own. Teams can implement receipts and ledgers without any other RIO component. The platform layers add governance, human oversight, and operational control for teams that need them.

---

## How the Receipt Protocol Fits

The receipt protocol is the output layer of the governance loop. Regardless of how an action is proposed, evaluated, approved, or executed, the final artifact is always a receipt written to a ledger.

This means the receipt protocol is the integration point for audit systems, compliance tools, external verifiers, and cross-organizational trust. A third party does not need access to the governance engine, the policy configuration, or the execution infrastructure. They only need the receipt and the verification algorithm.

```
External Auditor
       │
       ▼
   Receipt + Ledger  ←  This is all they need
       │
       ▼
   verifyReceipt()
   verifyChain()
       │
       ▼
   Deterministic result: valid or invalid
```

---

## Further Reading

| Resource | Description |
|----------|-------------|
| [Receipt Protocol Specification](../spec/receipt-protocol.md) | Full protocol spec |
| [Ledger Format Specification](../spec/ledger-format.md) | Ledger entry structure and chain rules |
| [Conformance Specification](../spec/conformance.md) | Conformance levels and test requirements |
| [Integration Guide](integration-guide.md) | OpenAI, Anthropic, LangChain examples |
| [Architecture](architecture.md) | Protocol-level architecture and data flow |
| [Full RIO Governance Spec](https://github.com/bkr1297-RIO/rio-system/blob/main/spec/draft-rio-governance-00.md) | IETF-style Internet-Draft for the complete governance protocol |

---

## Contact

For questions about the open receipt protocol, open an issue on this repository.

For questions about the broader RIO platform, enterprise licensing, or integration partnerships, contact **riomethod5@gmail.com**.
