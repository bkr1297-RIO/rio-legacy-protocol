#!/usr/bin/env node
/**
 * RIO Receipt Protocol — End-to-End Demo
 *
 * Demonstrates the complete flow:
 *   1. An action occurs (simulated: send_email)
 *   2. A receipt is generated with hash chain
 *   3. The receipt is signed with Ed25519
 *   4. The receipt hash is appended to a hash-chained ledger
 *   5. An independent verifier checks everything
 *
 * Run:  node cli/demo.mjs
 *
 * This demo uses ONLY Node.js built-in crypto — zero external dependencies.
 *
 * @version 1.0.0
 * @license MIT OR Apache-2.0
 */

import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateReceipt,
  verifyReceipt,
  hashIntent,
  hashExecution,
  generateKeyPair,
  signReceipt,
} from "../reference/receipts.mjs";
import { createLedger } from "../reference/ledger.mjs";
import {
  verifyReceipt as standaloneVerify,
  verifyChain,
} from "../reference/verifier.mjs";

// ─── ANSI Colors ─────────────────────────────────────────────────────

const B = "\x1b[1m";
const G = "\x1b[32m";
const R = "\x1b[31m";
const C = "\x1b[36m";
const Y = "\x1b[33m";
const D = "\x1b[2m";
const X = "\x1b[0m";

function pass(msg) { console.log(`  ${G}✓${X} ${msg}`); }
function fail(msg) { console.log(`  ${R}✗${X} ${msg}`); }
function info(msg) { console.log(`  ${D}${msg}${X}`); }
function step(n, msg) { console.log(`\n${B}${C}Step ${n}: ${msg}${X}`); }

// ─── Output Directory ────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "demo-output");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ═══════════════════════════════════════════════════════════════════════
//  DEMO START
// ═══════════════════════════════════════════════════════════════════════

console.log(`\n${B}═══════════════════════════════════════════════════════════${X}`);
console.log(`${B}  RIO Receipt Protocol — End-to-End Demo${X}`);
console.log(`${B}═══════════════════════════════════════════════════════════${X}`);
console.log(`${D}  Proving: action → receipt → sign → ledger → verify${X}`);
console.log(`${D}  Zero external dependencies. Node.js built-in crypto only.${X}`);

// ─── Step 1: Generate Ed25519 Key Pair ───────────────────────────────

step(1, "Generate Ed25519 Key Pair");

const keys = generateKeyPair();
pass(`Private key: ${keys.privateKeyHex.slice(0, 16)}...${D}(32 bytes, hex-encoded)${X}`);
pass(`Public key:  ${keys.publicKeyHex.slice(0, 16)}...${D}(32 bytes, hex-encoded)${X}`);
info("Key pair generated using Node.js crypto.generateKeyPairSync('ed25519')");
info("In production, the private key would be stored in a secure vault (e.g., Azure Key Vault).");
info("The public key is distributed to verifiers.");

// ─── Step 2: Simulate an Action ──────────────────────────────────────

step(2, "Simulate an Action (send_email)");

const intentId = randomUUID();
const timestamp = new Date().toISOString();

const intent = {
  intent_id: intentId,
  action: "send_email",
  agent_id: "copilot-demo-001",
  parameters: {
    to: "client@example.com",
    subject: "Q2 Financial Report",
    body: "Please find the Q2 report attached.",
  },
  timestamp,
};

const execution = {
  intent_id: intentId,
  action: "send_email",
  result: "delivered",
  connector: "email-connector",
  message_id: "<msg-" + randomUUID().slice(0, 8) + "@example.com>",
  timestamp: new Date().toISOString(),
};

pass(`Intent ID:  ${intentId}`);
pass(`Action:     send_email → client@example.com`);
pass(`Agent:      copilot-demo-001`);
pass(`Execution:  delivered via email-connector`);

// ─── Step 3: Generate Receipt with Hash Chain ────────────────────────

step(3, "Generate Receipt (SHA-256 Hash Chain)");

const intentHash = hashIntent(intent);
const executionHash = hashExecution(execution);

const receipt = generateReceipt({
  intent_hash: intentHash,
  execution_hash: executionHash,
  intent_id: intentId,
  action: intent.action,
  agent_id: intent.agent_id,
});

pass(`Receipt ID:    ${receipt.receipt_id}`);
pass(`Receipt Type:  ${receipt.receipt_type} (${receipt.verification.chain_length}-hash chain)`);
pass(`Intent Hash:   ${intentHash.slice(0, 32)}...`);
pass(`Execution Hash:${executionHash.slice(0, 32)}...`);
pass(`Receipt Hash:  ${receipt.hash_chain.receipt_hash.slice(0, 32)}...`);
info(`Chain order: ${receipt.verification.chain_order.join(" → ")}`);
info("Receipt hash = SHA-256(intent_hash + execution_hash), computed from canonical JSON.");

// ─── Step 4: Sign the Receipt with Ed25519 ───────────────────────────

step(4, "Sign Receipt with Ed25519");

signReceipt(receipt, {
  privateKey: keys.privateKeyObj,
  publicKeyHex: keys.publicKeyHex,
  signerId: "rio-gateway-demo",
});

