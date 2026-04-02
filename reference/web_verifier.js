/**
 * RIO Receipt Protocol — Web Verifier (v2.2)
 *
 * Browser-compatible verifier for RIO Receipts and Ledger chains.
 * Uses the Web Crypto API for SHA-256 hashing and Ed25519 signature
 * verification. Supports both proof-layer receipts (3-hash) and
 * governed receipts (5-hash).
 *
 * Logic mirrors reference/verifier.mjs (receipt verification) and
 * reference/ledger.mjs (chain verification) exactly.
 *
 * Zero external dependencies — runs in any modern browser.
 *
 * @module rio-receipt-protocol/web-verifier
 * @version 2.2.0
 * @license MIT OR Apache-2.0
 */

const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

// ─── Utilities ──────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a string using Web Crypto API.
 * @param {string} data - The string to hash
 * @returns {Promise<string>} Lowercase hex-encoded SHA-256 hash (64 characters)
 */
async function sha256(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert a hex string to a Uint8Array.
 * @param {string} hex - Hex-encoded string
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) throw new Error("Invalid hex string");
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

// ─── Receipt Verification ───────────────────────────────────────────

/**
 * Verify a single RIO Receipt (v2.2).
 *
 * Supports both proof-layer receipts (chain_length 3: intent, execution, receipt)
 * and governed receipts (chain_length 5: intent, governance, authorization, execution, receipt).
 * Uses the receipt's own chain_order to determine verification.
 *
 * Logic matches reference/verifier.mjs exactly.
 *
 * @param {object} receipt - A RIO Receipt object
 * @returns {Promise<object>} Verification result
 */
