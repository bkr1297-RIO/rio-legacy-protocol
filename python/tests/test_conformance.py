"""
RIO Receipt Protocol v2.2 — Python Conformance Tests

Mirrors the Node.js conformance test suite (tests/conformance.test.mjs).
Tests proof-layer receipts, governed receipts, hash integrity, ledger
operations, cross-verification, batch verification, mixed types, and
optional extensions.
"""

import sys
import os
import re
import copy

# Add parent to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rio_receipt_protocol import (
    sha256,
    hash_intent,
    hash_execution,
    hash_governance,
    hash_authorization,
    generate_receipt,
    verify_receipt,
    create_ledger,
    verify_receipt_standalone,
    verify_chain,
    verify_receipt_against_ledger,
    verify_receipt_batch,
    GENESIS_HASH,
)

passed = 0
failed = 0
total = 0
HEX64 = re.compile(r"^[a-f0-9]{64}$")


def test(name, condition):
    global passed, failed, total
    total += 1
    if condition:
        passed += 1
        print(f"  \033[32m✓\033[0m {name}")
    else:
        failed += 1
        print(f"  \033[31m✗\033[0m {name}")


def section(name):
    print(f"\n{name}")


INTENT = {
    "intent_id": "test-intent-001",
    "action": "send_email",
    "agent_id": "test-agent-001",
    "parameters": {"to": "user@example.com", "subject": "Test"},
    "timestamp": "2026-04-01T00:00:00.000Z",
}
EXECUTION = {
    "intent_id": "test-intent-001",
    "action": "send_email",
    "result": "sent",
    "connector": "smtp",
    "timestamp": "2026-04-01T00:00:01.000Z",
}
GOVERNANCE = {
    "intent_id": "test-intent-001",
    "status": "approved",
    "risk_level": "low",
    "requires_approval": False,
    "checks": ["policy_check", "rate_limit"],
}
AUTHORIZATION = {
    "intent_id": "test-intent-001",
    "decision": "approved",
    "authorized_by": "HUMAN:admin@example.com",
    "timestamp": "2026-04-01T00:00:00.500Z",
    "conditions": None,
}

section("1. Proof-Layer Receipt Generation")
intent_hash = hash_intent(**INTENT)
execution_hash = hash_execution(**EXECUTION)
proof_receipt = generate_receipt(
    intent_hash=intent_hash, execution_hash=execution_hash,
    intent_id=INTENT["intent_id"], action=INTENT["action"], agent_id=INTENT["agent_id"],
)
test("generates a proof-layer receipt with 3-hash chain", proof_receipt["verification"]["chain_length"] == 3)
test("proof-layer receipt has all required core fields",
     all(proof_receipt.get(f) is not None for f in
         ["receipt_id", "receipt_type", "intent_id", "action", "agent_id", "timestamp", "hash_chain", "verification"]))
test("proof-layer chain_order is [intent_hash, execution_hash, receipt_hash]",
     proof_receipt["verification"]["chain_order"] == ["intent_hash", "execution_hash", "receipt_hash"])
test("proof-layer receipt self-verifies", verify_receipt(proof_receipt)["valid"])
test("proof-layer receipt verifies with standalone verifier", verify_receipt_standalone(proof_receipt)["valid"])

section("2. Governed Receipt Generation (Extension)")
governance_hash = hash_governance(**GOVERNANCE)
authorization_hash = hash_authorization(**AUTHORIZATION)
governed_receipt = generate_receipt(
    intent_hash=intent_hash, execution_hash=execution_hash,
    governance_hash=governance_hash, authorization_hash=authorization_hash,
    intent_id=INTENT["intent_id"], action=INTENT["action"], agent_id=INTENT["agent_id"],
    authorized_by="HUMAN:admin@example.com",
)
test("generates a governed receipt with 5-hash chain", governed_receipt["verification"]["chain_length"] == 5)
test("governed receipt chain_order has all 5 fields in order",
     governed_receipt["verification"]["chain_order"] == [
         "intent_hash", "governance_hash", "authorization_hash", "execution_hash", "receipt_hash"])
test("governed receipt self-verifies", verify_receipt(governed_receipt)["valid"])
test("governed receipt verifies with standalone verifier", verify_receipt_standalone(governed_receipt)["valid"])

section("3. Hash Integrity")
test("SHA-256 produces 64-char hex string", bool(HEX64.match(sha256("test"))))
test("SHA-256 is deterministic", sha256("hello") == sha256("hello"))
test("SHA-256 is collision-resistant (different inputs = different hashes)", sha256("input_a") != sha256("input_b"))
test("all receipt hashes are valid 64-char hex",
     all(HEX64.match(v) for k, v in proof_receipt["hash_chain"].items() if v is not None))
