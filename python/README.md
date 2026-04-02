# rio-receipt-protocol

Cryptographic proof for AI actions. Open standard. **Zero required dependencies.**

Generate tamper-evident receipts, maintain hash-chained ledgers, and verify AI action audit trails — all with nothing more than the Python standard library.

## Installation

```bash
pip install rio-receipt-protocol
```

For Ed25519 signature support (optional):

```bash
pip install rio-receipt-protocol[signing]
```

## Quick Start

```python
from rio_receipt_protocol import (
    hash_intent, hash_execution, generate_receipt, verify_receipt, create_ledger
)

# 1. Hash the intent
intent_hash = hash_intent(
    intent_id="i-001",
    action="send_email",
    agent_id="agent-1",
    parameters={"to": "user@example.com", "subject": "Hello"},
    timestamp="2026-04-01T00:00:00.000Z",
)

# 2. Hash the execution
execution_hash = hash_execution(
    intent_id="i-001",
    action="send_email",
    result="sent",
    connector="smtp",
    timestamp="2026-04-01T00:00:01.000Z",
)

# 3. Generate a receipt
receipt = generate_receipt(
    intent_hash=intent_hash,
    execution_hash=execution_hash,
    intent_id="i-001",
    action="send_email",
    agent_id="agent-1",
)

# 4. Verify it
result = verify_receipt(receipt)
assert result["valid"] is True

# 5. Append to a tamper-evident ledger
ledger = create_ledger()
entry = ledger.append(
    intent_id="i-001",
    action="send_email",
    agent_id="agent-1",
    status="executed",
    detail="Email sent",
    receipt_hash=receipt["hash_chain"]["receipt_hash"],
)

# 6. Verify the chain
chain = ledger.verify_chain()
assert chain["valid"] is True
```

## API Reference

The Python package mirrors the Node.js API exactly:

| Function | Description |
|---|---|
| `sha256(data)` | SHA-256 hash of a string |
| `hash_intent(...)` | Hash an intent object |
| `hash_execution(...)` | Hash an execution record |
| `hash_governance(...)` | Hash a governance decision (optional) |
| `hash_authorization(...)` | Hash an authorization record (optional) |
| `generate_receipt(...)` | Generate a v2.2 receipt |
| `verify_receipt(receipt)` | Verify a receipt's hash chain |
| `create_ledger(file_path=None)` | Create a tamper-evident ledger |
| `verify_receipt_standalone(receipt)` | Independent receipt verification |
| `verify_chain(entries)` | Verify a ledger hash chain |
| `verify_receipt_batch(receipts)` | Batch-verify multiple receipts |

## License

Dual-licensed under MIT and Apache 2.0.
