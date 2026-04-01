/**
 * RIO Receipt Protocol — Reference Implementation
 * Receipt Generation and Verification
 *
 * This module provides the core receipt functions for the RIO Receipt Protocol.
 * It has zero external dependencies beyond Node.js built-ins.
 *
 * The proof layer (open standard) requires only: intent + execution + receipt.
 * Governance and authorization are optional extensions for systems that
 * implement human approval workflows (e.g., the full RIO platform).
 *
 * @module rio-receipt-protocol/receipts
 * @version 2.2.0
 * @license MIT OR Apache-2.0
 */

import { createHash, randomUUID } from "node:crypto";

/**
 * Compute SHA-256 hash of a string.
 * @param {string} data - The string to hash
 * @returns {string} Lowercase hex-encoded SHA-256 hash (64 characters)
 */
export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Hash an intent object using canonical field order.
 * @param {object} intent
 * @returns {string} SHA-256 hash
 */
export function hashIntent(intent) {
  const canonical = JSON.stringify({
    intent_id: intent.intent_id,
    action: intent.action,
    agent_id: intent.agent_id,
    parameters: intent.parameters,
    timestamp: intent.timestamp,
  });
  return sha256(canonical);
}

/**
 * Hash an execution record using canonical field order.
 * @param {object} execution
 * @returns {string} SHA-256 hash
 */
export function hashExecution(execution) {
  const canonical = JSON.stringify({
    intent_id: execution.intent_id,
    action: execution.action,
    result: execution.result,
    connector: execution.connector,
    timestamp: execution.timestamp,
  });
  return sha256(canonical);
}

// ─── Optional Extension: Governance Hashing ─────────────────────────

/**
 * Hash a governance decision. Optional — only for governed receipts.
 * @param {object} governance
 * @returns {string} SHA-256 hash
 */
export function hashGovernance(governance) {
  const canonical = JSON.stringify({
    intent_id: governance.intent_id,
    status: governance.status,
    risk_level: governance.risk_level,
    requires_approval: governance.requires_approval,
    checks: governance.checks,
  });
  return sha256(canonical);
}

/**
 * Hash an authorization record. Optional — only for governed receipts.
 * @param {object} authorization
 * @returns {string} SHA-256 hash
 */
export function hashAuthorization(authorization) {
  const canonical = JSON.stringify({
    intent_id: authorization.intent_id,
    decision: authorization.decision,
    authorized_by: authorization.authorized_by,
    timestamp: authorization.timestamp,
    conditions: authorization.conditions || null,
  });
  return sha256(canonical);
}

// ─── Receipt Generation ─────────────────────────────────────────────

/**
 * Build the chain_order based on which hashes are present.
 * Proof layer: [intent_hash, execution_hash, receipt_hash] (3)
 * Governed:    [intent_hash, governance_hash, authorization_hash, execution_hash, receipt_hash] (5)
 */
function buildChainOrder(data) {
  const order = ["intent_hash"];
  if (data.governance_hash) order.push("governance_hash");
  if (data.authorization_hash) order.push("authorization_hash");
  order.push("execution_hash");
  order.push("receipt_hash");
  return order;
}

/**
 * Generate a RIO Receipt (v2.2).
 *
 * Core proof layer: requires intent_hash + execution_hash.
 * Governed extension: also accepts governance_hash + authorization_hash.
 *
 * @param {object} data
 * @param {string} data.intent_hash - SHA-256 hash of the intent (required)
 * @param {string} data.execution_hash - SHA-256 hash of the execution (required)
 * @param {string} [data.governance_hash] - SHA-256 hash of governance decision (optional)
 * @param {string} [data.authorization_hash] - SHA-256 hash of authorization (optional)
 * @param {string} data.intent_id - UUID of the original intent
 * @param {string} data.action - Action type
 * @param {string} data.agent_id - Agent that requested the action
 * @param {string} [data.authorized_by] - Who authorized it (optional)
 * @param {string} [data.receipt_type] - Receipt classification (defaults based on content)
 * @param {object} [data.ingestion] - Ingestion provenance
 * @param {object} [data.identity_binding] - Ed25519 signer proof
 * @returns {object} The complete receipt
 */
export function generateReceipt(data) {
  const receiptId = randomUUID();
  const timestamp = new Date().toISOString();

  // Determine receipt type: if governance/authorization present, it's governed
  const isGoverned = !!(data.governance_hash && data.authorization_hash);
  const receiptType = data.receipt_type || (isGoverned ? "governed_action" : "action");

  // Build chain order dynamically based on what's present
  const chainOrder = buildChainOrder(data);

  // Build the content object for hashing — only include present hashes
  const receiptContent = { receipt_id: receiptId };
  for (const field of chainOrder) {
    if (field !== "receipt_hash") {
      receiptContent[field] = data[field];
    }
  }
  receiptContent.timestamp = timestamp;
  const receiptHash = sha256(JSON.stringify(receiptContent));

  const receipt = {
    receipt_id: receiptId,
    receipt_type: receiptType,
    intent_id: data.intent_id,
    action: data.action,
    agent_id: data.agent_id,
    authorized_by: data.authorized_by || null,
    timestamp,
    hash_chain: {
      intent_hash: data.intent_hash,
      governance_hash: data.governance_hash || null,
      authorization_hash: data.authorization_hash || null,
      execution_hash: data.execution_hash,
      receipt_hash: receiptHash,
    },
    verification: {
      algorithm: "SHA-256",
      chain_length: chainOrder.length,
      chain_order: chainOrder,
    },
  };

  // Optional v2.1+ fields
  if (data.ingestion) {
    receipt.ingestion = {
      source: data.ingestion.source,
      channel: data.ingestion.channel,
      source_message_id: data.ingestion.source_message_id || null,
      timestamp: data.ingestion.timestamp || timestamp,
    };
  }

  if (data.identity_binding) {
    receipt.identity_binding = {
      signer_id: data.identity_binding.signer_id || null,
      public_key_hex: data.identity_binding.public_key_hex || null,
      signature_payload_hash: data.identity_binding.signature_payload_hash || null,
      verification_method: data.identity_binding.verification_method || null,
      ed25519_signed: data.identity_binding.ed25519_signed || false,
    };
  }

  return receipt;
}

/**
 * Verify a receipt by recomputing the receipt hash from its components.
 *
 * Uses the receipt's own chain_order to determine which hashes to include
 * in the verification. This supports both proof-layer (3-hash) and
 * governed (5-hash) receipts.
 *
 * @param {object} receipt - A RIO Receipt object
 * @returns {object} Verification result
 */
export function verifyReceipt(receipt) {
  // Use the receipt's chain_order to rebuild the content
  const chainOrder = receipt.verification?.chain_order || [
    "intent_hash",
    "execution_hash",
    "receipt_hash",
  ];

  const receiptContent = { receipt_id: receipt.receipt_id };
  for (const field of chainOrder) {
    if (field !== "receipt_hash") {
      receiptContent[field] = receipt.hash_chain[field];
    }
  }
  receiptContent.timestamp = receipt.timestamp;
  const computedHash = sha256(JSON.stringify(receiptContent));
  const storedHash = receipt.hash_chain.receipt_hash;

  return {
    valid: computedHash === storedHash,
    computed_hash: computedHash,
    stored_hash: storedHash,
    receipt_id: receipt.receipt_id,
    receipt_type: receipt.receipt_type || "action",
  };
}
