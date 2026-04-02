#!/usr/bin/env python3
"""
RIO Receipt Protocol — End-to-End Example (Python)

Demonstrates the complete receipt lifecycle:
  1. Hash an intent (what was requested)
  2. Hash an execution (what actually happened)
  3. Generate a cryptographic receipt linking both
  4. Record the receipt in a tamper-evident ledger
  5. Verify the receipt independently
  6. Verify the entire ledger chain

Run with: python examples/end-to-end.py
Zero external dependencies — uses only the Python standard library
and the reference implementations.

Version: 2.2.0
License: MIT OR Apache-2.0
"""

import sys
import os
import uuid
import copy
from datetime import datetime, timezone

# Add the parent directory so we can import the Python package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))

from rio_receipt_protocol import (
    hash_intent,
    hash_execution,
    hash_governance,
    hash_authorization,
    generate_receipt,
    verify_receipt,
    create_ledger,
    verify_receipt_standalone,
    verify_chain,
)


def divider(title: str):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}\n")


# ─── 1. Proof-Layer Receipt (3-hash chain) ──────────────────────────

divider("STEP 1: Proof-Layer Receipt (3-hash chain)")

intent_id = str(uuid.uuid4())
timestamp = datetime.now(timezone.utc).isoformat()

print(f"Intent ID: {intent_id}")
print(f"Action:    data_query")
print(f"Agent:     demo-agent\n")

# Hash the intent BEFORE the action
intent_hash = hash_intent(
    intent_id=intent_id,
    action="data_query",
    agent_id="demo-agent",
    parameters={
        "query": "SELECT count(*) FROM orders WHERE status = 'pending'",
        "database": "analytics",
    },
    timestamp=timestamp,
)
print(f"Intent hash: {intent_hash}")

# Simulate executing the action
result = {"rows_returned": 42, "execution_time_ms": 15, "status": "success"}

# Hash the execution AFTER the action
execution_hash = hash_execution(
    intent_id=intent_id,
    action="data_query",
    result=result,
    connector="postgres-connector",
    timestamp=datetime.now(timezone.utc).isoformat(),
)
print(f"Execution hash: {execution_hash}")

# Generate the receipt
receipt = generate_receipt(
    intent_hash=intent_hash,
    execution_hash=execution_hash,
    intent_id=intent_id,
    action="data_query",
    agent_id="demo-agent",
)

print(f"\nReceipt generated:")
print(f"  Receipt ID: {receipt['receipt_id']}")
print(f"  Type: {receipt['receipt_type']}")
print(f"  Chain length: {receipt['verification']['chain_length']}")
print(f"  Chain order: {' → '.join(receipt['verification']['chain_order'])}")
print(f"  Receipt hash: {receipt['hash_chain']['receipt_hash']}")

# Verify the receipt
verify_result = verify_receipt(receipt)
print(f"\n  ✓ Receipt valid: {verify_result['valid']}")


# ─── 2. Governed Receipt (5-hash chain) ─────────────────────────────

divider("STEP 2: Governed Receipt (5-hash chain)")

gov_intent_id = str(uuid.uuid4())
gov_timestamp = datetime.now(timezone.utc).isoformat()

print(f"Intent ID: {gov_intent_id}")
print(f"Action:    send_payment")
print(f"Agent:     finance-agent")
print(f"Risk:      HIGH — requires human approval\n")

# Hash the intent
gov_intent_hash = hash_intent(
    intent_id=gov_intent_id,
    action="send_payment",
    agent_id="finance-agent",
    parameters={
        "recipient": "vendor-acme-corp",
        "amount": 50000,
        "currency": "USD",
    },
    timestamp=gov_timestamp,
)
print(f"Intent hash: {gov_intent_hash}")

# Governance evaluation
governance_hash = hash_governance(
    intent_id=gov_intent_id,
    status="requires_approval",
    risk_level="high",
    requires_approval=True,
    checks=["payment_limit", "vendor_verification", "budget_check"],
)
print(f"Governance hash: {governance_hash}")

# Human authorization
auth_timestamp = datetime.now(timezone.utc).isoformat()
authorization_hash = hash_authorization(
    intent_id=gov_intent_id,
    decision="approved",
    authorized_by="HUMAN:cfo@example.com",
    timestamp=auth_timestamp,
)
print(f"Authorization hash: {authorization_hash}")

# Execute the action
gov_result = {
    "transaction_id": "TXN-2026-001",
    "status": "completed",
    "amount_sent": 50000,
}

gov_execution_hash = hash_execution(
    intent_id=gov_intent_id,
    action="send_payment",
    result=gov_result,
    connector="banking-api",
    timestamp=datetime.now(timezone.utc).isoformat(),
)
print(f"Execution hash: {gov_execution_hash}")

