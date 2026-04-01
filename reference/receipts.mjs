/**
 * RIO Receipt Protocol — Reference Implementation
 * Receipt Generation and Verification
 *
 * This module provides the core receipt functions for the RIO Receipt Protocol.
 * It has zero external dependencies beyond Node.js built-ins.
 *
 * @module rio-receipt-protocol/receipts
 * @version 2.1.0
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
 * @param {string} intent.intent_id
 * @param {string} intent.action
 * @param {string} intent.agent_id
 * @param {object} intent.parameters
 * @param {string} intent.timestamp
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
 * Hash a governance decision using canonical field order.
 * @param {object} governance
 * @param {string} governance.intent_id
 * @param {string} governance.status
 * @param {string} governance.risk_level
 * @param {boolean} governance.requires_approval
 * @param {Array} governance.checks
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
 * Hash an authorization record using canonical field order.
 * @param {object} authorization
 * @param {string} authorization.intent_id
 * @param {string} authorization.decision
 * @param {string} authorization.authorized_by
 * @param {string} authorization.timestamp
 * @param {*} [authorization.conditions]
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

/**
 * Hash an execution record using canonical field order.
 * @param {object} execution
 * @param {string} execution.intent_id
 * @param {string} execution.action
 * @param {string} execution.result
 * @param {string} execution.connector
 * @param {string} execution.timestamp
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

/**
 * Generate a complete RIO Receipt (v2.1).
 *
 * The receipt binds intent, governance, authorization, and execution
 * into a single cryptographic proof that the action was properly governed.
 *
 * @param {object} data
 * @param {string} data.intent_hash - SHA-256 hash of the intent
 * @param {string} data.governance_hash - SHA-256 hash of the governance decision
 * @param {string} data.authorization_hash - SHA-256 hash of the authorization
 * @param {string} data.execution_hash - SHA-256 hash of the execution result
 * @param {string} data.intent_id - UUID of the original intent
 * @param {string} data.action - Action type (e.g., "send_email")
 * @param {string} data.agent_id - Agent that requested the action
 * @param {string} data.authorized_by - Human or policy that authorized it
 * @param {string} [data.receipt_type="governed_action"] - Receipt classification
 * @param {object} [data.ingestion] - Ingestion provenance (v2.1)
 * @param {object} [data.identity_binding] - Ed25519 signer proof (v2.1)
 * @returns {object} The complete receipt
 */
export function generateReceipt(data) {
  const receiptId = randomUUID();
  const timestamp = new Date().toISOString();
  const receiptType = data.receipt_type || "governed_action";

  // The receipt hash covers the receipt ID, all preceding hashes, and timestamp
  const receiptContent = JSON.stringify({
    receipt_id: receiptId,
    intent_hash: data.intent_hash,
    governance_hash: data.governance_hash,
    authorization_hash: data.authorization_hash,
    execution_hash: data.execution_hash,
    timestamp,
  });
  const receiptHash = sha256(receiptContent);

  const receipt = {
    receipt_id: receiptId,
    receipt_type: receiptType,
    intent_id: data.intent_id,
    action: data.action,
    agent_id: data.agent_id,
    authorized_by: data.authorized_by,
    timestamp,
    hash_chain: {
      intent_hash: data.intent_hash,
      governance_hash: data.governance_hash,
      authorization_hash: data.authorization_hash,
      execution_hash: data.execution_hash,
      receipt_hash: receiptHash,
    },
    verification: {
      algorithm: "SHA-256",
      chain_length: 5,
      chain_order: [
        "intent_hash",
        "governance_hash",
        "authorization_hash",
        "execution_hash",
        "receipt_hash",
      ],
    },
  };

  // v2.1: Ingestion provenance
  if (data.ingestion) {
    receipt.ingestion = {
      source: data.ingestion.source,
      channel: data.ingestion.channel,
      source_message_id: data.ingestion.source_message_id || null,
      timestamp: data.ingestion.timestamp || timestamp,
    };
  }

  // v2.1: Identity binding
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
 * This checks that the receipt_hash in the hash_chain is correctly computed
 * from the receipt_id, all preceding hashes, and the timestamp. It does NOT
 * verify the individual stage hashes (intent, governance, authorization,
 * execution) — those require the original data.
 *
 * @param {object} receipt - A RIO Receipt object
 * @returns {object} Verification result with valid, computed_hash, stored_hash
 */
export function verifyReceipt(receipt) {
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

  return {
    valid: computedHash === storedHash,
    computed_hash: computedHash,
    stored_hash: storedHash,
    receipt_id: receipt.receipt_id,
    receipt_type: receipt.receipt_type || "governed_action",
  };
}
