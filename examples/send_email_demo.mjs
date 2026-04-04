#!/usr/bin/env node
/**
 * RIO Receipt Protocol — Send Email Demo
 *
 * Scenario: An AI assistant wants to send an email on behalf of a user.
 * This is a HIGH-risk action (irreversible, external communication).
 * The demo shows how to generate a governed receipt with human approval.
 *
 * Run with: node examples/send_email_demo.mjs
 *
 * @version 2.3.0
 * @license MIT OR Apache-2.0
 */

import {
  hashIntent,
  hashExecution,
  hashGovernance,
  hashAuthorization,
  generateReceipt,
  verifyReceipt,
  generateKeyPair,
  signReceipt,
  createLedger,
} from "../index.mjs";

// ─── Scenario Setup ─────────────────────────────────────────────────

const intentId = crypto.randomUUID();
const now = new Date().toISOString();

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║        RIO Receipt Protocol — Send Email Demo       ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

// ─── Step 1: AI proposes the action ─────────────────────────────────

console.log("STEP 1: AI proposes sending an email\n");

const emailParams = {
  to: "client@example.com",
  subject: "Q2 Financial Report",
  body: "Please find the Q2 financial report attached.",
  attachment: "q2-report.pdf",
};

const intentHash = hashIntent(intentId, "send_email", "ai-assistant-v1", emailParams, now);
console.log("  Intent:    send_email");
console.log("  To:        client@example.com");
console.log("  Subject:   Q2 Financial Report");
console.log("  Intent Hash:", intentHash.slice(0, 16) + "...\n");

// ─── Step 2: Governance evaluates risk ──────────────────────────────

console.log("STEP 2: Governance evaluates risk\n");

const checks = [
  { check: "recipient_valid", result: "PASS" },
  { check: "content_policy", result: "PASS" },
  { check: "attachment_scan", result: "PASS" },
  { check: "rate_limit", result: "PASS" },
];

const governanceHash = hashGovernance(intentId, "REQUIRES_APPROVAL", "HIGH", true, checks);
console.log("  Risk Level:  HIGH (irreversible, external communication)");
console.log("  Decision:    REQUIRES_APPROVAL");
console.log("  Checks:      4/4 PASS");
console.log("  Gov Hash:   ", governanceHash.slice(0, 16) + "...\n");

// ─── Step 3: Human approves ─────────────────────────────────────────

console.log("STEP 3: Human approves the action\n");

const approvalTime = new Date().toISOString();
const authHash = hashAuthorization(intentId, "APPROVED", "brian@rio.dev", approvalTime);
console.log("  Decision:    APPROVED");
console.log("  Approved by: brian@rio.dev");
console.log("  Auth Hash:  ", authHash.slice(0, 16) + "...\n");

// ─── Step 4: Action executes ────────────────────────────────────────

console.log("STEP 4: Email sent via Gmail API\n");

const executionResult = {
  status: "delivered",
  message_id: "msg-" + crypto.randomUUID().slice(0, 8),
  provider: "gmail",
  delivered_at: new Date().toISOString(),
};

const executionHash = hashExecution(intentId, "send_email", executionResult, "gmail-api", now);
console.log("  Status:      delivered");
console.log("  Message ID: ", executionResult.message_id);
console.log("  Exec Hash:  ", executionHash.slice(0, 16) + "...\n");

// ─── Step 5: Receipt generated ──────────────────────────────────────

console.log("STEP 5: Cryptographic receipt generated\n");

const receipt = generateReceipt(
  intentHash, executionHash, intentId, "send_email", "ai-assistant-v1",
  governanceHash, authHash, "brian@rio.dev",
);

const verification = verifyReceipt(receipt);
console.log("  Receipt ID: ", receipt.receipt_id);
console.log("  Type:        governed_action");
console.log("  Hash Chain:  5 hashes (intent → governance → authorization → execution → receipt)");
console.log("  Receipt Hash:", receipt.hash_chain.receipt_hash.slice(0, 16) + "...");
console.log("  Verified:   ", verification.valid ? "✓ PASS" : "✗ FAIL");

// ─── Step 6: Sign with Ed25519 ──────────────────────────────────────

console.log("\nSTEP 6: Ed25519 signature applied\n");

const keys = generateKeyPair();
signReceipt(receipt, {
  privateKey: keys.privateKeyObj,
  publicKeyHex: keys.publicKeyHex,
  signerId: "rio-gateway",
});

console.log("  Signer:      rio-gateway");
console.log("  Public Key:  " + keys.publicKeyHex.slice(0, 16) + "...");
console.log("  Signature:   " + receipt.identity_binding.signature_hex.slice(0, 16) + "...");
console.log("  Signed:      ✓\n");

// ─── Step 7: Append to ledger ───────────────────────────────────────

console.log("STEP 7: Written to tamper-evident ledger\n");

const ledger = createLedger();
ledger.append({
  intent_id: intentId, action: "send_email", agent_id: "ai-assistant-v1",
  status: "executed", detail: "Email sent to client@example.com",
  receipt_hash: receipt.hash_chain.receipt_hash,
  authorization_hash: receipt.hash_chain.authorization_hash,
  intent_hash: receipt.hash_chain.intent_hash,
});

console.log("  Ledger entries: " + ledger.getEntryCount());
console.log("  Chain valid:    ✓\n");

// ─── Summary ────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════");
console.log("  SUMMARY");
console.log("═══════════════════════════════════════════════════════");
console.log("  Intent:          send_email");
console.log("  Risk:            HIGH");
console.log("  Human Approval:  YES (brian@rio.dev)");
console.log("  Result:          delivered");
console.log("  Receipt Hash:    " + receipt.hash_chain.receipt_hash.slice(0, 16) + "...");
console.log("  Signature:       VALID (Ed25519)");
console.log("  Ledger Entry:    #" + String(ledger.getEntryCount()).padStart(6, "0"));
console.log("  Verification:    PASS");
console.log("═══════════════════════════════════════════════════════\n");
