"""
RIO Receipt Protocol — Receipt Generation and Verification

Zero external dependencies beyond the Python standard library.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone


def sha256(data: str) -> str:
    """Compute SHA-256 hash of a string. Returns 64-char lowercase hex."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def hash_intent(intent_id: str, action: str, agent_id: str, parameters: dict, timestamp: str) -> str:
    """Hash an intent object using canonical field order."""
    canonical = json.dumps(
        {"intent_id": intent_id, "action": action, "agent_id": agent_id,
         "parameters": parameters, "timestamp": timestamp},
        separators=(",", ":"), ensure_ascii=False,
    )
    return sha256(canonical)


def hash_execution(intent_id: str, action: str, result: object, connector: str, timestamp: str) -> str:
    """Hash an execution record using canonical field order."""
    canonical = json.dumps(
        {"intent_id": intent_id, "action": action, "result": result,
         "connector": connector, "timestamp": timestamp},
        separators=(",", ":"), ensure_ascii=False,
    )
    return sha256(canonical)


def hash_governance(intent_id: str, status: str, risk_level: str, requires_approval: bool, checks: list) -> str:
    """Hash a governance decision. Optional — only for governed receipts."""
    canonical = json.dumps(
        {"intent_id": intent_id, "status": status, "risk_level": risk_level,
         "requires_approval": requires_approval, "checks": checks},
        separators=(",", ":"), ensure_ascii=False,
    )
    return sha256(canonical)


def hash_authorization(intent_id: str, decision: str, authorized_by: str, timestamp: str, conditions=None) -> str:
    """Hash an authorization record. Optional — only for governed receipts."""
    canonical = json.dumps(
        {"intent_id": intent_id, "decision": decision, "authorized_by": authorized_by,
         "timestamp": timestamp, "conditions": conditions},
        separators=(",", ":"), ensure_ascii=False,
    )
    return sha256(canonical)


def _build_chain_order(data: dict) -> list:
    order = ["intent_hash"]
    if data.get("governance_hash"):
        order.append("governance_hash")
    if data.get("authorization_hash"):
        order.append("authorization_hash")
    order.append("execution_hash")
    order.append("receipt_hash")
    return order


def generate_receipt(
    intent_hash: str, execution_hash: str, intent_id: str, action: str, agent_id: str,
    governance_hash: str = None, authorization_hash: str = None,
    authorized_by: str = None, receipt_type: str = None,
    ingestion: dict = None, identity_binding: dict = None,
) -> dict:
    """Generate a RIO Receipt (v2.2)."""
    receipt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"

    is_governed = bool(governance_hash and authorization_hash)
    if receipt_type is None:
        receipt_type = "governed_action" if is_governed else "action"

    data = {"intent_hash": intent_hash, "execution_hash": execution_hash,
            "governance_hash": governance_hash, "authorization_hash": authorization_hash}
    chain_order = _build_chain_order(data)

    receipt_content = {"receipt_id": receipt_id}
    for field in chain_order:
        if field != "receipt_hash":
            receipt_content[field] = data[field]
    receipt_content["timestamp"] = timestamp
    receipt_hash = sha256(json.dumps(receipt_content, separators=(",", ":"), ensure_ascii=False))

    receipt = {
        "receipt_id": receipt_id, "receipt_type": receipt_type,
        "intent_id": intent_id, "action": action, "agent_id": agent_id,
        "authorized_by": authorized_by, "timestamp": timestamp,
        "hash_chain": {
            "intent_hash": intent_hash, "governance_hash": governance_hash,
            "authorization_hash": authorization_hash, "execution_hash": execution_hash,
            "receipt_hash": receipt_hash,
        },
        "verification": {
            "algorithm": "SHA-256", "chain_length": len(chain_order), "chain_order": chain_order,
        },
    }

    if ingestion:
        receipt["ingestion"] = {
            "source": ingestion.get("source"), "channel": ingestion.get("channel"),
            "source_message_id": ingestion.get("source_message_id"),
            "timestamp": ingestion.get("timestamp", timestamp),
        }
    if identity_binding:
        receipt["identity_binding"] = {
            "signer_id": identity_binding.get("signer_id"),
            "public_key_hex": identity_binding.get("public_key_hex"),
            "signature_payload_hash": identity_binding.get("signature_payload_hash"),
            "verification_method": identity_binding.get("verification_method"),
            "ed25519_signed": identity_binding.get("ed25519_signed", False),
        }

    return receipt


def verify_receipt(receipt: dict) -> dict:
    """Verify a receipt by recomputing the receipt hash from its components."""
    chain_order = receipt.get("verification", {}).get("chain_order",
        ["intent_hash", "execution_hash", "receipt_hash"])

    receipt_content = {"receipt_id": receipt["receipt_id"]}
    for field in chain_order:
        if field != "receipt_hash":
            receipt_content[field] = receipt["hash_chain"][field]
    receipt_content["timestamp"] = receipt["timestamp"]

    computed_hash = sha256(json.dumps(receipt_content, separators=(",", ":"), ensure_ascii=False))
    stored_hash = receipt["hash_chain"]["receipt_hash"]

    return {
        "valid": computed_hash == stored_hash,
        "computed_hash": computed_hash, "stored_hash": stored_hash,
        "receipt_id": receipt["receipt_id"],
        "receipt_type": receipt.get("receipt_type", "action"),
    }
