#!/usr/bin/env python3
"""
sign_receipt.py — RIO Receipt Protocol
Canonicalize and sign a receipt JSON using ECDSA secp256k1.

Usage:
    python sign_receipt.py --receipt <path/to/receipt.json> --key <path/to/private_key.pem> [--out <path/to/signed_receipt.json>]

If --out is not specified, the signed receipt is written to stdout.

Key generation (one-time setup):
    openssl ecparam -name secp256k1 -genkey -noout -out private_key.pem
    openssl ec -in private_key.pem -pubout -out public_key.pem
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from nacl.signing import SigningKey
from nacl.encoding import HexEncoder


def load_receipt(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def canonicalize_for_signing(receipt: dict) -> bytes:
    """Reconstruct the payload that was signed: id + action + agent_id + timestamp."""
    payload_str = receipt["id"] + receipt["action"]["type"] + receipt["agent_id"] + receipt["timestamp"]
    return payload_str.encode("utf-8")

def canonicalize_for_hash(receipt: dict) -> bytes:
    """Produce a canonical, deterministic byte representation of the receipt for hashing.
    Excludes signature, public_key, and ledger_hash.
    """
    excluded = {"signature", "public_key", "ledger_hash"}
    filtered = {k: v for k, v in receipt.items() if k not in excluded}
    return json.dumps(filtered, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_ledger_hash(canonical_bytes: bytes) -> str:
    """SHA-256 hash of the canonical receipt bytes (hex string)."""
    return hashlib.sha256(canonical_bytes).hexdigest()


def generate_keypair():
    """Generates a new Ed25519 signing key and returns it along with its verify key."""
    signing_key = SigningKey.generate()
    return signing_key, signing_key.verify_key

def sign_bytes(data: bytes, signing_key: SigningKey) -> str:
    """
    Sign data using Ed25519 via PyNaCl.
    Returns a hex-encoded signature string.
    """
    signed = signing_key.sign(data)
    return signed.signature.hex()


def main():
    parser = argparse.ArgumentParser(description="Sign a RIO receipt JSON using ECDSA secp256k1.")
    parser.add_argument("--receipt", required=True, help="Path to the unsigned receipt JSON file.")
    parser.add_argument("--key", help="Path to an existing hex-encoded Ed25519 private key. If not provided, a new keypair will be generated.")
    parser.add_argument("--out", default=None, help="Output path for the signed receipt JSON. Defaults to stdout.")
    args = parser.parse_args()

    receipt = load_receipt(args.receipt)

    # Remove any existing signature and ledger_hash before computing
    receipt.pop("signature", None)
    receipt.pop("ledger_hash", None)

    # Generate or load signing key
    if args.key:
        signing_key = SigningKey(Path(args.key).read_text().strip(), encoder=HexEncoder)
    else:
        signing_key, verify_key = generate_keypair()
        print(f"Generated new signing key: {signing_key.encode(HexEncoder).decode()}", file=sys.stderr)
        print(f"Generated new public key: {verify_key.encode(HexEncoder).decode()}", file=sys.stderr)

    # Get public key from signing key
    public_key = signing_key.verify_key.encode(HexEncoder).decode()

    # Prepare payload for signing
    payload_to_sign = canonicalize_for_signing(receipt)
    signature = sign_bytes(payload_to_sign, signing_key)

    # Compute ledger hash for the receipt content (excluding signature and public_key)
    ledger_hash = compute_ledger_hash(canonicalize_for_hash(receipt))

    receipt["ledger_hash"] = ledger_hash
    receipt["signature"] = signature
    receipt["public_key"] = public_key
    receipt["verification_method"] = "ed25519"

    signed_json = json.dumps(receipt, indent=2, ensure_ascii=False)

    if args.out:
        Path(args.out).write_text(signed_json, encoding="utf-8")
        print(f"Signed receipt written to: {args.out}", file=sys.stderr)
    else:
        print(signed_json)


if __name__ == "__main__":
    main()
