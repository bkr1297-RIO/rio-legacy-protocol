import sys
import os
import json
from nacl.signing import SigningKey, VerifyKey
from nacl.encoding import HexEncoder
from pathlib import Path

# Add the parent directory to the sys.path to import verifier.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'reference')))
import verifier

# Define paths to example files
VALID_RECEIPT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'sample_receipt_valid.json'))
INVALID_RECEIPT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'sample_receipt_invalid.json'))
LEDGER_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'sample_ledger.json'))

def run_test(test_name, func, *args, expected_result=True):
    print(f"\n--- Running Test: {test_name} ---")
    result = func(*args)
    if result == expected_result:
        print(f"Test PASSED: {test_name}")
    else:
        print(f"Test FAILED: {test_name}. Expected {expected_result}, got {result}")
    return result

if __name__ == '__main__':
    print("\n===== RIO Receipt Protocol Conformance Tests =====")

    # --- Setup for Signature Tests ---
    # Generate a keypair for testing
    signing_key = SigningKey.generate()
    public_key_hex = signing_key.verify_key.encode(HexEncoder).decode()
    private_key_hex = signing_key.encode(HexEncoder).decode()

    # Load a base receipt for signing
    base_receipt = verifier.load_receipt(VALID_RECEIPT_PATH)

    # Create a valid signed receipt
    valid_signed_receipt = dict(base_receipt) # Create a copy
    valid_signed_receipt.pop("signature", None)
    valid_signed_receipt.pop("public_key", None)
    valid_signed_receipt.pop("ledger_hash", None)

    # Reconstruct the signed payload: id + action + agent_id + timestamp
    payload_str = valid_signed_receipt["id"] + valid_signed_receipt["action"]["type"] + valid_signed_receipt["agent_id"] + valid_signed_receipt["timestamp"]
    payload_to_sign = payload_str.encode("utf-8")

    signature = signing_key.sign(payload_to_sign).signature.hex()

    valid_signed_receipt["signature"] = signature
    valid_signed_receipt["public_key"] = public_key_hex
    valid_signed_receipt["verification_method"] = "ed25519"
    valid_signed_receipt["ledger_hash"] = verifier.calculate_hash(valid_signed_receipt)

    temp_valid_signed_receipt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'temp_valid_signed_receipt.json'))
    with open(temp_valid_signed_receipt_path, 'w') as f:
        json.dump(valid_signed_receipt, f, indent=4)

    # Create an invalid signed receipt (tamper with signature)
    invalid_signed_receipt = dict(valid_signed_receipt)
    invalid_signed_receipt["signature"] = "a" * len(invalid_signed_receipt["signature"]) # Tamper with signature

    temp_invalid_signed_receipt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'temp_invalid_signed_receipt.json'))
    with open(temp_invalid_signed_receipt_path, 'w') as f:
        json.dump(invalid_signed_receipt, f, indent=4)

    # Test 1: Valid receipt signature verification
    run_test(
        "Valid Receipt Signature",
        lambda: verifier.verify_receipt_signature(verifier.load_receipt(temp_valid_signed_receipt_path)),
        expected_result=True
    )

    # Test 2: Invalid receipt signature verification
    run_test(
        "Invalid Receipt Signature",
        lambda: verifier.verify_receipt_signature(verifier.load_receipt(temp_invalid_signed_receipt_path)),
        expected_result=False
    )

    # Test 3: Hash chain verification with valid ledger
    # For this test, we need to simulate the actual hashes for the ledger entries
    # The verifier.py currently only checks previous_hash == previous_entry.hash
    # Let's create a ledger with correct hashes for testing.
    print("\n--- Preparing Ledger for Hash Chain Test ---")
    genesis_entry = {
        "id": "genesis-001",
        "timestamp": "2026-04-01T15:59:00Z",
        "previous_hash": "0"
    }
    genesis_entry["hash"] = verifier.calculate_hash(genesis_entry)

    valid_receipt_content = verifier.load_receipt(VALID_RECEIPT_PATH)
    valid_receipt_entry = {
        "id": valid_receipt_content["id"],
        "timestamp": valid_receipt_content["timestamp"],
        "previous_hash": genesis_entry["hash"]
    }
    valid_receipt_entry["hash"] = verifier.calculate_hash(valid_receipt_entry)

    ledger_for_test = [genesis_entry, valid_receipt_entry]

    # Save this generated ledger to a temporary file for the test
    temp_ledger_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'temp_valid_ledger.json'))
    with open(temp_ledger_path, 'w') as f:
        json.dump(ledger_for_test, f, indent=4)

    run_test(
        "Hash Chain Verification (Valid)",
        verifier.verify_hash_chain,
        ledger_for_test,
        expected_result=True
    )

    # Test 4: Hash chain verification with broken ledger
    broken_ledger_for_test = list(ledger_for_test)
    # Tamper with the previous_hash of the second entry
    broken_ledger_for_test[1]["previous_hash"] = "tampered_hash"

    run_test(
        "Hash Chain Verification (Broken)",
        verifier.verify_hash_chain,
        broken_ledger_for_test,
        expected_result=False
    )

    # Test 5: Full RIO Receipt verification with valid ledger
    run_test(
        "Full RIO Receipt Verification (Valid)",
        verifier.verify_rio_receipt,
        VALID_RECEIPT_PATH,
        temp_ledger_path,
        expected_result=True
    )

    # Test 6: Full RIO Receipt verification with broken ledger
    # For this, we need to create a temporary ledger file with a broken chain
    temp_broken_ledger_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'examples', 'temp_broken_ledger.json'))
    with open(temp_broken_ledger_path, 'w') as f:
        json.dump(broken_ledger_for_test, f, indent=4)

    run_test(
        "Full RIO Receipt Verification (Broken Ledger)",
        verifier.verify_rio_receipt,
        VALID_RECEIPT_PATH,
        temp_broken_ledger_path,
        expected_result=False
    )

    # Clean up temporary files
    os.remove(temp_ledger_path)
    os.remove(temp_broken_ledger_path)
    os.remove(temp_valid_signed_receipt_path)
    os.remove(temp_invalid_signed_receipt_path)
    print("\n===== Conformance Tests Complete =====")
