/**
 * RIO Receipt Protocol — Reference Implementation
 * Standalone Verifier
 *
 * Verifies receipts and ledger chains independently of the system
 * that produced them. This is the core of the "trust but verify" model:
 * any third party can take a receipt or a ledger export and confirm
 * its integrity without access to the original system.
 *
 * Zero external dependencies beyond Node.js built-ins.
 *
 * @module rio-receipt-protocol/verifier
 * @version 1.0.0
 * @license MIT OR Apache-2.0
 */

import { createHash } from "node:crypto";

const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Compute SHA-256 hash of a string.
 * @param {string} data
 * @returns {string} Lowercase hex-encoded SHA-256 hash
 */
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// ─── Receipt Verification ────────────────────────────────────────────

/**
 * Verify a single RIO Receipt.
 *
 * Recomputes the receipt_hash from the receipt's components and compares
 * it to the stored hash. This confirms the receipt has not been tampered
 * with since it was generated.
 *
 * @param {object} receipt - A RIO Receipt object
 * @returns {object} Verification result
 */
export function verifyReceipt(receipt) {
  const errors = [];

  // 1. Structural validation
  if (!receipt.receipt_id) errors.push("Missing receipt_id");
  if (!receipt.timestamp) errors.push("Missing timestamp");
  if (!receipt.hash_chain) errors.push("Missing hash_chain");
  if (receipt.hash_chain) {
    const required = [
      "intent_hash",
      "governance_hash",
      "authorization_hash",
      "execution_hash",
      "receipt_hash",
    ];
    for (const field of required) {
      if (!receipt.hash_chain[field]) {
        errors.push(`Missing hash_chain.${field}`);
      } else if (!/^[a-f0-9]{64}$/.test(receipt.hash_chain[field])) {
        errors.push(
          `Invalid hash format for hash_chain.${field}: expected 64 hex chars`
        );
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      receipt_id: receipt.receipt_id || "unknown",
      errors,
    };
  }

  // 2. Recompute receipt hash
  const receiptContent = JSON.stringify({
    receipt_id: receipt.receipt_id,
    intent_hash: receipt.hash_chain.intent_hash,
    governance_hash: receipt.hash_chain.governance_hash,
    authorization_hash: receipt.hash_chain.authorization_hash,
    execution_hash: receipt.hash_chain.execution_hash,
    timestamp: receipt.timestamp,
  });
  const computedHash = sha256(receiptContent);
  const storedHash = receipt.hash_chain.receipt_hash;

  // 3. Check verification metadata
  if (receipt.verification) {
    if (receipt.verification.algorithm !== "SHA-256") {
      errors.push(
        `Unexpected algorithm: ${receipt.verification.algorithm} (expected SHA-256)`
      );
    }
    if (receipt.verification.chain_length !== 5) {
      errors.push(
        `Unexpected chain_length: ${receipt.verification.chain_length} (expected 5)`
      );
    }
  }

  const hashValid = computedHash === storedHash;
  if (!hashValid) {
    errors.push(
      `Receipt hash mismatch: computed ${computedHash}, stored ${storedHash}`
    );
  }

  return {
    valid: hashValid && errors.length === 0,
    receipt_id: receipt.receipt_id,
    receipt_type: receipt.receipt_type || "governed_action",
    computed_hash: computedHash,
    stored_hash: storedHash,
    errors,
  };
}

// ─── Ledger Chain Verification ───────────────────────────────────────

/**
 * Verify a ledger hash chain.
 *
 * Takes an array of ledger entries (in order) and verifies:
 * 1. The first entry's prev_hash is the genesis hash
 * 2. Each entry's prev_hash matches the previous entry's ledger_hash
 * 3. Each entry's ledger_hash is correctly computed from its canonical content
 *
 * @param {Array} entries - Ordered array of ledger entries
 * @returns {object} Chain verification result
 */
export function verifyChain(entries) {
  if (!Array.isArray(entries)) {
    return {
      valid: false,
      entries_checked: 0,
      first_invalid: null,
      reason: "Input is not an array",
    };
  }

  if (entries.length === 0) {
    return { valid: true, entries_checked: 0, first_invalid: null };
  }

  let prev = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    // Check prev_hash linkage
    if (e.prev_hash !== prev) {
      return {
        valid: false,
        entries_checked: i + 1,
        first_invalid: i,
        reason: `Entry ${i} (${e.entry_id}) prev_hash mismatch. Expected: ${prev}, Got: ${e.prev_hash}`,
      };
    }

    // Recompute the hash using canonical field order
    const canonical = JSON.stringify({
      entry_id: e.entry_id,
      prev_hash: e.prev_hash,
      timestamp: e.timestamp,
      intent_id: e.intent_id,
      action: e.action,
      agent_id: e.agent_id,
      status: e.status,
      detail: e.detail,
      receipt_hash: e.receipt_hash || null,
      authorization_hash: e.authorization_hash || null,
      intent_hash: e.intent_hash || null,
    });
    const computed = sha256(canonical);

    if (computed !== e.ledger_hash) {
      return {
        valid: false,
        entries_checked: i + 1,
        first_invalid: i,
        reason: `Entry ${i} (${e.entry_id}) hash mismatch. Computed: ${computed}, Stored: ${e.ledger_hash}`,
      };
    }

    prev = e.ledger_hash;
  }

  return {
    valid: true,
    entries_checked: entries.length,
    first_invalid: null,
    chain_tip: prev,
  };
}

