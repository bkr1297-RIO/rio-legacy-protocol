#!/usr/bin/env node

/**
 * RIO Receipt Protocol — Basic Usage Example
 *
 * This example demonstrates the complete flow:
 * 1. An AI agent proposes an action (intent)
 * 2. The system evaluates governance (policy check)
 * 3. A human or policy authorizes the action
 * 4. The action is executed
 * 5. A cryptographic receipt is generated
 * 6. The receipt is written to a tamper-evident ledger
 * 7. Both the receipt and ledger chain are verified
 *
 * Run: node examples/basic-usage.mjs
 */

import { randomUUID } from "node:crypto";
import {
  generateReceipt,
  verifyReceipt,
  hashIntent,
  hashGovernance,
  hashAuthorization,
  hashExecution,
} from "../reference/receipts.mjs";
import { createLedger } from "../reference/ledger.mjs";
import {
  verifyReceipt as standaloneVerify,
  verifyChain,
} from "../reference/verifier.mjs";

console.log("RIO Receipt Protocol — Basic Usage Example\n");

// ── Step 1: AI Agent proposes an action ──────────────────────────────

const intent = {
  intent_id: randomUUID(),
  action: "send_email",
  agent_id: "copilot-agent-001",
  parameters: {
    to: "client@example.com",
    subject: "Quarterly Report",
    body: "Please find the Q1 report attached.",
  },
  timestamp: new Date().toISOString(),
};

console.log("1. Intent created:");
console.log(`   Action: ${intent.action}`);
console.log(`   Agent: ${intent.agent_id}`);
console.log(`   Intent ID: ${intent.intent_id}\n`);

// ── Step 2: Governance evaluates the intent ──────────────────────────

const governance = {
  intent_id: intent.intent_id,
  status: "approved",
  risk_level: "low",
  requires_approval: false,
  checks: [
    { check: "agent_recognized", result: "pass" },
    { check: "action_permitted", result: "pass" },
    { check: "rate_limit", result: "pass" },
    { check: "risk_threshold", result: "pass" },
  ],
};

console.log("2. Governance decision:");
console.log(`   Status: ${governance.status}`);
console.log(`   Risk: ${governance.risk_level}`);
console.log(`   Checks passed: ${governance.checks.length}\n`);

// ── Step 3: Authorization (auto-approved by policy) ──────────────────

const authorization = {
  intent_id: intent.intent_id,
  decision: "approved",
  authorized_by: "POLICY:auto_approve_low_risk",
  timestamp: new Date().toISOString(),
  conditions: null,
};

console.log("3. Authorization:");
console.log(`   Decision: ${authorization.decision}`);
console.log(`   Authorized by: ${authorization.authorized_by}\n`);

// ── Step 4: Execution ────────────────────────────────────────────────

const execution = {
  intent_id: intent.intent_id,
  action: "send_email",
  result: "success",
  connector: "gmail-api",
  timestamp: new Date().toISOString(),
};

console.log("4. Execution:");
console.log(`   Result: ${execution.result}`);
console.log(`   Connector: ${execution.connector}\n`);

// ── Step 5: Generate cryptographic receipt ───────────────────────────

const receipt = generateReceipt({
  intent_hash: hashIntent(intent),
  governance_hash: hashGovernance(governance),
  authorization_hash: hashAuthorization(authorization),
  execution_hash: hashExecution(execution),
  intent_id: intent.intent_id,
  action: intent.action,
  agent_id: intent.agent_id,
  authorized_by: authorization.authorized_by,
  receipt_type: "governed_action",
  ingestion: {
    source: "api",
    channel: "POST /intent",
  },
});

console.log("5. Receipt generated:");
console.log(`   Receipt ID: ${receipt.receipt_id}`);
console.log(`   Receipt hash: ${receipt.hash_chain.receipt_hash}`);
console.log(`   Hash chain length: ${receipt.verification.chain_length}\n`);

// ── Step 6: Write to tamper-evident ledger ───────────────────────────

const ledger = createLedger();

// Record each stage
ledger.append({
  intent_id: intent.intent_id,
  action: intent.action,
  agent_id: intent.agent_id,
  status: "submitted",
  detail: "Intent submitted by copilot-agent-001",
  intent_hash: hashIntent(intent),
});

ledger.append({
  intent_id: intent.intent_id,
  action: intent.action,
  agent_id: intent.agent_id,
  status: "governed",
  detail: "Policy evaluation: approved (low risk)",
});

ledger.append({
  intent_id: intent.intent_id,
  action: intent.action,
  agent_id: intent.agent_id,
  status: "authorized",
  detail: "Auto-approved by policy",
  authorization_hash: hashAuthorization(authorization),
});

ledger.append({
  intent_id: intent.intent_id,
  action: intent.action,
  agent_id: intent.agent_id,
  status: "executed",
  detail: "Email sent successfully via gmail-api",
  receipt_hash: receipt.hash_chain.receipt_hash,
});

console.log("6. Ledger entries: 4 (submitted → governed → authorized → executed)");
console.log(`   Chain tip: ${ledger.getCurrentHash().substring(0, 32)}...\n`);

// ── Step 7: Verify everything ────────────────────────────────────────

console.log("7. Verification:");

// Verify the receipt
const receiptResult = verifyReceipt(receipt);
console.log(`   Receipt valid: ${receiptResult.valid}`);

// Verify with standalone verifier
const standaloneResult = standaloneVerify(receipt);
console.log(`   Standalone verify: ${standaloneResult.valid}`);

// Verify the ledger chain
const chainResult = verifyChain(ledger.export());
console.log(`   Chain valid: ${chainResult.valid}`);
console.log(`   Entries verified: ${chainResult.entries_checked}`);

console.log("\nDone. This action is now cryptographically proven.\n");
