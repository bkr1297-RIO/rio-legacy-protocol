## What is a RIO Receipt?

A RIO Receipt is a tamper-evident, hash-chained record of every AI action. It provides a universal proof layer for AI decision-making, ensuring auditable and compliant operations in high-stakes environments.

### Annotated RIO Receipt JSON (v2.2)

```json
{
  "receipt_id": "82b99ccc-593f-4c27-a090-5d6e8deb72f1",
  "timestamp": "2026-04-01T16:00:01.000Z",
  "version": "2.2",
  "type": "governed_action",
  "action": "send_email",
  "agent_id": "copilot-agent-001",
  "authorized_by": "HUMAN:cfo@example.com",
  "hash_chain": {
    "intent_hash": "a3f7c8...",
    "execution_hash": "9b2d1e...",
    "governance_hash": "4e8f2a...",
    "authorization_hash": "d1c7b3...",
    "receipt_hash": "7f4a9c...",
    "chain_order": [
      "intent_hash",
      "execution_hash",
      "governance_hash",
      "authorization_hash",
      "receipt_hash"
    ]
  },
  "verification": {
    "algorithm": "SHA-256",
    "method": "ordered_concatenation"
  }
}
```

**Explanation of Fields:**

*   **`receipt_id`**: A UUID uniquely identifying this receipt.
*   **`timestamp`**: The UTC timestamp when the receipt was generated.
*   **`version`**: Protocol version (currently `2.2`).
*   **`type`**: Either `action` (proof-layer, 3-hash) or `governed_action` (full governance, 5-hash).
*   **`action`**: The real-world action that was taken (e.g., `send_email`, `transfer_funds`).
*   **`agent_id`**: The AI agent that performed the action.
*   **`authorized_by`**: (Governed receipts only) Who approved the action.
*   **`hash_chain`**: The core proof structure:
    *   `intent_hash`: SHA-256 of the original request (what was asked for).
    *   `execution_hash`: SHA-256 of the execution result (what actually happened).
    *   `governance_hash`: (Governed only) SHA-256 of the policy evaluation.
    *   `authorization_hash`: (Governed only) SHA-256 of the human approval decision.
    *   `receipt_hash`: SHA-256 of all preceding hashes concatenated in `chain_order` — the tamper-evident seal.
    *   `chain_order`: The exact sequence used to compute `receipt_hash`, making verification deterministic.
*   **`verification`**: Algorithm and method used, enabling any third party to independently verify.

### Two Receipt Types

**Proof-Layer Receipt (3-hash chain):** For any AI action. Binds intent to execution with a receipt hash. No governance required.

```
intent_hash → execution_hash → receipt_hash
```

**Governed Receipt (5-hash chain):** For high-risk actions requiring human approval. Adds governance evaluation and authorization to the chain.

```
intent_hash → execution_hash → governance_hash → authorization_hash → receipt_hash
```

### Five Proof-Point Cards

1.  **Tamper-Evident Ledger**: Every RIO Receipt is hash-chained into a ledger where each entry links to the previous via SHA-256. Any modification to any entry breaks the chain and is immediately detectable.
2.  **Language-Agnostic Standard**: Reference implementations in Node.js and Python with zero external dependencies. Install via `npm` or `pip` and start issuing receipts in minutes.
3.  **Human-in-the-Loop Assurance**: Governed receipts (5-hash chain) cryptographically bind human approval decisions into the proof chain, creating an unbreakable audit trail from intent through authorization to execution.
4.  **Audit-Ready Compliance**: Generates cryptographic audit trails that satisfy SOC 2, ISO 27001, GDPR Article 22, and EU AI Act requirements. Any auditor can independently verify receipts without access to the original system.
5.  **Universal Proof Layer**: Works with any AI provider (OpenAI, Anthropic, open-source), any framework (LangChain, custom), and any orchestration system. The proof layer is independent of the application layer.

## What this project is (and isn't)

This project provides the **Receipt + Ledger layer only**. It is the proof layer that records that an action happened, when it happened, what was requested, and produces a cryptographic receipt that cannot be changed. That receipt is hash-chained into an immutable ledger so the history is tamper-evident and auditable. This layer does not require human approval by itself; it simply proves and records actions in a verifiable way. Think of it as "show your work" infrastructure for AI and automated systems.

**What this project is NOT:** The governance and control plane (risk engine, policy engine, approval workflows, execution gate, enterprise controls, robotics controls, etc.). That is the paid / enterprise layer and the actual control plane.
