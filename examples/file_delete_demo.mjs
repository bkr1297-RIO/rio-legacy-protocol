#!/usr/bin/env node
/**
 * RIO Receipt Protocol — File Delete Demo
 *
 * Scenario: An automation script wants to delete a production database backup.
 * This is a HIGH-risk action (irreversible, data loss potential).
 * Governance blocks the action until a human explicitly approves.
 *
 * Run with: node examples/file_delete_demo.mjs
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
  createLedger,
} from "../index.mjs";

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║       RIO Receipt Protocol — File Delete Demo       ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

const intentId = crypto.randomUUID();
const now = new Date().toISOString();

// ─── Step 1: Script proposes file deletion ──────────────────────────

console.log("STEP 1: Script proposes deleting a file\n");

const deleteParams = {
  path: "/backups/prod-db-2026-03-15.sql.gz",
  reason: "Retention policy: backups older than 14 days",
  size_bytes: 4_200_000_000,
};

const intentHash = hashIntent(intentId, "file_delete", "cleanup-cron-v2", deleteParams, now);
console.log("  Action:      file_delete");
console.log("  File:        /backups/prod-db-2026-03-15.sql.gz");
console.log("  Size:        4.2 GB");
console.log("  Reason:      Retention policy (>14 days)");
console.log("  Intent Hash:", intentHash.slice(0, 16) + "...\n");

// ─── Step 2: Governance flags as HIGH risk ──────────────────────────

console.log("STEP 2: Governance evaluates risk\n");

const checks = [
  { check: "file_exists", result: "PASS" },
  { check: "not_in_active_use", result: "PASS" },
  { check: "backup_count_above_minimum", result: "PASS" },
  { check: "irreversible_action", result: "FLAG" },
];

const govHash = hashGovernance(intentId, "REQUIRES_APPROVAL", "HIGH", true, checks);
console.log("  Risk Level:  HIGH (irreversible, production data)");
console.log("  Checks:      3 PASS, 1 FLAG (irreversible)");
console.log("  Decision:    REQUIRES_APPROVAL — human must approve\n");

// ─── Step 3: Human reviews and approves ─────────────────────────────

console.log("STEP 3: Human reviews and approves\n");

const authHash = hashAuthorization(intentId, "APPROVED", "ops-lead@company.com", now, {
  note: "Verified backup is replicated to cold storage",
});
console.log("  Approved by: ops-lead@company.com");
console.log("  Condition:   Verified backup is replicated to cold storage\n");

// ─── Step 4: File deleted ───────────────────────────────────────────

console.log("STEP 4: File deleted\n");

const execResult = {
  status: "deleted",
  path: deleteParams.path,
  bytes_freed: deleteParams.size_bytes,
  deleted_at: new Date().toISOString(),
};

const execHash = hashExecution(intentId, "file_delete", execResult, "s3-api", now);
console.log("  Status:      deleted");
console.log("  Freed:       4.2 GB");
console.log("  Exec Hash:  ", execHash.slice(0, 16) + "...\n");

// ─── Step 5: Receipt + Ledger ───────────────────────────────────────

console.log("STEP 5: Receipt generated and written to ledger\n");

const receipt = generateReceipt(
  intentHash, execHash, intentId, "file_delete", "cleanup-cron-v2",
  govHash, authHash, "ops-lead@company.com",
);

const result = verifyReceipt(receipt);
const ledger = createLedger();
ledger.append({
  intent_id: intentId, action: "file_delete", agent_id: "cleanup-cron-v2",
  status: "executed", detail: "Deleted /backups/prod-db-2026-03-15.sql.gz (4.2 GB)",
  receipt_hash: receipt.hash_chain.receipt_hash,
  authorization_hash: receipt.hash_chain.authorization_hash,
  intent_hash: receipt.hash_chain.intent_hash,
});

console.log("═══════════════════════════════════════════════════════");
console.log("  SUMMARY");
console.log("═══════════════════════════════════════════════════════");
console.log("  Intent:          file_delete");
console.log("  Risk:            HIGH");
console.log("  Human Approval:  YES (ops-lead@company.com)");
console.log("  Result:          deleted (4.2 GB freed)");
console.log("  Receipt Hash:    " + receipt.hash_chain.receipt_hash.slice(0, 16) + "...");
console.log("  Ledger Entries:  " + ledger.getEntryCount());
console.log("  Verification:    " + (result.valid ? "PASS" : "FAIL"));
console.log("═══════════════════════════════════════════════════════\n");
