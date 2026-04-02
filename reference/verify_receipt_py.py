#!/usr/bin/env python3
"""
verify_receipt.py — RIO Receipt Protocol (LEGACY)

══════════════════════════════════════════════════════════════════════
LEGACY — This file uses the pre-v2.2 receipt schema. It is preserved
for backward compatibility with Damon's Ed25519 signing work.

For the current v2.2 implementation, use:
  pip install rio-receipt-protocol
  from rio_receipt_protocol import verify_receipt

Or see: python/rio_receipt_protocol/verifier.py
══════════════════════════════════════════════════════════════════════

Original description:
Verify a signed receipt JSON: required fields, ledger_hash integrity, and ECDSA signature.

Usage:
    python verify_receipt.py --receipt <path/to/receipt.json> --key <path/to/public_key.pem>

    # To verify hash chain linkage against a previous receipt:
    python verify_receipt.py --receipt <path/to/receipt.json> --key <path/to/public_key.pem> --prev <path/to/previous_receipt.json>

Exit codes:
    0 — All checks passed (VALID)
    1 — One or more checks failed (INVALID)
"""

import argparse
import hashlib
import json
import sys
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError


REQUIRED_FIELDS = [
    "id",
    "action",
    "agent_id",
    "timestamp",
    "ledger_hash",
    "previous_hash",
    "signature",
    "public_key",
    "verification_method",
]


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def canonicalize_for_signing(receipt: dict) -> bytes:
    """Reconstruct the payload that was signed: id + action + agent_id + timestamp."""
    payload_str = f"{receipt["id"]}{receipt["action"]}{receipt["agent_id"]}{receipt["timestamp"]}"
    return payload_str.encode("utf-8")

def canonicalize_for_hash(receipt: dict) -> bytes:
    """Produce a canonical, deterministic byte representation of the receipt for hashing.
    Excludes signature, public_key, and ledger_hash.
    """
    excluded = {"signature", "public_key", "ledger_hash"}
    filtered = {k: v for k, v in receipt.items() if k not in excluded}
    return json.dumps(filtered, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def check_required_fields(receipt: dict) -> list[str]:
    """Return list of missing required fields."""
    return [f for f in REQUIRED_FIELDS if f not in receipt]


def check_ledger_hash(receipt: dict) -> tuple[bool, str]:
    """Recompute ledger_hash and compare to stored value."""
    canonical = canonicalize_for_hash(receipt)
    expected = hashlib.sha256(canonical).hexdigest()
    stored = receipt.get("ledger_hash", "")
    if expected == stored:
        return True, f"ledger_hash OK ({stored[:16]}...)"
    return False, f"ledger_hash MISMATCH\n  expected: {expected}\n  stored:   {stored}"


def check_chain_linkage(receipt: dict, prev_receipt: dict) -> tuple[bool, str]:
    """Verify that receipt.previous_hash matches prev_receipt.ledger_hash."""
    prev_hash = prev_receipt.get("ledger_hash", "")
    stored_prev = receipt.get("previous_hash", "")
    if prev_hash == stored_prev:
        return True, f"chain linkage OK (previous_hash matches prev receipt ledger_hash)"
    return False, f"chain linkage BROKEN\n  receipt.previous_hash: {stored_prev}\n  prev receipt ledger_hash: {prev_hash}"


def check_signature(receipt: dict) -> tuple[bool, str]:
    """Verify Ed25519 signature."""
    method = receipt.get("verification_method", "")
    if method != "ed25519":
        return False, f"Unsupported verification_method: \'{method}\'. This verifier supports \'ed25519\' only."

    try:
        signature = bytes.fromhex(receipt["signature"])
        public_key = bytes.fromhex(receipt["public_key"])

        # Reconstruct the signed payload: id + action + agent_id + timestamp
        payload = canonicalize_for_signing(receipt)

        verify_key = VerifyKey(public_key)
        verify_key.verify(payload, signature)
        return True, "signature OK"
    except BadSignatureError:
        return False, "signature INVALID \u2014 receipt may have been tampered with"
    except Exception as e:
        return False, f"signature verification error: {e}"


def print_result(label: str, passed: bool, detail: str):
    icon = "PASS" if passed else "FAIL"
    print(f"  [{icon}] {label}: {detail}")


def main():
    parser = argparse.ArgumentParser(description="Verify a RIO receipt JSON.")
    parser.add_argument("--receipt", required=True, help="Path to the receipt JSON file to verify.")
    # The public key is now expected to be part of the receipt JSON itself.
    # This argument is no longer needed for signature verification.
    # Keeping it for now but will be removed if it causes issues or is explicitly not needed.
    # parser.add_argument("--key", required=False, help="Path to the PEM-encoded secp256k1 public key.")
    parser.add_argument("--prev", default=None, help="Path to the previous receipt JSON (for chain linkage check).")
    args = parser.parse_args()

    receipt = load_json(args.receipt)
    results = []

    print(f"\nRIO Receipt Protocol — Verification Report")
    print(f"Receipt ID: {receipt.get('receipt_id', 'UNKNOWN')}")
    print(f"{'─' * 60}")

    # Check 1: Required fields
    missing = check_required_fields(receipt)
    if missing:
        results.append(False)
        print_result("required fields", False, f"missing: {', '.join(missing)}")
    else:
        results.append(True)
        print_result("required fields", True, "all present")

    # Check 2: Ledger hash integrity
    hash_ok, hash_detail = check_ledger_hash(receipt)
    results.append(hash_ok)
    print_result("ledger_hash integrity", hash_ok, hash_detail)

    # Check 3: Chain linkage (optional)
    if args.prev:
        prev_receipt = load_json(args.prev)
        chain_ok, chain_detail = check_chain_linkage(receipt, prev_receipt)
        results.append(chain_ok)
        print_result("hash chain linkage", chain_ok, chain_detail)
    else:
        print(f"  [SKIP] hash chain linkage: --prev not provided")

    # Check 4: Signature
    sig_ok, sig_detail = check_signature(receipt)
    results.append(sig_ok)
    print_result("signature", sig_ok, sig_detail)

    print(f"{'─' * 60}")
    all_passed = all(results)
    verdict = "VALID — all checks passed." if all_passed else "INVALID — one or more checks failed."
    print(f"  RESULT: {verdict}\n")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