export async function verifyReceipt(receipt) {
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
        errors.push(
          `Invalid hash format for hash_chain.${field}: expected 64 hex chars`
        );
      }
    }

    // Governance/authorization hashes: validate format if present, but not required
    const optionalFields = ["governance_hash", "authorization_hash"];
    for (const field of optionalFields) {
      const val = receipt.hash_chain[field];
      if (val && val !== null && !/^[a-f0-9]{64}$/.test(val)) {
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

  // 2. Determine chain_order from the receipt itself
  const chainOrder = receipt.verification?.chain_order || [
    "intent_hash",
    "execution_hash",
    "receipt_hash",
  ];

  // 3. Recompute receipt hash using the receipt's chain_order
  //    Content = { receipt_id, <each hash in chain_order except receipt_hash>, timestamp }
  const receiptContent = { receipt_id: receipt.receipt_id };
  for (const field of chainOrder) {
    if (field !== "receipt_hash") {
      receiptContent[field] = receipt.hash_chain[field];
    }
  }
  receiptContent.timestamp = receipt.timestamp;
  const computedHash = await sha256(JSON.stringify(receiptContent));
  const storedHash = receipt.hash_chain.receipt_hash;

  // 4. Check verification metadata
  if (receipt.verification) {
    if (receipt.verification.algorithm !== "SHA-256") {
      errors.push(
        `Unexpected algorithm: ${receipt.verification.algorithm} (expected SHA-256)`
      );
    }
    const expectedLength = chainOrder.length;
    if (receipt.verification.chain_length !== expectedLength) {
      errors.push(
        `chain_length ${receipt.verification.chain_length} does not match chain_order length ${expectedLength}`
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
    receipt_type: receipt.receipt_type || "action",
    computed_hash: computedHash,
    stored_hash: storedHash,
    chain_length: chainOrder.length,
    errors,
  };
}

// ─── Ledger Chain Verification ──────────────────────────────────────

/**
 * Build the canonical JSON string for a ledger entry.
 * Field order MUST match reference/ledger.mjs exactly.
 *
 * @param {object} entry - A ledger entry
 * @returns {string} Canonical JSON string
 */
function canonicalizeLedgerEntry(entry) {
  return JSON.stringify({
    entry_id: entry.entry_id,
    prev_hash: entry.prev_hash,
    timestamp: entry.timestamp,
    intent_id: entry.intent_id,
    action: entry.action,
    agent_id: entry.agent_id,
    status: entry.status,
    detail: entry.detail,
    receipt_hash: entry.receipt_hash || null,
    authorization_hash: entry.authorization_hash || null,
    intent_hash: entry.intent_hash || null,
  });
}

/**
 * Verify a ledger hash chain.
 *
 * Checks prev_hash linkage and recomputes ledger_hash for each entry.
 * Logic matches reference/verifier.mjs verifyChain() and
 * reference/ledger.mjs verifyChain() exactly.
 *
 * @param {Array} entries - Ordered array of ledger entries
 * @returns {Promise<object>} Chain verification result
 */
export async function verifyChain(entries) {
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

    // Recompute ledger_hash from canonical content
    const computed = await sha256(canonicalizeLedgerEntry(e));

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

// ─── Ed25519 Signature Verification ─────────────────────────────────

/**
 * Verify the Ed25519 signature on a receipt using the Web Crypto API.
 *
 * Uses the v2.2 identity_binding fields:
 *   - identity_binding.public_key_hex (hex-encoded Ed25519 public key)
 *   - identity_binding.signature_payload_hash (the receipt_hash that was signed)
 *   - identity_binding.verification_method (must be "ed25519-nacl")
 *   - identity_binding.ed25519_signed (must be true)
 *
 * Per spec/signing-rules.md Section 4.2, the signed payload is the
 * UTF-8 bytes of the 64-character hex receipt_hash string.
 *
 * NOTE: Ed25519 via Web Crypto API requires a browser that supports it
 * (Chrome 113+, Edge 113+, Safari 17+). For older browsers, use a
 * polyfill such as tweetnacl.
 *
 * @param {object} receipt - A RIO Receipt with identity_binding
 * @param {Uint8Array} signature - The Ed25519 signature bytes
 * @returns {Promise<object>} Signature verification result
 */
export async function verifySignature(receipt, signature) {
  const errors = [];

  // Check identity_binding exists and is signed
  if (!receipt.identity_binding) {
    return {
      valid: false,
      signed: false,
      errors: ["No identity_binding present on receipt"],
    };
  }

  const binding = receipt.identity_binding;

  if (!binding.ed25519_signed) {
    return {
      valid: false,
      signed: false,
      errors: ["Receipt is not Ed25519-signed (ed25519_signed is false)"],
    };
  }

  if (
    binding.verification_method &&
    binding.verification_method !== "ed25519-nacl"
  ) {
    errors.push(
      `Unexpected verification_method: ${binding.verification_method} (expected ed25519-nacl)`
    );
  }

  if (!binding.public_key_hex || !/^[a-f0-9]{64}$/.test(binding.public_key_hex)) {
    errors.push("Missing or invalid public_key_hex (expected 64 hex chars)");
  }

  if (
    !binding.signature_payload_hash ||
    !/^[a-f0-9]{64}$/.test(binding.signature_payload_hash)
  ) {
    errors.push(
      "Missing or invalid signature_payload_hash (expected 64 hex chars)"
    );
  }

  if (errors.length > 0) {
    return { valid: false, signed: true, errors };
  }

  // Verify that signature_payload_hash matches the receipt's receipt_hash
  if (
    binding.signature_payload_hash !== receipt.hash_chain.receipt_hash
  ) {
    errors.push(
      `signature_payload_hash (${binding.signature_payload_hash}) does not match receipt_hash (${receipt.hash_chain.receipt_hash})`
    );
    return { valid: false, signed: true, errors };
  }

  try {
    // Import the Ed25519 public key
    const publicKeyBytes = hexToBytes(binding.public_key_hex);
    const algorithm = { name: "Ed25519" };
    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      algorithm,
      true,
      ["verify"]
    );

    // The signed payload is the UTF-8 bytes of the receipt_hash string
    const payload = new TextEncoder().encode(receipt.hash_chain.receipt_hash);

    const isValid = await crypto.subtle.verify(
      algorithm,
      key,
      signature,
      payload
    );

    if (!isValid) {
      errors.push("Ed25519 signature verification failed");
    }

    return {
      valid: isValid,
      signed: true,
      signer_id: binding.signer_id,
      errors,
    };
  } catch (e) {
    errors.push(`Signature verification error: ${e.message}`);
    return { valid: false, signed: true, errors };
  }
}

// ─── Cross-Verification ─────────────────────────────────────────────

/**
 * Verify that a receipt matches its corresponding ledger entry.
 *
 * @param {object} receipt - A RIO Receipt
 * @param {object} ledgerEntry - The ledger entry that recorded this receipt
 * @returns {Promise<object>} Cross-verification result
 */
export async function verifyReceiptAgainstLedger(receipt, ledgerEntry) {
  const receiptResult = await verifyReceipt(receipt);
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
    valid: receiptResult.valid && errors.length === receiptResult.errors.length,
    receipt_id: receipt.receipt_id,
    entry_id: ledgerEntry.entry_id,
    receipt_valid: receiptResult.valid,
    cross_references_valid: errors.length === receiptResult.errors.length,
    errors,
  };
}

// ─── Batch Verification ─────────────────────────────────────────────

/**
 * Verify multiple receipts in batch.
 *
 * @param {Array} receipts - Array of RIO Receipt objects
 * @returns {Promise<object>} Batch verification summary
 */
export async function verifyReceiptBatch(receipts) {
  const results = await Promise.all(receipts.map(verifyReceipt));
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
