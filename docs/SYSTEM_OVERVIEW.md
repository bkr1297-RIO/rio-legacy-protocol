# RIO System — Complete Definition

> **RIO converts AI actions into human-authorized, policy-controlled, cryptographically verifiable transactions.**

RIO is a closed-loop governed execution system. It is not a chatbot. It is not an agent. It is not a workflow tool. It is a runtime control layer that sits between intelligence and action.

---

## Core Loop

Every action in RIO follows the same fixed sequence. There are no exceptions and no alternative paths.

| Step | What Happens |
|------|-------------|
| 1 | AI proposes intent |
| 2 | Policy evaluates risk |
| 3 | Human approves (if required) |
| 4 | Gateway executes |
| 5 | Receipt is generated |
| 6 | Ledger records proof |
| 7 | System learns (controlled) |

```
Intent → Govern → Approve → Execute → Receipt → Ledger
```

---

## Why This Exists

Without RIO, AI executes actions without structural control. There is no approval boundary enforced at the infrastructure level. There is no cryptographic proof of what happened. Audit logs can be incomplete, fabricated, or bypassed.

With RIO, every action is authorized before it executes. Every action is recorded in a tamper-evident ledger. Every action is independently provable after the fact.

---

## System Guarantee

No action with real-world consequences can occur without:

1. **Governance** — policy evaluation and risk classification
2. **Authorization** — human approval when required by policy
3. **Proof** — cryptographic receipt written to a hash-chained ledger

If any of these three conditions cannot be met, the action does not execute. The system fails closed.

---

## How the Pieces Fit

This repository contains the **receipt protocol** — the proof layer. It defines how receipts are structured, signed, chained, and verified. The receipt protocol is open and has zero dependencies.

The **governance engine** (policy evaluation, risk classification, human-in-the-loop approval, token issuance) and the **execution gateway** (controlled action execution, connector management) are separate components that produce the data the receipt protocol records.

```
┌─────────────────────────────────────────────┐
│  AI Agent (proposes intent)                 │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Governance Engine (policy + risk + HITL)   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Execution Gateway (controlled execution)   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Receipt Protocol (this repo)               │
│  → generate receipt                         │
│  → chain to ledger                          │
│  → independent verification                 │
└─────────────────────────────────────────────┘
```

---

## Next Steps

To understand the system in 2 minutes, read [How to Understand RIO](HOW_TO_UNDERSTAND_RIO.md).

To integrate the receipt protocol into your system, read the [Integration Guide](integration-guide.md).

To ask implementation questions, use [Ask Bondi](https://riodemo-ux2sxdqo.manus.space/ask).
