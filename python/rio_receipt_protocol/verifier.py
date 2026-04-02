"""
RIO Receipt Protocol — Standalone Verifier

Zero external dependencies beyond the Python standard library.
"""

import re
import json

from .receipts import sha256

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"
_HEX64 = re.compile(r"^[a-f0-9]{64}$")


def verify_receipt_standalone(receipt: dict) -> dict:
    """Verify a single RIO Receipt (proof-layer or governed)."""
    errors = []
    if not receipt.get("receipt_id"):
        errors.append("Missing receipt_id")
    if not receipt.get("timestamp"):
        errors.append("Missing timestamp")
    if not receipt.get("hash_chain"):
        errors.append("Missing hash_chain")
    if not receipt.get("hash_chain"):
        return {"valid": False, "receipt_id": receipt.get("receipt_id", "unknown"), "errors": errors}

    hc = receipt["hash_chain"]
    for field in ("intent_hash", "execution_hash", "receipt_hash"):
        if not hc.get(field):
            errors.append(f"Missing hash_chain.{field}")
        elif not _HEX64.match(hc[field]):
            errors.append(f"Invalid hash format for hash_chain.{field}")
    for field in ("governance_hash", "authorization_hash"):
        val = hc.get(field)
        if val is not None and val and not _HEX64.match(val):
            errors.append(f"Invalid hash format for hash_chain.{field}")
    if errors:
        return {"valid": False, "receipt_id": receipt.get("receipt_id", "unknown"), "errors": errors}

    chain_order = receipt.get("verification", {}).get("chain_order",
        ["intent_hash", "execution_hash", "receipt_hash"])
    receipt_content = {"receipt_id": receipt["receipt_id"]}
    for field in chain_order:
        if field != "receipt_hash":
            receipt_content[field] = hc[field]
    receipt_content["timestamp"] = receipt["timestamp"]
    computed_hash = sha256(json.dumps(receipt_content, separators=(",", ":"), ensure_ascii=False))
    stored_hash = hc["receipt_hash"]

    verification = receipt.get("verification", {})
    if verification.get("algorithm") and verification["algorithm"] != "SHA-256":
        errors.append(f"Unexpected algorithm: {verification['algorithm']}")
    if verification.get("chain_length") is not None and verification["chain_length"] != len(chain_order):
        errors.append(f"chain_length {verification['chain_length']} != chain_order length {len(chain_order)}")

    hash_valid = computed_hash == stored_hash
    if not hash_valid:
        errors.append(f"Receipt hash mismatch: computed {computed_hash}, stored {stored_hash}")

    return {
        "valid": hash_valid and len(errors) == 0,
        "receipt_id": receipt["receipt_id"],
        "receipt_type": receipt.get("receipt_type", "action"),
        "computed_hash": computed_hash, "stored_hash": stored_hash,
        "chain_length": len(chain_order), "errors": errors,
    }


def verify_chain(entries: list) -> dict:
    """Verify a ledger hash chain."""
    if not isinstance(entries, list):
        return {"valid": False, "entries_checked": 0, "first_invalid": None, "reason": "Input is not a list"}
    if not entries:
        return {"valid": True, "entries_checked": 0, "first_invalid": None}
    prev = GENESIS_HASH
    for i, e in enumerate(entries):
        if e.get("prev_hash") != prev:
            return {"valid": False, "entries_checked": i + 1, "first_invalid": i,
                    "reason": f"Entry {i} ({e.get('entry_id')}) prev_hash mismatch."}
        canonical = json.dumps(
            {"entry_id": e["entry_id"], "prev_hash": e["prev_hash"],
             "timestamp": e["timestamp"], "intent_id": e["intent_id"],
             "action": e["action"], "agent_id": e["agent_id"],
             "status": e["status"], "detail": e["detail"],
             "receipt_hash": e.get("receipt_hash"),
             "authorization_hash": e.get("authorization_hash"),
             "intent_hash": e.get("intent_hash")},
            separators=(",", ":"), ensure_ascii=False,
        )
        computed = sha256(canonical)
        if computed != e.get("ledger_hash"):
            return {"valid": False, "entries_checked": i + 1, "first_invalid": i,
                    "reason": f"Entry {i} ({e.get('entry_id')}) hash mismatch."}
        prev = e["ledger_hash"]
    return {"valid": True, "entries_checked": len(entries), "first_invalid": None, "chain_tip": prev}


def verify_receipt_against_ledger(receipt: dict, ledger_entry: dict) -> dict:
    """Cross-verify a receipt against its ledger entry."""
    receipt_result = verify_receipt_standalone(receipt)
    errors = list(receipt_result["errors"])
    if ledger_entry.get("receipt_hash") != receipt["hash_chain"]["receipt_hash"]:
        errors.append("Ledger entry receipt_hash does not match receipt")
    if ledger_entry.get("intent_id") != receipt.get("intent_id"):
        errors.append("Intent ID mismatch")
    if ledger_entry.get("intent_hash") and ledger_entry["intent_hash"] != receipt["hash_chain"]["intent_hash"]:
        errors.append("Intent hash mismatch")
    return {
        "valid": receipt_result["valid"] and len(errors) == len(receipt_result["errors"]),
        "receipt_id": receipt["receipt_id"],
        "entry_id": ledger_entry.get("entry_id"),
        "receipt_valid": receipt_result["valid"],
        "cross_references_valid": len(errors) == len(receipt_result["errors"]),
        "errors": errors,
    }


def verify_receipt_batch(receipts: list) -> dict:
    """Verify multiple receipts in batch."""
    results = [verify_receipt_standalone(r) for r in receipts]
    valid_count = sum(1 for r in results if r["valid"])
    return {
        "total": len(receipts), "valid": valid_count,
        "invalid": len(results) - valid_count,
        "all_valid": all(r["valid"] for r in results),
        "results": results,
    }
