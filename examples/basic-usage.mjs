#!/usr/bin/env node
/**
 * RIO Receipt Protocol — Basic Usage Example
 * Demonstrates proof-layer (3-hash) and governed (5-hash) receipts.
 * Run: node examples/basic-usage.mjs
 */
import { randomUUID } from "node:crypto";
import { generateReceipt, verifyReceipt, hashIntent, hashExecution, hashGovernance, hashAuthorization } from "../reference/receipts.mjs";
import { createLedger } from "../reference/ledger.mjs";
import { verifyReceipt as standaloneVerify, verifyChain } from "../reference/verifier.mjs";

const B = "\x1b[1m", G = "\x1b[32m", C = "\x1b[36m", D = "\x1b[2m", R = "\x1b[0m";
console.log(`\n${B}=== RIO Receipt Protocol — Basic Usage ===${R}\n`);
const ledger = createLedger();

// === EXAMPLE 1: Proof-Layer Receipt (Core Open Standard) ===
console.log(`${B}${C}Example 1: Proof-Layer Receipt${R}`);
console.log(`${D}No governance, no approval — just proof of what happened.${R}\n`);
const i1 = { intent_id: randomUUID(), action: "send_email", agent_id: "copilot-001", parameters: { to: "client@example.com" }, timestamp: new Date().toISOString() };
const e1 = { intent_id: i1.intent_id, action: "send_email", result: "delivered", connector: "email-connector", timestamp: new Date().toISOString() };
const r1 = generateReceipt({ intent_hash: hashIntent(i1), execution_hash: hashExecution(e1), intent_id: i1.intent_id, action: i1.action, agent_id: i1.agent_id });
console.log(`  Type:  ${r1.receipt_type} (${r1.verification.chain_length}-hash chain)`);
console.log(`  Chain: ${r1.verification.chain_order.join(" -> ")}`);
console.log(`  Valid: ${verifyReceipt(r1).valid ? `${G}YES${R}` : "NO"}\n`);
ledger.append({ intent_id: i1.intent_id, action: i1.action, agent_id: i1.agent_id, status: "executed", detail: "Email delivered", receipt_hash: r1.hash_chain.receipt_hash });

// === EXAMPLE 2: Governed Receipt (Extension) ===
console.log(`${B}${C}Example 2: Governed Receipt (Extension)${R}`);
console.log(`${D}With governance evaluation and human approval.${R}\n`);
const i2 = { intent_id: randomUUID(), action: "transfer_funds", agent_id: "finance-002", parameters: { amount: 50000, currency: "USD" }, timestamp: new Date().toISOString() };
const g2 = { intent_id: i2.intent_id, status: "approved", risk_level: "high", requires_approval: true, checks: ["rate_limit", "scope", "amount_threshold"] };
const a2 = { intent_id: i2.intent_id, decision: "approved", authorized_by: "HUMAN:cfo@example.com", timestamp: new Date().toISOString(), conditions: null };
const e2 = { intent_id: i2.intent_id, action: "transfer_funds", result: "completed", connector: "banking-connector", timestamp: new Date().toISOString() };
const r2 = generateReceipt({ intent_hash: hashIntent(i2), governance_hash: hashGovernance(g2), authorization_hash: hashAuthorization(a2), execution_hash: hashExecution(e2), intent_id: i2.intent_id, action: i2.action, agent_id: i2.agent_id, authorized_by: a2.authorized_by });
console.log(`  Type:  ${r2.receipt_type} (${r2.verification.chain_length}-hash chain)`);
console.log(`  Chain: ${r2.verification.chain_order.join(" -> ")}`);
console.log(`  Auth:  ${r2.authorized_by}`);
console.log(`  Valid: ${verifyReceipt(r2).valid ? `${G}YES${R}` : "NO"}\n`);
ledger.append({ intent_id: i2.intent_id, action: i2.action, agent_id: i2.agent_id, status: "executed", detail: "Funds transferred", receipt_hash: r2.hash_chain.receipt_hash });

// === LEDGER VERIFICATION ===
console.log(`${B}${C}Ledger Verification${R}`);
const chain = verifyChain(ledger.getEntries());
console.log(`  Entries: ${chain.entries_checked}`);
console.log(`  Valid:   ${chain.valid ? G + "INTACT" + R : "BROKEN"}`);
console.log(`\n${D}Both receipt types coexist in the same tamper-evident ledger.`);
console.log(`The proof layer works standalone. Governance is an optional extension.${R}\n`);
