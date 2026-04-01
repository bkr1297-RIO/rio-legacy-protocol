## What is a RIO Receipt?

A RIO Receipt is a cryptographically signed, tamper-evident record of every AI action and human approval. It provides a universal proof layer for AI decision-making, ensuring auditable and compliant operations in high-stakes environments.

### Annotated RIO Receipt JSON

```json
{
  "id": "receipt-12345",
  "timestamp": "2026-04-01T10:30:00Z",
  "action": {
    "type": "send_email",
    "details": {
      "to": "auditor@example.com",
      "subject": "Compliance Report Q1 2026",
      "body_hash": "sha256-abcdef1234567890..."
    }
  },
  "ai_proposal": {
    "model": "GPT-4.1-Mini",
    "confidence": 0.98,
    "reasoning_hash": "sha256-fedcba0987654321..."
  },
  "human_approval": {
    "approved_by": "Brian",
    "timestamp": "2026-04-01T10:31:15Z",
    "role": "Compliance Officer",
    "approval_mechanism": "RIO Mobile App"
  },
  "cryptographic_proof": {
    "receipt_hash": "sha256-1a2b3c4d5e6f7a8b...",
    "previous_ledger_hash": "sha256-9z8y7x6w5v4u3t2s...",
    "signature": "Ed25519-signature-string-here...",
    "public_key_id": "rio-key-id-123"
  }
}
```

**Explanation of Fields:**

*   **`id`**: A unique identifier for this specific RIO Receipt.
*   **`timestamp`**: The UTC timestamp when the action was recorded.
*   **`action`**: Details the real-world action taken, including its type and specific parameters. A `body_hash` ensures the content of the action is also verifiable.
*   **`ai_proposal`**: Captures the AI system's recommendation, including the model used, its confidence level, and a hash of its reasoning process.
*   **`human_approval`**: Records the human-in-the-loop (HITL) decision, including who approved it, when, their role, and the mechanism used for approval.
*   **`cryptographic_proof`**: Contains the core elements for auditability:
    *   `receipt_hash`: A SHA-256 hash of the entire receipt content, ensuring its integrity.
    *   `previous_ledger_hash`: Links this receipt to the preceding entry in the tamper-evident ledger, forming an unbroken chain.
    *   `signature`: An Ed25519 digital signature, proving the receipt's authenticity and origin.
    *   `public_key_id`: Identifies the public key used to verify the signature.

### Five Proof-Point Cards

1.  **Tamper-Evident Ledger**: Every RIO Receipt is immutably linked in a SHA-256 hash chain, creating a verifiable, unalterable record of all AI actions and human approvals.
2.  **Language-Agnostic Standard**: The RIO Receipt Protocol is designed as a portable standard, with reference implementations in multiple languages (e.g., Node.js, Python) using only standard libraries, proving its universal applicability.
3.  **Human-in-the-Loop (HITL) Assurance**: Clearly documents human oversight and approval for AI-driven decisions, providing a transparent audit trail for critical actions.
4.  **Audit-Ready Compliance**: Generates cryptographic audit trails that satisfy high-compliance requirements for regulators, auditors, and internal governance, simplifying proof of adherence.
5.  **Universal Proof Layer**: Integrates seamlessly as a foundational layer to existing AI and automated systems, providing an external, verifiable record of actions without disrupting core application logic.

## What this project is (and isn't)

This project provides the **Receipt + Ledger layer only**. It is the proof layer that records that an action happened, when it happened, what was requested, and produces a cryptographic receipt that cannot be changed. That receipt is hash-chained into an immutable ledger so the history is tamper-evident and auditable. This layer does not require human approval by itself; it simply proves and records actions in a verifiable way. Think of it as "show your work" infrastructure for AI and automated systems.

**What this project is NOT:** The governance and control plane (risk engine, policy engine, approval workflows, execution gate, enterprise controls, robotics controls, etc.). That is the paid / enterprise layer and the actual control plane.
