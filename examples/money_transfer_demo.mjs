#!/usr/bin/env node
/**
 * RIO Receipt Protocol — Money Transfer Demo
 *
 * Scenario: An AI financial assistant initiates a wire transfer.
 * This is a CRITICAL-risk action (irreversible, financial, external).
 * Full governance pipeline: risk assessment, preflight checks, human approval,
 * Ed25519 signing, and ledger recording.
 *
 * Run with: node examples/money_transfer_demo.mjs
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
  generateKeyPair,
  signReceipt,
  createLedger,
  verifyChain,
} from "../index.mjs";

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║     RIO Receipt Protocol — Money Transfer Demo      ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

const intentId = crypto.randomUUID();
const now = new Date().toISOString();

// ─── Step 1: AI proposes a wire transfer ────────────────────────────

console.log("STEP 1: AI proposes a wire transfer\n");

const transferParams = {
  from_account: "****4521",
  to_account: "****8903",
  to_name: "Acme Corp",
  amount: 25000.00,
  currency: "USD",
  reference: "INV-2026-0847",
  memo: "Q1 vendor payment per approved PO #4521",
};

const intentHash = hashIntent(intentId, "wire_transfer", "finance-agent-v1", transferParams, now);
console.log("  Action:      wire_transfer");
console.log("  Amount:      $25,000.00 USD");
console.log("  To:          Acme Corp (****8903)");
console.log("  Reference:   INV-2026-0847\n");

// ─── Step 2: Governance — CRITICAL risk ─────────────────────────────

console.log("STEP 2: Governance evaluates risk\n");

const checks = [
  { check: "recipient_verified", result: "PASS" },
  { check: "amount_within_daily_limit", result: "PASS" },
  { check: "duplicate_transfer_check", result: "PASS" },
  { check: "sanctions_screening", result: "PASS" },
  { check: "fraud_pattern_analysis", result: "PASS" },
  { check: "two_factor_required", result: "FLAG" },
];

const govHash = hashGovernance(intentId, "REQUIRES_APPROVAL", "CRITICAL", true, checks);
console.log("  Risk Level:  CRITICAL (irreversible, financial, >$10k)");
console.log("  Checks:      5 PASS, 1 FLAG (2FA required)");
console.log("  Decision:    REQUIRES_APPROVAL\n");

// ─── Step 3: Human approves with conditions ─────────────────────────

console.log("STEP 3: CFO approves with conditions\n");

const conditions = {
  two_factor_verified: true,
  approval_note: "Verified against PO #4521 and Q1 budget allocation",
  max_amount: 25000.00,
};

const authHash = hashAuthorization(intentId, "APPROVED", "cfo@company.com", now, conditions);
console.log("  Approved by: cfo@company.com");
console.log("  2FA:         verified");
console.log("  Condition:   Amount capped at $25,000.00\n");

// ─── Step 4: Transfer executes ──────────────────────────────────────

console.log("STEP 4: Wire transfer executed\n");

const execResult = {
  status: "completed",
  transaction_id: "WIR-" + crypto.randomUUID().slice(0, 12).toUpperCase(),
  amount: 25000.00,
  currency: "USD",
  fee: 25.00,
  completed_at: new Date().toISOString(),
  confirmation_code: "CONF-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
};

const execHash = hashExecution(intentId, "wire_transfer", execResult, "bank-api", now);
console.log("  Status:          completed");
console.log("  Transaction ID:  " + execResult.transaction_id);
console.log("  Amount:          $25,000.00 + $25.00 fee");
console.log("  Confirmation:    " + execResult.confirmation_code + "\n");

// ─── Step 5: Receipt + Signing ──────────────────────────────────────

console.log("STEP 5: Signed receipt generated\n");

const receipt = generateReceipt(
  intentHash, execHash, intentId, "wire_transfer", "finance-agent-v1",
  govHash, authHash, "cfo@company.com",
);

const keys = generateKeyPair();
signReceipt(receipt, {
  privateKey: keys.privateKeyObj,
  publicKeyHex: keys.publicKeyHex,
  signerId: "rio-finance-gateway",
});

const verification = verifyReceipt(receipt);

// ─── Step 6: Full ledger ────────────────────────────────────────────

const ledger = createLedger();
ledger.append({
  intent_id: intentId, action: "wire_transfer", agent_id: "finance-agent-v1",
  status: "executed", detail: "Wire transfer $25,000.00 to Acme Corp",
  receipt_hash: receipt.hash_chain.receipt_hash,
  authorization_hash: receipt.hash_chain.authorization_hash,
  intent_hash: receipt.hash_chain.intent_hash,
});

const chainResult = ledger.verifyChain();

// ─── Summary ────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════");
console.log("  SUMMARY — FINANCIAL TRANSACTION");
console.log("═══════════════════════════════════════════════════════");
console.log("  Intent:          wire_transfer ($25,000.00 USD)");
console.log("  Risk:            CRITICAL");
console.log("  Human Approval:  YES (cfo@company.com, 2FA verified)");
console.log("  Result:          completed (" + execResult.transaction_id + ")");
console.log("  Receipt Hash:    " + receipt.hash_chain.receipt_hash.slice(0, 16) + "...");
console.log("  Ed25519 Signed:  YES (rio-finance-gateway)");
console.log("  Signature:       " + receipt.identity_binding.signature_hex.slice(0, 16) + "...");
console.log("  Ledger Entries:  " + ledger.getEntryCount());
console.log("  Chain Valid:     " + (chainResult.valid ? "PASS" : "FAIL"));
console.log("  Verification:    " + (verification.valid ? "PASS" : "FAIL"));
console.log("═══════════════════════════════════════════════════════\n");

console.log("This receipt provides:");
console.log("  • Proof of what was requested (intent hash)");
console.log("  • Proof of risk assessment (governance hash)");
console.log("  • Proof of human authorization (authorization hash)");
console.log("  • Proof of execution (execution hash)");
console.log("  • Cryptographic signature (Ed25519)");
console.log("  • Tamper-evident ledger entry (hash chain)\n");
console.log("An auditor can independently verify every step.\n");
