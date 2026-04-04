"""
RIO Receipt Protocol — Python Implementation (v2.3)

Cryptographic proof for AI actions. Open standard. Zero required dependencies.
"""

__version__ = "2.3.0"

from .receipts import (
    sha256, hash_intent, hash_execution, hash_governance, hash_authorization,
    generate_receipt, verify_receipt,
    generate_keypair, sign_receipt,
)
from .ledger import GENESIS_HASH, create_ledger
from .verifier import (
    verify_receipt_standalone, verify_chain,
    verify_receipt_against_ledger, verify_receipt_batch,
)

__all__ = [
    "sha256", "hash_intent", "hash_execution", "hash_governance", "hash_authorization",
    "generate_receipt", "verify_receipt",
    "generate_keypair", "sign_receipt",
    "GENESIS_HASH", "create_ledger",
    "verify_receipt_standalone", "verify_chain", "verify_receipt_against_ledger", "verify_receipt_batch",
]
