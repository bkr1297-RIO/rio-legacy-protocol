import json
# ══════════════════════════════════════════════════════════════════════
# LEGACY — This file uses the pre-v2.2 receipt schema (id, action.type,
# signature, public_key). It is preserved for backward compatibility
# with Damon's Ed25519 signing work.
#
# For the current v2.2 implementation, use:
#   pip install rio-receipt-protocol
#   from rio_receipt_protocol import verify_receipt
#
# Or see: python/rio_receipt_protocol/verifier.py
# ══════════════════════════════════════════════════════════════════════

import hashlib
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

def load_receipt(file_path):
    """Loads a RIO Receipt from a JSON file."""
    with open(file_path, 'r') as f:
        return json.load(f)

def verify_receipt_signature(receipt):
    """Verifies the Ed25519 signature of a single RIO Receipt (legacy pre-v2.2 schema)."""
    # Uses Ed25519 signature verification via PyNaCl.
    # The signed payload is: id + action.type + agent_id + timestamp (legacy schema).
    required_fields = ['id', 'action', 'agent_id', 'timestamp', 'signature', 'public_key']
    if not all(field in receipt for field in required_fields):
        print("Error: Receipt missing one or more required fields for signature verification.")
        return False

    try:
        signature = bytes.fromhex(receipt['signature'])
        public_key = bytes.fromhex(receipt['public_key'])

        # Reconstruct the signed payload: receipt_id + action + agent_id + timestamp
        payload_str = receipt["id"] + receipt["action"]["type"] + receipt["agent_id"] + receipt["timestamp"]
        payload = payload_str.encode('utf-8')

        verify_key = VerifyKey(public_key)
        verify_key.verify(payload, signature)
        return True
    except BadSignatureError:
        print(f"Signature verification FAILED for receipt ID: {receipt.get('id', 'N/A')}")
        return False
    except Exception as e:
        print(f"An error occurred during signature verification: {e}")
    return False

def canonicalize_for_hash(receipt: dict) -> bytes:
    """Produce a canonical, deterministic byte representation of the receipt for hashing.
    Excludes signature, public_key, and ledger_hash.
    """
    excluded = {"signature", "public_key", "ledger_hash"}
    filtered = {k: v for k, v in receipt.items() if k not in excluded}
    return json.dumps(filtered, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def calculate_hash(data):
    """Calculates the SHA-256 hash of a JSON object."""
    # Ensure consistent JSON serialization for hashing
    canonical = canonicalize_for_hash(data)
    return hashlib.sha256(canonical).hexdigest()

def verify_hash_chain(ledger_entries):
    """Verifies the SHA-256 hash chain of a list of ledger entries.
    Each entry must contain 'hash' and 'previous_hash' fields.
    """
    if not ledger_entries:
        print("No ledger entries to verify.")
        return True

    for i in range(len(ledger_entries) - 1, 0, -1):
        current_entry = ledger_entries[i]
        previous_entry = ledger_entries[i-1]

        if 'hash' not in current_entry or 'previous_hash' not in current_entry:
            print(f"Error: Ledger entry {i} missing 'hash' or 'previous_hash'.")
            return False
        if 'hash' not in previous_entry:
            print(f"Error: Ledger entry {i-1} missing 'hash'.")
            return False

        # Verify that the current entry's previous_hash matches the actual hash of the previous entry
        if current_entry['previous_hash'] != previous_entry['hash']:
            print(f"Hash chain broken at entry {i}: current.previous_hash ({current_entry['previous_hash']}) != previous.hash ({previous_entry['hash']})")
            return False

        # Optionally, re-calculate the hash of the previous entry's content to ensure integrity
        # This would require the full content of the previous entry, not just its hash.
        # For this basic verifier, we're trusting the 'hash' field of the previous entry.

    print("Hash chain verified successfully.")
    return True

def verify_rio_receipt(receipt_file_path, ledger_file_path=None):
    """Performs a full verification of a RIO Receipt and its ledger chain.
    """
    print(f"\n--- Verifying Receipt: {receipt_file_path} ---")
    receipt = load_receipt(receipt_file_path)

    # 1. Verify individual receipt signature (placeholder)
    if not verify_receipt_signature(receipt):
        print("Receipt signature verification FAILED.")
        return False
    print("Receipt signature verification PASSED.")

    # 2. Verify hash chain if a ledger is provided
    if ledger_file_path:
        print(f"--- Verifying Ledger Chain: {ledger_file_path} ---")
        ledger_entries = load_receipt(ledger_file_path) # Assuming ledger is a list of entries
        if not isinstance(ledger_entries, list):
            print("Error: Ledger file does not contain a list of entries.")
            return False

        # Find the receipt in the ledger to get its hash and previous_hash for chain verification
        receipt_hash_in_ledger = None
        for entry in ledger_entries:
            if entry.get('id') == receipt.get('id'):
                receipt_hash_in_ledger = entry.get('hash')
                break

        if not receipt_hash_in_ledger:
            print("Warning: Receipt not found in the provided ledger for full chain verification.")
            # Proceed with chain verification if possible, or mark as partial success

        if not verify_hash_chain(ledger_entries):
            print("Ledger hash chain verification FAILED.")
            return False
        print("Ledger hash chain verification PASSED.")
    else:
        print("No ledger file provided for hash chain verification.")

    print(f"--- Verification COMPLETE for {receipt_file_path} ---")
    return True

if __name__ == '__main__':
    # Example usage (will be replaced by conformance_test.py)
    print("This script is intended to be used by conformance_test.py. No direct execution example provided yet.")
