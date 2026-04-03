# RIO Receipt Protocol — FAQ

## General

### What is the RIO Receipt Protocol?

A cryptographic receipt and verification system for AI actions. It turns any automated action into a signed, recorded, and independently verifiable transaction. The protocol sits between intelligence (AI, scripts, agents) and execution (APIs, email, file operations, payments).

### Is this a blockchain?

No. It is a hash-chained append-only ledger — structurally similar to a blockchain's data layer but without consensus mechanisms, distributed nodes, tokens, or mining. A single operator maintains the ledger. Tamper evidence comes from SHA-256 hash chaining, not distributed consensus.

### Is this an AI model?

No. The protocol does not contain or run any AI. It is a control and audit layer that wraps around AI actions. Any AI system (OpenAI, Claude, LangChain, custom agents) can integrate the protocol to produce receipts for its actions.

### What problem does this solve?

AI systems act on behalf of humans — sending emails, calling APIs, moving money, deleting files. Today, there is no standard way to prove what an AI did, when it did it, whether it was authorized, and whether the record has been tampered with. This protocol provides that proof layer.

### Who is this for?

- **Developers** building AI agents, automation pipelines, or LLM-powered tools who need audit trails
- **Companies** in regulated industries (finance, healthcare, legal) that need non-repudiation for automated actions
- **Platform builders** creating AI orchestration systems who want a standard receipt format
- **Security teams** evaluating AI governance and accountability infrastructure

---

## Technical

### What hashing algorithm is used?

SHA-256, from the standard library (Node.js `crypto` module, Python `hashlib`). No external dependencies.

### What signing algorithm is used?

Ed25519 for identity binding. Signing is optional — the core proof layer (hash chain) works without it. When signing is enabled, the receipt_hash (64-char hex string) is the signed payload.

### How do I verify a receipt?

Recompute the receipt_hash from the receipt's component hashes (intent_hash, execution_hash, and optionally governance_hash and authorization_hash) using canonical JSON serialization + SHA-256. Compare to the stored receipt_hash. If they match, the receipt has not been tampered with.

```bash
# CLI verification
node cli/verify.mjs receipt.json

# Ledger chain verification
node cli/verify.mjs --ledger ledger.json
```

```javascript
// Programmatic verification (Node.js)
import { verifyReceipt } from "rio-receipt-protocol";
const result = verifyReceipt(receipt);
console.log(result.valid); // true or false
```

```python
# Programmatic verification (Python)
from rio_receipt_protocol import verify_receipt
result = verify_receipt(receipt)
print(result["valid"])  # True or False
```

### What is canonical JSON?

Deterministic JSON serialization with explicit insertion order (not sorted — fields must appear in the exact order defined by the spec), no whitespace (`separators=(",",":")` in Python, `JSON.stringify` with no spacing in Node.js), and UTF-8 encoding. This ensures that the same data always produces the same hash, regardless of which language or platform generates it. Key order matters — see `spec/canonical-rules.md` for the required field order for each hash function.

### What is the hash chain?

Each ledger entry contains a `prev_hash` field pointing to the hash of the previous entry. The first entry points to the genesis hash (`0000000000000000000000000000000000000000000000000000000000000000`). This creates a tamper-evident chain — if any entry is modified, all subsequent hashes break.

### Does the protocol require human approval?

No. The core proof layer generates receipts for any action without governance. Human approval is an optional extension (governed receipts) that adds governance_hash and authorization_hash to the chain. The protocol supports both autonomous and governed modes.

### What are the zero-dependency claims?

The core protocol (receipt generation, hashing, verification, ledger) uses only standard library functions — no npm packages, no pip packages. Ed25519 signing uses Node.js built-in `crypto` module. The Python signing extension requires either `cryptography` or `PyNaCl` (both widely available).

---

## Integration

### How do I add receipts to my existing AI system?

Three steps:
1. Before execution: hash the intent (what the AI wants to do)
2. After execution: hash the result
3. Generate a receipt from both hashes

See `docs/integration-guide.md` for copy-paste examples with OpenAI, Claude, and LangChain.

### Can I use this with any programming language?

Yes. The protocol is defined by a specification (`spec/`), not by a specific implementation. Reference implementations exist in Node.js and Python. Any language that supports SHA-256 and JSON serialization can implement the protocol. Pass the conformance tests (`spec/conformance.md`) to verify compatibility.

### Is this published on npm / PyPI?

Yes. Both packages are published and available:

```bash
# Node.js
npm install rio-receipt-protocol

# Python
pip install rio-receipt-protocol
```

You can also install from source:

```bash
# Node.js — from GitHub
npm install github:bkr1297-RIO/rio-receipt-protocol

# Python — from GitHub
pip install git+https://github.com/bkr1297-RIO/rio-receipt-protocol.git#subdirectory=python
```

### What is the license?

Dual-licensed under MIT and Apache-2.0. Use whichever works for your project.

---

## Security

### What does this NOT protect against?

See the [Scope Limitations](../README.md#scope-limitations) section in the README. In short: the protocol proves what was recorded, not that the recording is truthful. It does not protect against compromised keys, dishonest operators, or incorrect governance decisions.

### Can someone forge a receipt?

Without the signing key, no. The receipt_hash is computed from the component hashes — changing any input changes the hash. With Ed25519 signing, forging a signature requires the private key. Without signing, the hash chain still provides tamper evidence (any modification is detectable).

### What happens if the ledger operator is malicious?

A malicious operator could withhold entries (omission attack) or maintain a parallel ledger. The hash chain makes modification of existing entries detectable. External witnesses, public anchoring (Merkle root publication, RFC 3161 timestamps), and multi-party verification mitigate omission attacks. These are planned extensions.