// ─── Full Verification (Receipt + Ledger Entry Match) ────────────────

/**
 * Verify that a receipt matches its corresponding ledger entry.
 *
 * Checks that the receipt_hash stored in the ledger entry matches
 * the receipt_hash in the receipt's hash_chain.
 *
 * @param {object} receipt - A RIO Receipt
 * @param {object} ledgerEntry - The ledger entry that recorded this receipt
 * @returns {object} Cross-verification result
 */
export function verifyReceiptAgainstLedger(receipt, ledgerEntry) {
  const receiptResult = verifyReceipt(receipt);
  const errors = [...receiptResult.errors];

  // Check that the ledger entry references this receipt
  if (ledgerEntry.receipt_hash !== receipt.hash_chain.receipt_hash) {
    errors.push(
      `Ledger entry receipt_hash (${ledgerEntry.receipt_hash}) does not match receipt hash_chain.receipt_hash (${receipt.hash_chain.receipt_hash})`
    );
  }

  // Check intent_id consistency
  if (ledgerEntry.intent_id !== receipt.intent_id) {
    errors.push(
      `Intent ID mismatch: ledger says ${ledgerEntry.intent_id}, receipt says ${receipt.intent_id}`
    );
  }

  // Check intent_hash consistency (if present in ledger entry)
  if (
    ledgerEntry.intent_hash &&
    ledgerEntry.intent_hash !== receipt.hash_chain.intent_hash
  ) {
    errors.push(
      `Intent hash mismatch: ledger says ${ledgerEntry.intent_hash}, receipt says ${receipt.hash_chain.intent_hash}`
    );
  }

  return {
    valid: receiptResult.valid && errors.length === 0,
    receipt_id: receipt.receipt_id,
    entry_id: ledgerEntry.entry_id,
    receipt_valid: receiptResult.valid,
    cross_references_valid: errors.length === receiptResult.errors.length,
    errors,
  };
}

// ─── Batch Verification ──────────────────────────────────────────────

/**
 * Verify multiple receipts in batch.
 *
 * @param {Array} receipts - Array of RIO Receipt objects
 * @returns {object} Batch verification summary
 */
export function verifyReceiptBatch(receipts) {
  const results = receipts.map(verifyReceipt);
  const valid = results.filter((r) => r.valid).length;
  const invalid = results.filter((r) => !r.valid).length;

  return {
    total: receipts.length,
    valid,
    invalid,
    all_valid: invalid === 0,
    results,
  };
}
