# RIO System Overview

This document provides a high-level overview of where the RIO Receipt Protocol fits within the broader RIO architecture. It is intended for teams evaluating how the receipt protocol integrates with governed execution environments.

---

## What Is RIO?

RIO is a governed execution system that sits between AI agents, humans, and real-world actions. It translates goals into structured intent, evaluates risk, requires approval when necessary, controls execution, verifies outcomes, and generates cryptographically signed receipts recorded in a tamper-evident ledger.

The system enforces the rules — not the AI. The AI proposes; the system decides, executes, records, and learns.

---

## Where the Receipt Protocol Fits

The RIO architecture is organized into layers. The receipt protocol is the **open proof layer** at the foundation:

```
┌──────────────────────────────────────────────────────────────┐
│                   RIO Platform (Licensed)                     │
│     Human oversight · Governance · Policy · Execution control │
├══════════════════════════════════════════════════════════════╡
│                   RIO Receipt Protocol                        │
│          Receipts · Ledger · Verifier · Conformance            │
│                    ← THIS REPO (Open Standard)                 │
├──────────────────────────────────────────────────────────────┤
│                    Your Application                           │
│          AI agents · APIs · Automation · Services              │
└──────────────────────────────────────────────────────────────┘
```

The double line (`═══`) marks the boundary between the open protocol and the platform. Everything below the double line is open and implementation-neutral. The platform layers above add governance, human oversight, and operational control for teams that need them.

---

## What Is Open vs. What Is Platform

| Component | Status | Description |
|-----------|--------|-------------|
| Receipt Protocol | **Open Standard** | Receipt format, hash chain, verification, ledger format |
| Reference Implementations | **Open Source** | Node.js and Python packages, CLI verifier |
| Conformance Tests | **Open Source** | 58 tests across two languages |
| Governance & Control Plane | **Platform (Licensed)** | Policy enforcement, human approval workflows, execution control |
| Command Interface | **Platform (Licensed)** | Human dashboard, oversight, and operational controls |

The receipt protocol is designed to be useful on its own. Teams can implement receipts and ledgers without any other RIO component. The platform layers add governance, human oversight, and operational control for teams that need them.

---

## How the Receipt Protocol Fits

The receipt protocol is the output layer of any governed execution flow. Regardless of how an action is proposed, evaluated, approved, or executed, the final artifact is always a receipt written to a ledger.

This means the receipt protocol is the integration point for audit systems, compliance tools, external verifiers, and cross-organizational trust. A third party does not need access to any governance engine, policy configuration, or execution infrastructure. They only need the receipt and the verification algorithm.

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

## The Two Layers

**Receipts prove what happened** (open — this repo). Any system can generate, sign, and verify receipts using the open protocol. The receipt format supports both standalone proof-layer receipts (3-hash chain) and governed receipts (5-hash chain) that include governance and authorization hashes.

**The RIO platform enforces what is allowed to happen** (licensed). The platform provides policy enforcement, risk assessment, human-in-the-loop approval workflows, execution control, and continuous monitoring. Teams that need governed execution — where high-risk AI actions require explicit human authorization before they can proceed — use the platform layer on top of the open receipt protocol.

You can use the receipt protocol without the platform. You can adopt receipts today and add governance later. Each layer is independently useful.

---

## Further Reading

| Resource | Description |
|----------|-------------|
| [Receipt Protocol Specification](../spec/receipt-protocol.md) | Full protocol spec |
| [Ledger Format Specification](../spec/ledger-format.md) | Ledger entry structure and chain rules |
| [Conformance Specification](../spec/conformance.md) | Conformance levels and test requirements |
| [Integration Guide](integration-guide.md) | OpenAI, Anthropic, LangChain examples |
| [Architecture](architecture.md) | Protocol-level architecture and data flow |

---

## Contact

For questions about the open receipt protocol, open an issue on this repository.

For questions about the RIO platform, enterprise licensing, or integration partnerships, contact **riomethod5@gmail.com**.
