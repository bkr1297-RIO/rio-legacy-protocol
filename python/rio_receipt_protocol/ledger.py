"""
RIO Receipt Protocol — Tamper-Evident Ledger

Zero external dependencies beyond the Python standard library.
"""

import json
import os
import uuid
from datetime import datetime, timezone

from .receipts import sha256

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


def _canonicalize(entry: dict) -> str:
    return json.dumps(
        {"entry_id": entry["entry_id"], "prev_hash": entry["prev_hash"],
         "timestamp": entry["timestamp"], "intent_id": entry["intent_id"],
         "action": entry["action"], "agent_id": entry["agent_id"],
         "status": entry["status"], "detail": entry["detail"],
         "receipt_hash": entry.get("receipt_hash"),
         "authorization_hash": entry.get("authorization_hash"),
         "intent_hash": entry.get("intent_hash")},
        separators=(",", ":"), ensure_ascii=False,
    )


class Ledger:
    def __init__(self, file_path: str = None):
        self._entries = []
        self._current_hash = GENESIS_HASH
        self._file_path = file_path
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    self._entries = json.load(f)
                if self._entries:
                    self._current_hash = self._entries[-1]["ledger_hash"]
            except Exception:
                self._entries = []
                self._current_hash = GENESIS_HASH

    def _persist(self):
        if not self._file_path:
            return
        os.makedirs(os.path.dirname(self._file_path) or ".", exist_ok=True)
        with open(self._file_path, "w", encoding="utf-8") as f:
            json.dump(self._entries, f, indent=2, ensure_ascii=False)

    def append(self, intent_id: str, action: str, agent_id: str, status: str, detail: str,
               receipt_hash: str = None, authorization_hash: str = None, intent_hash: str = None) -> dict:
        prev_hash = self._current_hash
        now = datetime.now(timezone.utc)
        timestamp = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"
        entry = {
            "entry_id": str(uuid.uuid4()), "prev_hash": prev_hash, "ledger_hash": None,
            "timestamp": timestamp, "intent_id": intent_id, "action": action,
            "agent_id": agent_id, "status": status, "detail": detail,
            "receipt_hash": receipt_hash, "authorization_hash": authorization_hash,
            "intent_hash": intent_hash,
        }
        entry["ledger_hash"] = sha256(_canonicalize(entry))
        self._current_hash = entry["ledger_hash"]
        self._entries.append(entry)
        self._persist()
        return entry

    def verify_chain(self) -> dict:
        if not self._entries:
            return {"valid": True, "entries_checked": 0, "first_invalid": None}
        prev = GENESIS_HASH
        for i, e in enumerate(self._entries):
            if e["prev_hash"] != prev:
                return {"valid": False, "entries_checked": i + 1, "first_invalid": i,
                        "reason": f"Entry {i} prev_hash mismatch. Expected: {prev}, Got: {e['prev_hash']}"}
            computed = sha256(_canonicalize(e))
            if computed != e["ledger_hash"]:
                return {"valid": False, "entries_checked": i + 1, "first_invalid": i,
                        "reason": f"Entry {i} hash mismatch. Computed: {computed}, Stored: {e['ledger_hash']}"}
            prev = e["ledger_hash"]
        return {"valid": True, "entries_checked": len(self._entries), "first_invalid": None}

    def get_entries(self, limit: int = 100, offset: int = 0) -> list:
        return self._entries[offset:offset + limit]

    def get_entries_by_intent(self, intent_id: str) -> list:
        return [e for e in self._entries if e["intent_id"] == intent_id]

    def get_entry_count(self) -> int:
        return len(self._entries)

    def get_current_hash(self) -> str:
        return self._current_hash

    def get_latest_entry(self) -> dict:
        return self._entries[-1] if self._entries else None

    def export(self) -> list:
        return json.loads(json.dumps(self._entries))


def create_ledger(file_path: str = None) -> Ledger:
    """Create a new Ledger instance."""
    return Ledger(file_path=file_path)
