#!/usr/bin/env node

/**
 * RIO Receipt Protocol — Verifier CLI
 *
 * Standalone command-line tool for verifying RIO Receipts and Ledger chains.
 * Zero external dependencies beyond Node.js built-ins.
 *
 * Usage:
 *   rio-verify receipt <receipt.json>          Verify a single receipt
 *   rio-verify chain <ledger.json>             Verify a ledger hash chain
 *   rio-verify batch <receipts.json>           Verify multiple receipts
 *   rio-verify cross <receipt.json> <entry.json>  Cross-verify receipt against ledger entry
 *   rio-verify remote <gateway-url>            Verify a live gateway's chain
 *
 * @version 1.0.0
 * @license MIT OR Apache-2.0
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// ─── SHA-256 ─────────────────────────────────────────────────────────

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// ─── ANSI Colors ─────────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function pass(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg) { console.log(`  ${RED}✗${RESET} ${msg}`); }
function info(msg) { console.log(`  ${CYAN}ℹ${RESET} ${msg}`); }
function warn(msg) { console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }

// ─── Genesis Hash ────────────────────────────────────────────────────

const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

// ─── Receipt Verification ────────────────────────────────────────────

function verifyReceipt(receipt) {
  let valid = true;
  const errors = [];

  // Structural checks
  if (!receipt.receipt_id) { errors.push("Missing receipt_id"); valid = false; }
  if (!receipt.timestamp) { errors.push("Missing timestamp"); valid = false; }
  if (!receipt.hash_chain) { errors.push("Missing hash_chain"); valid = false; }

  if (!receipt.hash_chain) return { valid: false, errors };

  // Core fields always required
  const coreFields = ["intent_hash", "execution_hash", "receipt_hash"];
  for (const f of coreFields) {
    if (!receipt.hash_chain[f]) {
      errors.push(`Missing hash_chain.${f}`);
      valid = false;
    } else if (!/^[a-f0-9]{64}$/.test(receipt.hash_chain[f])) {
      errors.push(`Invalid hash format: hash_chain.${f}`);
      valid = false;
    }
  }

  // Governance/authorization: validate format if present, but not required
  for (const f of ["governance_hash", "authorization_hash"]) {
    const val = receipt.hash_chain[f];
    if (val && !/^[a-f0-9]{64}$/.test(val)) {
      errors.push(`Invalid hash format: hash_chain.${f}`);
      valid = false;
    }
  }

  if (!valid) return { valid, errors };

  // Use chain_order from receipt, or infer from present fields
  const chainOrder = receipt.verification?.chain_order || (() => {
    const order = ["intent_hash"];
    if (receipt.hash_chain.governance_hash) order.push("governance_hash");
    if (receipt.hash_chain.authorization_hash) order.push("authorization_hash");
    order.push("execution_hash", "receipt_hash");
    return order;
  })();

  // Recompute receipt hash using chain_order
  const contentObj = { receipt_id: receipt.receipt_id };
  for (const field of chainOrder) {
    if (field !== "receipt_hash") {
      contentObj[field] = receipt.hash_chain[field];
    }
  }
  contentObj.timestamp = receipt.timestamp;
  const content = JSON.stringify(contentObj);
  const computed = sha256(content);

  if (computed !== receipt.hash_chain.receipt_hash) {
    errors.push(`Hash mismatch: computed ${computed}, stored ${receipt.hash_chain.receipt_hash}`);
    valid = false;
  }

  return { valid, computed, stored: receipt.hash_chain.receipt_hash, errors };
}

// ─── Chain Verification ──────────────────────────────────────────────

function verifyChain(entries) {
  let prev = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    if (e.prev_hash !== prev) {
      return {
        valid: false,
        entries_checked: i + 1,
        first_invalid: i,
        reason: `Entry ${i} prev_hash mismatch`,
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
        reason: `Entry ${i} hash mismatch`,
      };
    }

    prev = e.ledger_hash;
  }

  return { valid: true, entries_checked: entries.length, chain_tip: prev };
}

// ─── Remote Gateway Verification ─────────────────────────────────────

async function verifyRemote(url) {
  const base = url.replace(/\/$/, "");

  console.log(`\n${BOLD}RIO Receipt Protocol — Remote Gateway Verification${RESET}`);
  console.log(`${DIM}Target: ${base}${RESET}\n`);

  // 1. Health check
  try {
    const healthRes = await fetch(`${base}/health`);
    const health = await healthRes.json();
    pass(`Gateway reachable — version ${health.version || "unknown"}`);
    if (health.hardening?.ed25519_mode) pass(`Ed25519 signing: ${health.hardening.ed25519_mode}`);
    else if (health.ed25519_mode) pass(`Ed25519 signing: ${health.ed25519_mode}`);
    if (health.fail_mode) info(`Fail mode: ${health.fail_mode}`);
    if (health.ledger) {
      info(`Ledger entries: ${health.ledger.entry_count ?? health.ledger.entries ?? 'N/A'}`);
      info(`Chain valid: ${health.ledger.chain_valid ?? health.ledger.valid ?? 'N/A'}`);
      const tip = health.ledger.current_hash || health.ledger.chain_tip || 'N/A';
      info(`Chain tip: ${tip === 'N/A' ? tip : tip.substring(0, 16) + '...'}`);
    } else if (health.chain_valid !== undefined) {
      info(`Chain valid: ${health.chain_valid}`);
      if (health.entry_count !== undefined) info(`Ledger entries: ${health.entry_count}`);
      if (health.current_hash) info(`Chain tip: ${health.current_hash.substring(0, 16)}...`);
    }
  } catch (err) {
    fail(`Cannot reach gateway: ${err.message}`);
    return;
  }

  // 2. Fetch recent receipts (if endpoint exists)
  try {
    const receiptsRes = await fetch(`${base}/api/receipts/recent?limit=10`);
    if (receiptsRes.ok) {
      const data = await receiptsRes.json();
      const receipts = data.receipts || data;
      if (Array.isArray(receipts) && receipts.length > 0) {
        info(`Fetched ${receipts.length} recent receipts`);
        let validCount = 0;
        for (const r of receipts) {
          const result = verifyReceipt(r);
          if (result.valid) validCount++;
        }
        if (validCount === receipts.length) {
          pass(`All ${validCount} receipts verified`);
        } else {
          warn(`${validCount}/${receipts.length} receipts valid`);
        }
      }
    }
  } catch {
    info("No /api/receipts/recent endpoint (optional)");
  }

  console.log("");
}

// ─── CLI Entry Point ─────────────────────────────────────────────────

function loadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    console.error(`${RED}Error reading ${path}: ${err.message}${RESET}`);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
${BOLD}RIO Receipt Protocol — Verifier CLI${RESET}

${CYAN}Usage:${RESET}
  rio-verify receipt <receipt.json>              Verify a single receipt
  rio-verify chain <ledger.json>                 Verify a ledger hash chain
  rio-verify batch <receipts.json>               Verify multiple receipts
  rio-verify cross <receipt.json> <entry.json>   Cross-verify receipt + ledger entry
  rio-verify remote <gateway-url>                Verify a live gateway

${CYAN}Examples:${RESET}
  rio-verify receipt ./my-receipt.json
  rio-verify chain ./ledger-export.json
  rio-verify remote https://rio-gateway.onrender.com

${DIM}All verification is performed locally using SHA-256.
No data is sent to any external service.${RESET}
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case "receipt": {
      if (!args[1]) { console.error("Missing receipt file path"); process.exit(1); }
      const receipt = loadJSON(args[1]);

      console.log(`\n${BOLD}RIO Receipt Verification${RESET}`);
      console.log(`${DIM}File: ${args[1]}${RESET}\n`);

      info(`Receipt ID: ${receipt.receipt_id}`);
      info(`Type: ${receipt.receipt_type || "governed_action"}`);
      info(`Action: ${receipt.action}`);
      info(`Agent: ${receipt.agent_id}`);
      info(`Authorized by: ${receipt.authorized_by}`);
      info(`Timestamp: ${receipt.timestamp}`);

      const result = verifyReceipt(receipt);
      console.log("");

      if (result.valid) {
        pass(`Receipt hash VALID`);
        pass(`Computed: ${result.computed}`);
        if (receipt.identity_binding?.ed25519_signed) {
          info(`Ed25519 signed by: ${receipt.identity_binding.signer_id}`);
        }
        if (receipt.ingestion) {
          info(`Ingestion source: ${receipt.ingestion.source} via ${receipt.ingestion.channel}`);
        }
      } else {
        fail(`Receipt hash INVALID`);
        for (const e of result.errors) fail(e);
      }

      console.log("");
      process.exit(result.valid ? 0 : 1);
    }

    case "chain": {
      if (!args[1]) { console.error("Missing ledger file path"); process.exit(1); }
      const entries = loadJSON(args[1]);

      console.log(`\n${BOLD}RIO Ledger Chain Verification${RESET}`);
      console.log(`${DIM}File: ${args[1]}${RESET}\n`);

      if (!Array.isArray(entries)) {
        fail("File does not contain an array of ledger entries");
        process.exit(1);
      }

      info(`Entries: ${entries.length}`);
      const result = verifyChain(entries);

      if (result.valid) {
        pass(`Chain VALID — ${result.entries_checked} entries verified`);
        pass(`Chain tip: ${result.chain_tip}`);
      } else {
        fail(`Chain BROKEN at entry ${result.first_invalid}`);
        fail(`Reason: ${result.reason}`);
        info(`Entries checked before failure: ${result.entries_checked}`);
      }

      console.log("");
      process.exit(result.valid ? 0 : 1);
    }

    case "batch": {
      if (!args[1]) { console.error("Missing receipts file path"); process.exit(1); }
      const receipts = loadJSON(args[1]);

      console.log(`\n${BOLD}RIO Receipt Batch Verification${RESET}`);
      console.log(`${DIM}File: ${args[1]}${RESET}\n`);

      if (!Array.isArray(receipts)) {
        fail("File does not contain an array of receipts");
        process.exit(1);
      }

      let validCount = 0;
      for (let i = 0; i < receipts.length; i++) {
        const r = verifyReceipt(receipts[i]);
        if (r.valid) {
          pass(`Receipt ${i}: ${receipts[i].receipt_id} — VALID`);
          validCount++;
        } else {
          fail(`Receipt ${i}: ${receipts[i].receipt_id} — INVALID`);
          for (const e of r.errors) fail(`  ${e}`);
        }
      }

      console.log("");
      info(`Result: ${validCount}/${receipts.length} valid`);
      console.log("");
      process.exit(validCount === receipts.length ? 0 : 1);
    }

    case "cross": {
      if (!args[1] || !args[2]) {
        console.error("Usage: rio-verify cross <receipt.json> <entry.json>");
        process.exit(1);
      }
      const receipt = loadJSON(args[1]);
      const entry = loadJSON(args[2]);

      console.log(`\n${BOLD}RIO Cross-Verification (Receipt ↔ Ledger Entry)${RESET}\n`);

      const rResult = verifyReceipt(receipt);
      if (rResult.valid) {
        pass("Receipt hash valid");
      } else {
        fail("Receipt hash invalid");
      }

      if (entry.receipt_hash === receipt.hash_chain.receipt_hash) {
        pass("Ledger entry references this receipt");
      } else {
        fail("Ledger entry receipt_hash does not match");
      }

      if (entry.intent_id === receipt.intent_id) {
        pass("Intent ID matches");
      } else {
        fail(`Intent ID mismatch: ledger=${entry.intent_id}, receipt=${receipt.intent_id}`);
      }

      console.log("");
      process.exit(rResult.valid ? 0 : 1);
    }

    case "remote": {
      if (!args[1]) { console.error("Missing gateway URL"); process.exit(1); }
      await verifyRemote(args[1]);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
