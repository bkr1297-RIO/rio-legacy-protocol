#!/usr/bin/env node
/**
 * RIO Receipt Protocol — API Call Demo
 *
 * Scenario: An AI agent queries a third-party API to fetch stock prices.
 * This is a LOW-risk action (read-only, no side effects).
 * No human approval required — receipt is generated automatically.
 *
 * This demonstrates the core proof layer (no governance extension).
 *
 * Run with: node examples/api_call_demo.mjs
 *
 * @version 2.2.0
 * @license MIT OR Apache-2.0
 */

import {
  hashIntent,
  hashExecution,
  generateReceipt,
  verifyReceipt,
  createLedger,
} from "../index.mjs";

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║        RIO Receipt Protocol — API Call Demo         ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

const intentId = crypto.randomUUID();
const now = new Date().toISOString();

// ─── Step 1: AI proposes an API call ────────────────────────────────

console.log("STEP 1: AI proposes fetching stock data\n");

const params = {
  endpoint: "https://api.marketdata.com/v1/quotes",
  method: "GET",
  symbols: ["AAPL", "MSFT", "GOOGL"],
};

const intentHash = hashIntent(intentId, "api_call", "research-agent-v3", params, now);
console.log("  Action:      api_call (GET)");
console.log("  Endpoint:    api.marketdata.com/v1/quotes");
console.log("  Symbols:     AAPL, MSFT, GOOGL");
console.log("  Risk:        LOW (read-only, no side effects)");
console.log("  Approval:    NOT REQUIRED\n");

// ─── Step 2: API call executes immediately ──────────────────────────

console.log("STEP 2: API call executed\n");

const execResult = {
  status: "success",
  http_status: 200,
  response: {
    AAPL: { price: 198.52, change: "+1.23%" },
    MSFT: { price: 412.87, change: "-0.45%" },
    GOOGL: { price: 175.33, change: "+0.89%" },
  },
  latency_ms: 142,
};

const execHash = hashExecution(intentId, "api_call", execResult, "marketdata-api", now);
console.log("  HTTP Status: 200 OK");
console.log("  AAPL:        $198.52 (+1.23%)");
console.log("  MSFT:        $412.87 (-0.45%)");
console.log("  GOOGL:       $175.33 (+0.89%)");
console.log("  Latency:     142ms\n");

// ─── Step 3: Receipt generated (proof layer only) ───────────────────

console.log("STEP 3: Receipt generated (proof layer — no governance)\n");

const receipt = generateReceipt(
  intentHash, execHash, intentId, "api_call", "research-agent-v3",
);

const result = verifyReceipt(receipt);
const ledger = createLedger();
ledger.append({
  intent_id: intentId, action: "api_call", agent_id: "research-agent-v3",
  status: "executed", detail: "Stock data fetched: AAPL, MSFT, GOOGL",
  receipt_hash: receipt.hash_chain.receipt_hash,
  intent_hash: receipt.hash_chain.intent_hash,
});

console.log("═══════════════════════════════════════════════════════");
console.log("  SUMMARY");
console.log("═══════════════════════════════════════════════════════");
console.log("  Intent:          api_call (read-only)");
console.log("  Risk:            LOW");
console.log("  Human Approval:  NO (not required)");
console.log("  Result:          success (200 OK)");
console.log("  Receipt Type:    action (proof layer only)");
console.log("  Hash Chain:      3 hashes (intent → execution → receipt)");
console.log("  Receipt Hash:    " + receipt.hash_chain.receipt_hash.slice(0, 16) + "...");
console.log("  Ledger Entries:  " + ledger.getEntryCount());
console.log("  Verification:    " + (result.valid ? "PASS" : "FAIL"));
console.log("═══════════════════════════════════════════════════════\n");

console.log("Note: This receipt uses the core proof layer (3-hash chain).");
console.log("No governance or authorization hashes — the action was low-risk");
console.log("and executed automatically. The receipt still proves what happened.\n");