tampered = copy.deepcopy(proof_receipt)
tampered["hash_chain"]["intent_hash"] = "a" * 64
test("tampered receipt fails verification", not verify_receipt(tampered)["valid"])
test("tampered receipt fails standalone verification", not verify_receipt_standalone(tampered)["valid"])

section("4. Ledger Operations")
ledger = create_ledger()
test("ledger starts empty with genesis hash",
     ledger.get_entry_count() == 0 and ledger.get_current_hash() == GENESIS_HASH)
entry1 = ledger.append(
    intent_id=INTENT["intent_id"], action=INTENT["action"], agent_id=INTENT["agent_id"],
    status="executed", detail="Email sent successfully",
    receipt_hash=proof_receipt["hash_chain"]["receipt_hash"],
)
test("append creates a valid entry with correct prev_hash",
     entry1["prev_hash"] == GENESIS_HASH and bool(HEX64.match(entry1["ledger_hash"])))
entry2 = ledger.append(
    intent_id="test-intent-002", action="schedule_meeting", agent_id=INTENT["agent_id"],
    status="executed", detail="Meeting scheduled",
)
test("chain links correctly across multiple entries", entry2["prev_hash"] == entry1["ledger_hash"])
test("ledger chain verifies with standalone verifier", ledger.verify_chain()["valid"])
entries = ledger.export()
entries[0]["detail"] = "TAMPERED"
test("tampered ledger entry breaks chain verification", not verify_chain(entries)["valid"])

section("5. Cross-Verification (Receipt and Ledger)")
test("receipt cross-verifies against matching ledger entry",
     verify_receipt_against_ledger(proof_receipt, entry1)["valid"])
test("mismatched receipt/ledger fails cross-verification",
     not verify_receipt_against_ledger(proof_receipt, entry2)["valid"])

section("6. Batch Verification")
test("batch verifies multiple valid receipts",
     verify_receipt_batch([proof_receipt, governed_receipt])["all_valid"])
tampered2 = copy.deepcopy(governed_receipt)
tampered2["hash_chain"]["receipt_hash"] = "a" * 64
batch_tampered = verify_receipt_batch([proof_receipt, tampered2])
test("batch detects tampered receipt among valid ones",
     not batch_tampered["all_valid"] and batch_tampered["valid"] == 1)

section("7. Mixed Receipt Types (Proof-Layer + Governed)")
test("batch verifies mix of proof-layer and governed receipts",
     verify_receipt_batch([proof_receipt, governed_receipt])["all_valid"])
mixed_ledger = create_ledger()
mixed_ledger.append(intent_id=INTENT["intent_id"], action=INTENT["action"],
                    agent_id=INTENT["agent_id"], status="executed",
                    detail="Proof-layer receipt", receipt_hash=proof_receipt["hash_chain"]["receipt_hash"])
mixed_ledger.append(intent_id=INTENT["intent_id"], action=INTENT["action"],
                    agent_id=INTENT["agent_id"], status="executed",
                    detail="Governed receipt", receipt_hash=governed_receipt["hash_chain"]["receipt_hash"])
test("ledger accepts both proof-layer and governed receipts", mixed_ledger.verify_chain()["valid"])

section("8. Optional Extensions")
ingestion_receipt = generate_receipt(
    intent_hash=intent_hash, execution_hash=execution_hash,
    intent_id=INTENT["intent_id"], action=INTENT["action"], agent_id=INTENT["agent_id"],
    ingestion={"source": "api", "channel": "POST /intent", "source_message_id": "msg-123"},
)
test("receipt with ingestion provenance",
     verify_receipt(ingestion_receipt)["valid"] and ingestion_receipt.get("ingestion") is not None)
identity_receipt = generate_receipt(
    intent_hash=intent_hash, execution_hash=execution_hash,
    intent_id=INTENT["intent_id"], action=INTENT["action"], agent_id=INTENT["agent_id"],
    identity_binding={"signer_id": "human-root", "public_key_hex": "a" * 64,
                      "signature_payload_hash": "b" * 64, "verification_method": "ed25519-nacl",
                      "ed25519_signed": True},
)
test("receipt with identity binding",
     verify_receipt(identity_receipt)["valid"] and identity_receipt.get("identity_binding") is not None)
plain_receipt = generate_receipt(
    intent_hash=intent_hash, execution_hash=execution_hash,
    intent_id=INTENT["intent_id"], action=INTENT["action"], agent_id=INTENT["agent_id"],
)
test("receipt without optional extensions still verifies", verify_receipt(plain_receipt)["valid"])

print()
print("=" * 60)
print("RIO Receipt Protocol v2.2 Python Conformance Results")
print("=" * 60)
print(f"  Total:  {total}")
print(f"  Passed: {passed}")
if failed:
    print(f"  Failed: {failed}")
print("=" * 60)
if failed == 0:
    print("\u2713 CONFORMANT \u2014 All tests passed")
else:
    print("\u2717 NON-CONFORMANT \u2014 Some tests failed")
    sys.exit(1)