# Generate the governed receipt
gov_receipt = generate_receipt(
    intent_hash=gov_intent_hash,
    execution_hash=gov_execution_hash,
    governance_hash=governance_hash,
    authorization_hash=authorization_hash,
    intent_id=gov_intent_id,
    action="send_payment",
    agent_id="finance-agent",
    authorized_by="HUMAN:cfo@example.com",
)

print(f"\nGoverned receipt generated:")
print(f"  Receipt ID: {gov_receipt['receipt_id']}")
print(f"  Type: {gov_receipt['receipt_type']}")
print(f"  Authorized by: {gov_receipt['authorized_by']}")
print(f"  Chain length: {gov_receipt['verification']['chain_length']}")
print(f"  Chain order: {' → '.join(gov_receipt['verification']['chain_order'])}")
print(f"  Receipt hash: {gov_receipt['hash_chain']['receipt_hash']}")

gov_verify = verify_receipt(gov_receipt)
print(f"\n  ✓ Governed receipt valid: {gov_verify['valid']}")


# ─── 3. Ledger ──────────────────────────────────────────────────────

divider("STEP 3: Tamper-Evident Ledger")

ledger = create_ledger()

# Record both receipts
entry1 = ledger.append(
    intent_id=intent_id,
    action="data_query",
    agent_id="demo-agent",
    status="executed",
    detail="Analytics query: pending orders count",
    receipt_hash=receipt["hash_chain"]["receipt_hash"],
    intent_hash=receipt["hash_chain"]["intent_hash"],
)
print(f"Entry 1 recorded:")
print(f"  Entry ID: {entry1['entry_id']}")
print(f"  Ledger hash: {entry1['ledger_hash']}")
print(f"  Prev hash: {entry1['prev_hash'][:16]}... (genesis)")

entry2 = ledger.append(
    intent_id=gov_intent_id,
    action="send_payment",
    agent_id="finance-agent",
    status="executed",
    detail="Governed payment: $50,000 to vendor-acme-corp",
    receipt_hash=gov_receipt["hash_chain"]["receipt_hash"],
    authorization_hash=gov_receipt["hash_chain"]["authorization_hash"],
    intent_hash=gov_receipt["hash_chain"]["intent_hash"],
)
print(f"\nEntry 2 recorded:")
print(f"  Entry ID: {entry2['entry_id']}")
print(f"  Ledger hash: {entry2['ledger_hash']}")
print(f"  Prev hash: {entry2['prev_hash'][:16]}... (links to entry 1)")

# Verify the chain
chain_result = ledger.verify_chain()
print(f"\n  ✓ Ledger chain valid: {chain_result['valid']}")
print(f"  Entries verified: {chain_result['entries_checked']}")


# ─── 4. Independent Verification ────────────────────────────────────

divider("STEP 4: Independent Verification")

print("Any third party can verify receipts and ledger chains")
print("without access to the original system.\n")

# Standalone receipt verification
standalone1 = verify_receipt_standalone(receipt)
print(f"Proof-layer receipt: {'✓ VALID' if standalone1['valid'] else '✗ INVALID'}")

standalone2 = verify_receipt_standalone(gov_receipt)
print(f"Governed receipt:    {'✓ VALID' if standalone2['valid'] else '✗ INVALID'}")

# Ledger chain verification
chain_verify = verify_chain(ledger.export())
print(f"Ledger chain:        {'✓ INTACT' if chain_verify['valid'] else '✗ BROKEN'}")


# ─── 5. Tamper Detection ────────────────────────────────────────────

divider("STEP 5: Tamper Detection")

print("Modifying any field in a receipt invalidates the hash chain.\n")

tampered = copy.deepcopy(receipt)
tampered["hash_chain"]["intent_hash"] = "aaaa" + tampered["hash_chain"]["intent_hash"][4:]

tampered_result = verify_receipt_standalone(tampered)
status = "✓ VALID" if tampered_result["valid"] else "✗ INVALID (tamper detected)"
print(f"Tampered receipt: {status}")
print(f"  Computed hash: {tampered_result['computed_hash'][:32]}...")
print(f"  Stored hash:  {tampered_result['stored_hash'][:32]}...")


# ─── Summary ─────────────────────────────────────────────────────────

divider("SUMMARY")

print("Receipts generated:  2 (1 proof-layer, 1 governed)")
print("Ledger entries:      2")
print("Chain integrity:     ✓ VALID")
print("Tamper detection:    ✓ WORKING")
print()
print("The RIO Receipt Protocol provides cryptographic proof")
print("of what happened, when it happened, and who authorized it.")
print("No trust required — verify independently.")
print()