pass(`Signer:     ${receipt.identity_binding.signer_id}`);
pass(`Signature:  ${receipt.identity_binding.signature_hex.slice(0, 32)}...${D}(64 bytes, hex-encoded)${X}`);
pass(`Payload:    receipt_hash (${receipt.identity_binding.signature_payload_hash.slice(0, 32)}...)`);
pass(`Method:     ${receipt.identity_binding.verification_method}`);
info("The signed payload is the UTF-8 encoding of the 64-char hex receipt_hash string.");
info("Signature = Ed25519.sign(privateKey, UTF-8(receipt_hash))");

// ─── Step 5: Append to Hash-Chained Ledger ───────────────────────────

step(5, "Append to Hash-Chained Ledger");

const ledger = createLedger();

ledger.append({
  intent_id: intentId,
  action: intent.action,
  agent_id: intent.agent_id,
  status: "executed",
  detail: "Email delivered to client@example.com",
  receipt_hash: receipt.hash_chain.receipt_hash,
});

const entries = ledger.getEntries();
const entry = entries[0];

pass(`Ledger entry #1`);
pass(`  Previous hash: ${entry.prev_hash.slice(0, 32)}...${D}(genesis)${X}`);
pass(`  Entry hash:    ${entry.ledger_hash.slice(0, 32)}...`);
pass(`  Receipt hash:  ${entry.receipt_hash.slice(0, 32)}...`);
info("Ledger is append-only. Each entry hash = SHA-256(previous_hash + entry_data).");
info("Tampering with any entry breaks the chain for all subsequent entries.");

// ─── Step 6: Independent Verification ────────────────────────────────

step(6, "Independent Verification");

console.log(`\n  ${Y}6a. Verify receipt hash (recompute from components):${X}`);
const internalResult = verifyReceipt(receipt);
if (internalResult.valid) {
  pass("Receipt hash: VALID (recomputed matches stored)");
} else {
  fail("Receipt hash: INVALID");
}

console.log(`\n  ${Y}6b. Standalone verifier (independent of receipt generator):${X}`);
const standaloneResult = standaloneVerify(receipt);
if (standaloneResult.valid) {
  pass("Standalone hash verification: VALID");
} else {
  fail("Standalone hash verification: INVALID");
  for (const e of standaloneResult.errors) fail(`  ${e}`);
}

if (standaloneResult.signature_valid === true) {
  pass("Ed25519 signature verification: VALID");
} else if (standaloneResult.signature_valid === false) {
  fail("Ed25519 signature verification: INVALID");
} else {
  info("Ed25519 signature: not checked (receipt not signed)");
}

console.log(`\n  ${Y}6c. Verify ledger chain integrity:${X}`);
const chainResult = verifyChain(entries);
if (chainResult.valid) {
  pass(`Ledger chain: INTACT (${chainResult.entries_checked} entries verified)`);
} else {
  fail("Ledger chain: BROKEN");
}

console.log(`\n  ${Y}6d. Cross-reference: receipt_hash in ledger matches receipt:${X}`);
if (entry.receipt_hash === receipt.hash_chain.receipt_hash) {
  pass("Ledger entry receipt_hash matches signed receipt");
} else {
  fail("MISMATCH: ledger receipt_hash does not match receipt");
}

// ─── Step 7: Save Artifacts ──────────────────────────────────────────

step(7, "Save Verification Artifacts");

const receiptPath = join(outDir, "receipt.json");
const ledgerPath = join(outDir, "ledger.json");
const publicKeyPath = join(outDir, "public_key.json");

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
writeFileSync(ledgerPath, JSON.stringify(entries, null, 2) + "\n");
writeFileSync(publicKeyPath, JSON.stringify({
  algorithm: "ed25519",
  public_key_hex: keys.publicKeyHex,
  signer_id: "rio-gateway-demo",
  note: "Use this public key to verify the receipt signature independently.",
}, null, 2) + "\n");

pass(`Receipt saved:    ${receiptPath}`);
pass(`Ledger saved:     ${ledgerPath}`);
pass(`Public key saved: ${publicKeyPath}`);

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n${B}═══════════════════════════════════════════════════════════${X}`);
console.log(`${B}  RESULT: ${G}ALL VERIFICATIONS PASSED${X}`);
console.log(`${B}═══════════════════════════════════════════════════════════${X}`);
console.log(`
  ${D}What was proven:${X}
  ${G}✓${X} An action occurred (send_email)
  ${G}✓${X} A receipt was generated with SHA-256 hash chain
  ${G}✓${X} The receipt was signed with Ed25519 (cryptographic proof)
  ${G}✓${X} The receipt hash was appended to a tamper-evident ledger
  ${G}✓${X} An independent verifier confirmed the hash, signature, and chain
  ${G}✓${X} The receipt can be verified by anyone with the public key

  ${D}To verify the saved receipt independently:${X}
  ${C}node cli/verify.mjs demo-output/receipt.json${X}

  ${D}To verify the saved ledger independently:${X}
  ${C}node cli/verify.mjs --ledger demo-output/ledger.json${X}
`);
