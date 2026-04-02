/**
 * RIO Receipt Protocol — Reference Implementation
 * Standalone Verifier
 *
 * Verifies receipts and ledger chains independently of the system
 * that produced them. Supports both proof-layer receipts (3-hash)
 * and governed receipts (5-hash).
 *
 * Zero external dependencies beyond Node.js built-ins.
 *
 * @module rio-receipt-protocol/verifier
 * @version 2.0.0
 * @license MIT OR Apache-2.0
 */

import { createHash, createPublicKey, verify } from "node:crypto";

const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// ─── Receipt Verification ────────────────────────────────────────────

/**
 * Verify a single RIO Receipt.
 *
 * Supports both proof-layer receipts (chain_length 3: intent, execution, receipt)
 * and governed receipts (chain_length 5: intent, governance, authorization, execution, receipt).
 * Uses the receipt's own chain_order to determine verification.
 *
 * @param {object} receipt - A RIO Receipt object
 * @returns {object} Verification result
 */
export function verifyReceipt(receipt) {
  const errors = [];

  // 1. Structural validation — core fields always required
  if (!receipt.receipt_id) errors.push("Missing receipt_id");
  if (!receipt.timestamp) errors.push("Missing timestamp");
  if (!receipt.hash_chain) errors.push("Missing hash_chain");

  if (receipt.hash_chain) {
    // Core fields always required
    const coreRequired = ["intent_hash", "execution_hash", "receipt_hash"];
    for (const field of coreRequired) {
      if (!receipt.hash_chain[field]) {
        errors.push(`Missing hash_chain.${field}`);
      } else if (!/^[a-f0-9]{64}$/.test(receipt.hash_chain[field])) {
        errors.push(`Invalid hash format for hash_chain.${field}: expected 64 hex chars`);
      }
    }

    // Governance/authorization hashes: validate format if present, but not required
    const optionalFields = ["governance_hash", "authorization_hash"];
    for (const field of optionalFields) {
      const val = receipt.hash_chain[field];
      if (val && val !== null && !/^[a-f0-9]{64}$/.test(val)) {
        errors.push(`Invalid hash format for hash_chain.${field}: expected 64 hex chars`);
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

  // 2. Determine chain_order from the receipt itself
  const chainOrder = receipt.verification?.chain_order || [
    "intent_hash",
    "execution_hash",
    "receipt_hash",
  ];

  // 3. Recompute receipt hash using the receipt's chain_order
  const receiptContent = { receipt_id: receipt.receipt_id };
  for (const field of chainOrder) {
    if (field !== "receipt_hash") {
      receiptContent[field] = receipt.hash_chain[field];
    }
  }
  receiptContent.timestamp = receipt.timestamp;
  const computedHash = sha256(JSON.stringify(receiptContent));
  const storedHash = receipt.hash_chain.receipt_hash;

  // 4. Check verification metadata
  if (receipt.verification) {
    if (receipt.verification.algorithm !== "SHA-256") {
      errors.push(`Unexpected algorithm: ${receipt.verification.algorithm} (expected SHA-256)`);
    }
    const expectedLength = chainOrder.length;
    if (receipt.verification.chain_length !== expectedLength) {
      errors.push(`chain_length ${receipt.verification.chain_length} does not match chain_order length ${expectedLength}`);
    }
  }

  const hashValid = computedHash === storedHash;
  if (!hashValid) {
    errors.push(`Receipt hash mismatch: computed ${computedHash}, stored ${storedHash}`);
  }

  // 5. Ed25519 signature verification (if present)
  let signatureValid = null; // null = not signed, true/false = verification result
  const ib = receipt.identity_binding;
  if (ib && ib.ed25519_signed === true) {
    signatureValid = false; // assume invalid until proven

    if (!ib.public_key_hex || !/^[a-f0-9]{64}$/.test(ib.public_key_hex)) {
      errors.push("Ed25519 signed but missing or invalid public_key_hex");
    } else if (!ib.signature_hex || typeof ib.signature_hex !== "string") {
      errors.push("Ed25519 signed but missing signature_hex");
    } else if (!ib.signature_payload_hash) {
      errors.push("Ed25519 signed but missing signature_payload_hash");
    } else {
      // Verify that signature_payload_hash matches the receipt_hash
      if (ib.signature_payload_hash !== receipt.hash_chain.receipt_hash) {
        errors.push(
          `signature_payload_hash (${ib.signature_payload_hash}) does not match receipt_hash (${receipt.hash_chain.receipt_hash})`
        );
      }

      // Reconstruct the public key from raw hex bytes
      try {
        const pubKeyBytes = Buffer.from(ib.public_key_hex, "hex");
        // Build Ed25519 SPKI DER: 12-byte header + 32-byte key
        const spkiHeader = Buffer.from("302a300506032b6570032100", "hex");
        const spkiDer = Buffer.concat([spkiHeader, pubKeyBytes]);
        const publicKey = createPublicKey({ key: spkiDer, format: "der", type: "spki" });

        const sigBytes = Buffer.from(ib.signature_hex, "hex");
        const payload = Buffer.from(receipt.hash_chain.receipt_hash, "utf-8");

        signatureValid = verify(null, payload, publicKey, sigBytes);
        if (!signatureValid) {
          errors.push("Ed25519 signature verification FAILED");
        }
      } catch (err) {
        errors.push(`Ed25519 verification error: ${err.message}`);
        signatureValid = false;
      }
    }
  }

  return {
    valid: hashValid && errors.length === 0,
    receipt_id: receipt.receipt_id,
    receipt_type: receipt.receipt_type || "action",
    computed_hash: computedHash,
    stored_hash: storedHash,
    chain_length: chainOrder.length,
    signature_valid: signatureValid,
    errors,
  };
}

// ─── Ledger Chain Verification ───────────────────────────────────────

/**
 * Verify a ledger hash chain.
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

    if (e.prev_hash !== prev) {
      return {
        valid: false,
        entries_checked: i + 1,
        first_invalid: i,
        reason: `Entry ${i} (${e.entry_id}) prev_hash mismatch. Expected: ${prev}, Got: ${e.prev_hash}`,
      };
    }

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

// ─── Cross-Verification ─────────────────────────────────────────────

/**
 * Verify that a receipt matches its corresponding ledger entry.
 *
 * @param {object} receipt - A RIO Receipt
 * @param {object} ledgerEntry - The ledger entry that recorded this receipt
 * @returns {object} Cross-verification result
 */
export function verifyReceiptAgainstLedger(receipt, ledgerEntry) {
  const receiptResult = verifyReceipt(receipt);
  const errors = [...receiptResult.errors];

  if (ledgerEntry.receipt_hash !== receipt.hash_chain.receipt_hash) {
    errors.push(
      `Ledger entry receipt_hash (${ledgerEntry.receipt_hash}) does not match receipt hash_chain.receipt_hash (${receipt.hash_chain.receipt_hash})`
    );
  }

  if (ledgerEntry.intent_id !== receipt.intent_id) {
    errors.push(
      `Intent ID mismatch: ledger says ${ledgerEntry.intent_id}, receipt says ${receipt.intent_id}`
    );
  }

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
