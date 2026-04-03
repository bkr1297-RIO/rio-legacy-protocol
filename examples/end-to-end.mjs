#!/usr/bin/env node
/**
 * RIO Receipt Protocol — End-to-End Example (Node.js)
 *
 * Demonstrates the complete receipt lifecycle:
 *   1. Hash an intent (what was requested)
 *   2. Hash an execution (what actually happened)
 *   3. Generate a cryptographic receipt linking both
 *   4. Sign the receipt with Ed25519
 *   5. Record the receipt in a tamper-evident ledger
 *   6. Verify the receipt independently
 *   7. Verify the entire ledger chain
 *
 * Run with: node examples/end-to-end.mjs
 * Zero external dependencies — uses only the reference implementations.
 *
 * @version 2.2.0
 * @license MIT OR Apache-2.0
 */

import {
  hashIntent,
  hashExecution,
  hashGovernance,
  hashAuthorization,
  generateReceipt,
  verifyReceipt,
  createLedger,
  verifyReceiptStandalone,
  verifyChain,
  generateKeyPair,
  signReceipt,
} from "../index.mjs";

// ─── Helper ─────────────────────────────────────────────────────────

function divider(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}\n`);
}

// ─── 1. Proof-Layer Receipt (3-hash chain) ──────────────────────────

divider("STEP 1: Proof-Layer Receipt (3-hash chain)");

const intentId = crypto.randomUUID();
const timestamp = new Date().toISOString();

console.log("Intent ID:", intentId);
console.log("Action:    data_query");
console.log("Agent:     demo-agent\n");

// Hash the intent BEFORE the action
const intentHash = hashIntent({
  intent_id: intentId,
  action: "data_query",
  agent_id: "demo-agent",
  parameters: {
    query: "SELECT count(*) FROM orders WHERE status = 'pending'",
    database: "analytics",
  },
  timestamp,
});
console.log("Intent hash:", intentHash);

// Simulate executing the action
const result = { rows_returned: 42, execution_time_ms: 15, status: "success" };

// Hash the execution AFTER the action
const executionHash = hashExecution({
  intent_id: intentId,
  action: "data_query",
  result,
  connector: "postgres-connector",
  timestamp: new Date().toISOString(),
});
console.log("Execution hash:", executionHash);

// Generate the receipt
const receipt = generateReceipt({
  intent_hash: intentHash,
  execution_hash: executionHash,
  intent_id: intentId,
  action: "data_query",
  agent_id: "demo-agent",
});

console.log("\nReceipt generated:");
console.log("  Receipt ID:", receipt.receipt_id);
console.log("  Type:", receipt.receipt_type);
console.log("  Chain length:", receipt.verification.chain_length);
console.log("  Chain order:", receipt.verification.chain_order.join(" → "));
console.log("  Receipt hash:", receipt.hash_chain.receipt_hash);

// Verify the receipt
const verifyResult = verifyReceipt(receipt);
console.log("\n  ✓ Receipt valid:", verifyResult.valid);

// ─── 2. Governed Receipt (5-hash chain) ─────────────────────────────

divider("STEP 2: Governed Receipt (5-hash chain)");

const govIntentId = crypto.randomUUID();
const govTimestamp = new Date().toISOString();

console.log("Intent ID:", govIntentId);
console.log("Action:    send_payment");
console.log("Agent:     finance-agent");
console.log("Risk:      HIGH — requires human approval\n");

// Hash the intent
const govIntentHash = hashIntent({
  intent_id: govIntentId,
  action: "send_payment",
  agent_id: "finance-agent",
  parameters: {
    recipient: "vendor-acme-corp",
    amount: 50000,
    currency: "USD",
  },
  timestamp: govTimestamp,
});
console.log("Intent hash:", govIntentHash);

// Governance evaluation
const governanceHash = hashGovernance({
  intent_id: govIntentId,
  status: "requires_approval",
  risk_level: "high",
  requires_approval: true,
  checks: ["payment_limit", "vendor_verification", "budget_check"],
});
console.log("Governance hash:", governanceHash);

// Human authorization
const authTimestamp = new Date().toISOString();
const authorizationHash = hashAuthorization({
  intent_id: govIntentId,
  decision: "approved",
  authorized_by: "HUMAN:cfo@example.com",
  timestamp: authTimestamp,
  conditions: null,
});
console.log("Authorization hash:", authorizationHash);

// Execute the action
const govResult = {
  transaction_id: "TXN-2026-001",
  status: "completed",
  amount_sent: 50000,
};

const govExecutionHash = hashExecution({
  intent_id: govIntentId,
  action: "send_payment",
  result: govResult,
  connector: "banking-api",
  timestamp: new Date().toISOString(),
});
console.log("Execution hash:", govExecutionHash);

// Generate the governed receipt
const govReceipt = generateReceipt({
  intent_hash: govIntentHash,
  execution_hash: govExecutionHash,
  governance_hash: governanceHash,
  authorization_hash: authorizationHash,
  intent_id: govIntentId,
  action: "send_payment",
  agent_id: "finance-agent",
  authorized_by: "HUMAN:cfo@example.com",
});

console.log("\nGoverned receipt generated:");
console.log("  Receipt ID:", govReceipt.receipt_id);
console.log("  Type:", govReceipt.receipt_type);
console.log("  Authorized by:", govReceipt.authorized_by);
console.log("  Chain length:", govReceipt.verification.chain_length);
console.log("  Chain order:", govReceipt.verification.chain_order.join(" → "));
console.log("  Receipt hash:", govReceipt.hash_chain.receipt_hash);

const govVerify = verifyReceipt(govReceipt);
console.log("\n  ✓ Governed receipt valid:", govVerify.valid);

// ─── 3. Ed25519 Signing ─────────────────────────────────────────────

divider("STEP 3: Ed25519 Signing");

// Generate a signing key pair
const keys = generateKeyPair();
console.log("Key pair generated:");
console.log("  Public key:", keys.publicKeyHex.substring(0, 32) + "...");
console.log("  Private key:", keys.privateKeyHex.substring(0, 16) + "... (keep secret)\n");

// Sign the proof-layer receipt
signReceipt(receipt, {
  privateKey: keys.privateKeyObj,
  publicKeyHex: keys.publicKeyHex,
  signerId: "demo-gateway",
});
console.log("Proof-layer receipt signed:");
console.log("  Signer:", receipt.identity_binding.signer_id);
console.log("  Signature:", receipt.identity_binding.signature_hex.substring(0, 32) + "...");
console.log("  Signed at:", receipt.identity_binding.signed_at);
console.log("  Method:", receipt.identity_binding.verification_method);

// Sign the governed receipt
signReceipt(govReceipt, {
  privateKey: keys.privateKeyObj,
  publicKeyHex: keys.publicKeyHex,
  signerId: "demo-gateway",
});
console.log("\nGoverned receipt signed:");
console.log("  Signer:", govReceipt.identity_binding.signer_id);
console.log("  Signature:", govReceipt.identity_binding.signature_hex.substring(0, 32) + "...");
console.log("  Ed25519 signed:", govReceipt.identity_binding.ed25519_signed);

// ─── 4. Ledger ──────────────────────────────────────────────────────

divider("STEP 4: Tamper-Evident Ledger");

const ledger = createLedger();

// Record both receipts
const entry1 = ledger.append({
  intent_id: intentId,
  action: "data_query",
  agent_id: "demo-agent",
  status: "executed",
  detail: "Analytics query: pending orders count",
  receipt_hash: receipt.hash_chain.receipt_hash,
  intent_hash: receipt.hash_chain.intent_hash,
});
console.log("Entry 1 recorded:");
console.log("  Entry ID:", entry1.entry_id);
console.log("  Ledger hash:", entry1.ledger_hash);
console.log("  Prev hash:", entry1.prev_hash.substring(0, 16) + "... (genesis)");

const entry2 = ledger.append({
  intent_id: govIntentId,
  action: "send_payment",
  agent_id: "finance-agent",
  status: "executed",
  detail: "Governed payment: $50,000 to vendor-acme-corp",
  receipt_hash: govReceipt.hash_chain.receipt_hash,
  authorization_hash: govReceipt.hash_chain.authorization_hash,
  intent_hash: govReceipt.hash_chain.intent_hash,
});
console.log("\nEntry 2 recorded:");
console.log("  Entry ID:", entry2.entry_id);
console.log("  Ledger hash:", entry2.ledger_hash);
console.log("  Prev hash:", entry2.prev_hash.substring(0, 16) + "... (links to entry 1)");

// Verify the chain
const chainResult = ledger.verifyChain();
console.log("\n  ✓ Ledger chain valid:", chainResult.valid);
console.log("  Entries verified:", chainResult.entries_checked);

// ─── 5. Independent Verification ────────────────────────────────────

divider("STEP 5: Independent Verification");

console.log("Any third party can verify receipts and ledger chains");
console.log("without access to the original system.\n");

// Standalone receipt verification
const standalone1 = verifyReceiptStandalone(receipt);
console.log("Proof-layer receipt:", standalone1.valid ? "✓ VALID" : "✗ INVALID");

const standalone2 = verifyReceiptStandalone(govReceipt);
console.log("Governed receipt:   ", standalone2.valid ? "✓ VALID" : "✗ INVALID");

// Ledger chain verification
const chainVerify = verifyChain(ledger.export());
console.log("Ledger chain:       ", chainVerify.valid ? "✓ INTACT" : "✗ BROKEN");

// ─── 6. Tamper Detection ────────────────────────────────────────────

divider("STEP 6: Tamper Detection");

console.log("Modifying any field in a receipt invalidates the hash chain.\n");

const tampered = JSON.parse(JSON.stringify(receipt));
tampered.hash_chain.intent_hash = "aaaa" + tampered.hash_chain.intent_hash.substring(4);

const tamperedResult = verifyReceiptStandalone(tampered);
console.log("Tampered receipt:", tamperedResult.valid ? "✓ VALID" : "✗ INVALID (tamper detected)");
console.log("  Computed hash:", tamperedResult.computed_hash.substring(0, 32) + "...");
console.log("  Stored hash: ", tamperedResult.stored_hash.substring(0, 32) + "...");

// ─── Summary ────────────────────────────────────────────────────────

divider("SUMMARY");

console.log("Receipts generated:  2 (1 proof-layer, 1 governed)");
console.log("Ledger entries:      2");
console.log("Chain integrity:     ✓ VALID");
console.log("Tamper detection:    ✓ WORKING");
console.log("\nThe RIO Receipt Protocol provides cryptographic proof");
console.log("of what happened, when it happened, and who authorized it.");
console.log("No trust required — verify independently.\n");
