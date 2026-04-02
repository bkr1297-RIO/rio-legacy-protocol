/**
 * RIO Receipt Protocol — Conformance Test Suite v2.2
 *
 * Tests both proof-layer receipts (core open standard) and
 * governed receipts (optional extension). Any implementation
 * MUST pass the proof-layer tests. Governed tests are for
 * implementations that include governance/authorization.
 *
 * Run: node tests/conformance.test.mjs
 * Exit code 0 = all pass | Exit code 1 = failure
 *
 * @version 2.0.0
 */

import { createHash, randomUUID } from "node:crypto";
import {
  generateReceipt, verifyReceipt, hashIntent,
  hashGovernance, hashAuthorization, hashExecution, sha256,
  generateKeyPair, signReceipt,
} from "../reference/receipts.mjs";
import { createLedger, GENESIS_HASH } from "../reference/ledger.mjs";
import {
  verifyReceipt as standaloneVerify,
  verifyChain, verifyReceiptAgainstLedger, verifyReceiptBatch,
} from "../reference/verifier.mjs";

const GREEN = "\x1b[32m", RED = "\x1b[31m", BOLD = "\x1b[1m", RESET = "\x1b[0m";
let total = 0, passed = 0, failed = 0;

function suite(n) { console.log(`\n${BOLD}${n}${RESET}`); }
function test(n, fn) {
  total++;
  try { fn(); passed++; console.log(`  ${GREEN}\u2713${RESET} ${n}`); }
  catch (e) { failed++; console.log(`  ${RED}\u2717${RESET} ${n}\n    ${RED}${e.message}${RESET}`); }
}
function assert(c, m) { if (!c) throw new Error(m || "Assertion failed"); }
function assertEqual(a, b, m) { if (a !== b) throw new Error(m || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ─── Fixtures ────────────────────────────────────────────────────────

function makeIntent() {
  return { intent_id: randomUUID(), action: "send_email", agent_id: "test-agent-001",
    parameters: { to: "user@example.com", subject: "Test" }, timestamp: new Date().toISOString() };
}
function makeExecution(id) {
  return { intent_id: id, action: "send_email", result: "delivered",
    connector: "email-connector", timestamp: new Date().toISOString() };
}
function makeGovernance(id) {
  return { intent_id: id, status: "approved", risk_level: "low",
    requires_approval: false, checks: ["rate_limit", "scope"] };
}
function makeAuthorization(id) {
  return { intent_id: id, decision: "approved", authorized_by: "HUMAN:jane@example.com",
    timestamp: new Date().toISOString(), conditions: null };
}

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 1: PROOF-LAYER RECEIPTS (CORE OPEN STANDARD)
// ═══════════════════════════════════════════════════════════════════════

suite("1. Proof-Layer Receipt Generation");

test("generates a proof-layer receipt with 3-hash chain", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  assertEqual(receipt.receipt_type, "action");
  assertEqual(receipt.verification.chain_length, 3);
  assert(receipt.verification.chain_order.length === 3);
  assertEqual(receipt.authorized_by, null);
  assertEqual(receipt.hash_chain.governance_hash, null);
  assertEqual(receipt.hash_chain.authorization_hash, null);
});

test("proof-layer receipt has all required core fields", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  assert(receipt.receipt_id, "Missing receipt_id");
  assert(receipt.intent_id, "Missing intent_id");
  assert(receipt.action, "Missing action");
  assert(receipt.agent_id, "Missing agent_id");
  assert(receipt.timestamp, "Missing timestamp");
  assert(receipt.hash_chain.intent_hash, "Missing intent_hash");
  assert(receipt.hash_chain.execution_hash, "Missing execution_hash");
  assert(receipt.hash_chain.receipt_hash, "Missing receipt_hash");
});

test("proof-layer chain_order is [intent_hash, execution_hash, receipt_hash]", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  const order = receipt.verification.chain_order;
  assertEqual(order[0], "intent_hash");
  assertEqual(order[1], "execution_hash");
  assertEqual(order[2], "receipt_hash");
});

test("proof-layer receipt self-verifies", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  const result = verifyReceipt(receipt);
  assert(result.valid, `Proof-layer receipt failed verification: ${result.computed_hash} !== ${result.stored_hash}`);
});

test("proof-layer receipt verifies with standalone verifier", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  const result = standaloneVerify(receipt);
  assert(result.valid, `Standalone verification failed: ${result.errors.join(", ")}`);
  assertEqual(result.chain_length, 3);
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 2: GOVERNED RECEIPTS (OPTIONAL EXTENSION)
// ═══════════════════════════════════════════════════════════════════════

suite("2. Governed Receipt Generation (Extension)");

test("generates a governed receipt with 5-hash chain", () => {
  const intent = makeIntent();
  const gov = makeGovernance(intent.intent_id);
  const auth = makeAuthorization(intent.intent_id);
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), governance_hash: hashGovernance(gov),
    authorization_hash: hashAuthorization(auth), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    authorized_by: auth.authorized_by,
  });
  assertEqual(receipt.receipt_type, "governed_action");
  assertEqual(receipt.verification.chain_length, 5);
  assert(receipt.hash_chain.governance_hash !== null);
  assert(receipt.hash_chain.authorization_hash !== null);
  assertEqual(receipt.authorized_by, "HUMAN:jane@example.com");
});

test("governed receipt chain_order has all 5 fields in order", () => {
  const intent = makeIntent();
  const gov = makeGovernance(intent.intent_id);
  const auth = makeAuthorization(intent.intent_id);
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), governance_hash: hashGovernance(gov),
    authorization_hash: hashAuthorization(auth), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    authorized_by: auth.authorized_by,
  });
  const order = receipt.verification.chain_order;
  assertEqual(order.length, 5);
  assertEqual(order[0], "intent_hash");
  assertEqual(order[1], "governance_hash");
  assertEqual(order[2], "authorization_hash");
  assertEqual(order[3], "execution_hash");
  assertEqual(order[4], "receipt_hash");
});

test("governed receipt self-verifies", () => {
  const intent = makeIntent();
  const gov = makeGovernance(intent.intent_id);
  const auth = makeAuthorization(intent.intent_id);
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), governance_hash: hashGovernance(gov),
    authorization_hash: hashAuthorization(auth), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    authorized_by: auth.authorized_by,
  });
  const result = verifyReceipt(receipt);
  assert(result.valid, "Governed receipt failed self-verification");
});

test("governed receipt verifies with standalone verifier", () => {
  const intent = makeIntent();
  const gov = makeGovernance(intent.intent_id);
  const auth = makeAuthorization(intent.intent_id);
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), governance_hash: hashGovernance(gov),
    authorization_hash: hashAuthorization(auth), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    authorized_by: auth.authorized_by,
  });
  const result = standaloneVerify(receipt);
  assert(result.valid, `Standalone verification failed: ${result.errors.join(", ")}`);
  assertEqual(result.chain_length, 5);
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 3: HASH INTEGRITY
// ═══════════════════════════════════════════════════════════════════════

suite("3. Hash Integrity");

test("SHA-256 produces 64-char hex string", () => {
  const hash = sha256("test");
  assertEqual(hash.length, 64);
  assert(/^[a-f0-9]{64}$/.test(hash));
});

test("SHA-256 is deterministic", () => {
  assertEqual(sha256("hello"), sha256("hello"));
});

test("SHA-256 is collision-resistant (different inputs = different hashes)", () => {
  assert(sha256("input_a") !== sha256("input_b"));
});

test("all receipt hashes are valid 64-char hex", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  for (const [k, v] of Object.entries(receipt.hash_chain)) {
    if (v !== null) assert(/^[a-f0-9]{64}$/.test(v), `${k} is not valid hex: ${v}`);
  }
});

test("tampered receipt fails verification", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  receipt.action = "transfer_funds";
  const result = verifyReceipt(receipt);
  assert(result.valid, "Tampered action should still pass receipt hash check (action is not in the hash)");
  // But tampering with a hash field SHOULD fail
  const receipt2 = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  receipt2.hash_chain.intent_hash = sha256("tampered");
  const result2 = verifyReceipt(receipt2);
  assert(!result2.valid, "Tampered hash should fail verification");
});

test("tampered receipt fails standalone verification", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  receipt.hash_chain.execution_hash = sha256("tampered");
  const result = standaloneVerify(receipt);
  assert(!result.valid, "Tampered receipt should fail standalone verification");
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 4: LEDGER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

suite("4. Ledger Operations");

test("ledger starts empty with genesis hash", () => {
  const ledger = createLedger();
  assertEqual(ledger.getEntries().length, 0);
  assertEqual(ledger.getCurrentHash(), GENESIS_HASH);
});

test("append creates a valid entry with correct prev_hash", () => {
  const ledger = createLedger();
  const entry = ledger.append({ intent_id: randomUUID(), action: "test",
    agent_id: "agent-1", status: "executed", detail: "ok" });
  assertEqual(entry.prev_hash, GENESIS_HASH);
  assert(entry.ledger_hash, "Missing ledger_hash");
  assert(entry.entry_id, "Missing entry_id");
});

test("chain links correctly across multiple entries", () => {
  const ledger = createLedger();
  const e1 = ledger.append({ intent_id: randomUUID(), action: "a1",
    agent_id: "agent-1", status: "executed", detail: "ok" });
  const e2 = ledger.append({ intent_id: randomUUID(), action: "a2",
    agent_id: "agent-1", status: "executed", detail: "ok" });
  assertEqual(e2.prev_hash, e1.ledger_hash);
  assertEqual(ledger.getCurrentHash(), e2.ledger_hash);
});

test("ledger chain verifies with standalone verifier", () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) {
    ledger.append({ intent_id: randomUUID(), action: `action_${i}`,
      agent_id: "agent-1", status: "executed", detail: `entry ${i}` });
  }
  const result = verifyChain(ledger.getEntries());
  assert(result.valid, `Chain verification failed: ${result.reason}`);
  assertEqual(result.entries_checked, 5);
});

test("tampered ledger entry breaks chain verification", () => {
  const ledger = createLedger();
  for (let i = 0; i < 3; i++) {
    ledger.append({ intent_id: randomUUID(), action: `action_${i}`,
      agent_id: "agent-1", status: "executed", detail: `entry ${i}` });
  }
  const entries = ledger.getEntries();
  entries[1].detail = "TAMPERED";
  const result = verifyChain(entries);
  assert(!result.valid, "Tampered chain should fail verification");
  assertEqual(result.first_invalid, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 5: CROSS-VERIFICATION
// ═══════════════════════════════════════════════════════════════════════

suite("5. Cross-Verification (Receipt ↔ Ledger)");

test("receipt cross-verifies against matching ledger entry", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  const ledger = createLedger();
  const entry = ledger.append({
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    status: "executed", detail: "ok", receipt_hash: receipt.hash_chain.receipt_hash,
    intent_hash: receipt.hash_chain.intent_hash,
  });
  const result = verifyReceiptAgainstLedger(receipt, entry);
  assert(result.valid, `Cross-verification failed: ${result.errors.join(", ")}`);
});

test("mismatched receipt/ledger fails cross-verification", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  const ledger = createLedger();
  const entry = ledger.append({
    intent_id: randomUUID(), action: intent.action, agent_id: intent.agent_id,
    status: "executed", detail: "ok", receipt_hash: sha256("wrong"),
  });
  const result = verifyReceiptAgainstLedger(receipt, entry);
  assert(!result.valid, "Mismatched receipt/ledger should fail");
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 6: BATCH VERIFICATION
// ═══════════════════════════════════════════════════════════════════════

suite("6. Batch Verification");

test("batch verifies multiple valid receipts", () => {
  const receipts = [];
  for (let i = 0; i < 5; i++) {
    const intent = makeIntent();
    const exec = makeExecution(intent.intent_id);
    receipts.push(generateReceipt({
      intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
      intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    }));
  }
  const result = verifyReceiptBatch(receipts);
  assert(result.all_valid, "All receipts should be valid");
  assertEqual(result.valid, 5);
  assertEqual(result.invalid, 0);
});

test("batch detects tampered receipt among valid ones", () => {
  const receipts = [];
  for (let i = 0; i < 5; i++) {
    const intent = makeIntent();
    const exec = makeExecution(intent.intent_id);
    receipts.push(generateReceipt({
      intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
      intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    }));
  }
  receipts[2].hash_chain.intent_hash = sha256("tampered");
  const result = verifyReceiptBatch(receipts);
  assert(!result.all_valid, "Batch should detect tampered receipt");
  assertEqual(result.valid, 4);
  assertEqual(result.invalid, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 7: MIXED RECEIPT TYPES
// ═══════════════════════════════════════════════════════════════════════

suite("7. Mixed Receipt Types (Proof-Layer + Governed)");

test("batch verifies mix of proof-layer and governed receipts", () => {
  const receipts = [];
  // 3 proof-layer
  for (let i = 0; i < 3; i++) {
    const intent = makeIntent();
    const exec = makeExecution(intent.intent_id);
    receipts.push(generateReceipt({
      intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
      intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    }));
  }
  // 2 governed
  for (let i = 0; i < 2; i++) {
    const intent = makeIntent();
    const gov = makeGovernance(intent.intent_id);
    const auth = makeAuthorization(intent.intent_id);
    const exec = makeExecution(intent.intent_id);
    receipts.push(generateReceipt({
      intent_hash: hashIntent(intent), governance_hash: hashGovernance(gov),
      authorization_hash: hashAuthorization(auth), execution_hash: hashExecution(exec),
      intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
      authorized_by: auth.authorized_by,
    }));
  }
  const result = verifyReceiptBatch(receipts);
  assert(result.all_valid, "Mixed batch should all verify");
  assertEqual(result.total, 5);
});

test("ledger accepts both proof-layer and governed receipts", () => {
  const ledger = createLedger();
  // proof-layer
  const i1 = makeIntent();
  const e1 = makeExecution(i1.intent_id);
  const r1 = generateReceipt({
    intent_hash: hashIntent(i1), execution_hash: hashExecution(e1),
    intent_id: i1.intent_id, action: i1.action, agent_id: i1.agent_id,
  });
  ledger.append({ intent_id: i1.intent_id, action: i1.action, agent_id: i1.agent_id,
    status: "executed", detail: "proof-layer", receipt_hash: r1.hash_chain.receipt_hash });
  // governed
  const i2 = makeIntent();
  const g2 = makeGovernance(i2.intent_id);
  const a2 = makeAuthorization(i2.intent_id);
  const e2 = makeExecution(i2.intent_id);
  const r2 = generateReceipt({
    intent_hash: hashIntent(i2), governance_hash: hashGovernance(g2),
    authorization_hash: hashAuthorization(a2), execution_hash: hashExecution(e2),
    intent_id: i2.intent_id, action: i2.action, agent_id: i2.agent_id,
    authorized_by: a2.authorized_by,
  });
  ledger.append({ intent_id: i2.intent_id, action: i2.action, agent_id: i2.agent_id,
    status: "executed", detail: "governed", receipt_hash: r2.hash_chain.receipt_hash });
  const result = verifyChain(ledger.getEntries());
  assert(result.valid, "Mixed ledger chain should verify");
  assertEqual(result.entries_checked, 2);
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 8: OPTIONAL EXTENSIONS (INGESTION + IDENTITY BINDING)
// ═══════════════════════════════════════════════════════════════════════

suite("8. Optional Extensions");

test("receipt with ingestion provenance", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    ingestion: { source: "api", channel: "POST /intent", timestamp: new Date().toISOString() },
  });
  assert(receipt.ingestion, "Missing ingestion");
  assertEqual(receipt.ingestion.source, "api");
  const result = verifyReceipt(receipt);
  assert(result.valid, "Receipt with ingestion should verify");
});

test("receipt with identity binding", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    identity_binding: { ed25519_signed: false },
  });
  assert(receipt.identity_binding, "Missing identity_binding");
  assertEqual(receipt.identity_binding.ed25519_signed, false);
  const result = verifyReceipt(receipt);
  assert(result.valid, "Receipt with identity binding should verify");
});

test("receipt without optional extensions still verifies", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  assert(!receipt.ingestion, "Should not have ingestion");
  assert(!receipt.identity_binding, "Should not have identity_binding");
  const result = verifyReceipt(receipt);
  assert(result.valid, "Receipt without extensions should verify");
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY 9: ED25519 SIGNING & VERIFICATION
// ═══════════════════════════════════════════════════════════════════════

suite("9. Ed25519 Signing & Verification");

test("generateKeyPair produces valid Ed25519 key pair", () => {
  const keys = generateKeyPair();
  assert(keys.privateKeyHex, "Missing privateKeyHex");
  assert(keys.publicKeyHex, "Missing publicKeyHex");
  assert(keys.privateKeyObj, "Missing privateKeyObj");
  assert(keys.publicKeyObj, "Missing publicKeyObj");
  assertEqual(keys.publicKeyHex.length, 64, "Public key should be 32 bytes (64 hex chars)");
});

test("signReceipt adds signature_hex to identity_binding", () => {
  const keys = generateKeyPair();
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  signReceipt(receipt, {
    privateKey: keys.privateKeyObj,
    publicKeyHex: keys.publicKeyHex,
    signerId: "test-signer",
  });
  assert(receipt.identity_binding, "Missing identity_binding after signing");
  assert(receipt.identity_binding.signature_hex, "Missing signature_hex");
  assertEqual(receipt.identity_binding.signature_hex.length, 128, "Ed25519 signature should be 64 bytes (128 hex chars)");
  assertEqual(receipt.identity_binding.signer_id, "test-signer");
  assertEqual(receipt.identity_binding.verification_method, "ed25519-nacl");
  assertEqual(receipt.identity_binding.public_key_hex, keys.publicKeyHex);
  assertEqual(receipt.identity_binding.signature_payload_hash, receipt.hash_chain.receipt_hash);
  assert(receipt.identity_binding.signed_at, "Missing signed_at timestamp");
  assert(/^\d{4}-\d{2}-\d{2}T/.test(receipt.identity_binding.signed_at), "signed_at should be ISO 8601");
});

test("signed receipt passes standalone verification with signature check", () => {
  const keys = generateKeyPair();
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  signReceipt(receipt, {
    privateKey: keys.privateKeyObj,
    publicKeyHex: keys.publicKeyHex,
    signerId: "test-signer",
  });
  const result = standaloneVerify(receipt);
  assert(result.valid, `Hash verification failed: ${result.errors?.join(", ")}`);
  assert(result.signature_valid === true, "Signature should be VALID");
});

test("tampered receipt_hash invalidates signature", () => {
  const keys = generateKeyPair();
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  signReceipt(receipt, {
    privateKey: keys.privateKeyObj,
    publicKeyHex: keys.publicKeyHex,
    signerId: "test-signer",
  });
  // Tamper with the receipt hash after signing
  receipt.hash_chain.receipt_hash = sha256("tampered-data");
  const result = standaloneVerify(receipt);
  // Hash verification should fail (recomputed != stored)
  assert(!result.valid, "Tampered receipt should fail hash verification");
});

test("tampered signature_hex fails verification", () => {
  const keys = generateKeyPair();
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  signReceipt(receipt, {
    privateKey: keys.privateKeyObj,
    publicKeyHex: keys.publicKeyHex,
    signerId: "test-signer",
  });
  // Tamper with the signature itself
  const sig = receipt.identity_binding.signature_hex;
  receipt.identity_binding.signature_hex = sig.slice(0, -2) + (sig.slice(-2) === "00" ? "ff" : "00");
  const result = standaloneVerify(receipt);
  assert(result.signature_valid === false, "Tampered signature should fail verification");
});

test("wrong public key fails signature verification", () => {
  const keys1 = generateKeyPair();
  const keys2 = generateKeyPair();
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  // Sign with key1 but embed key2's public key
  signReceipt(receipt, {
    privateKey: keys1.privateKeyObj,
    publicKeyHex: keys2.publicKeyHex,
    signerId: "test-signer",
  });
  const result = standaloneVerify(receipt);
  assert(result.signature_valid === false, "Wrong public key should fail verification");
});

test("unsigned receipt returns signature_valid=null (not checked)", () => {
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  const result = standaloneVerify(receipt);
  assert(result.valid, "Unsigned receipt hash should still verify");
  assert(result.signature_valid === null || result.signature_valid === undefined,
    "Unsigned receipt should not have signature_valid=true or false");
});

test("signed governed receipt verifies end-to-end", () => {
  const keys = generateKeyPair();
  const intent = makeIntent();
  const gov = makeGovernance(intent.intent_id);
  const auth = makeAuthorization(intent.intent_id);
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), governance_hash: hashGovernance(gov),
    authorization_hash: hashAuthorization(auth), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    authorized_by: auth.authorized_by,
  });
  signReceipt(receipt, {
    privateKey: keys.privateKeyObj,
    publicKeyHex: keys.publicKeyHex,
    signerId: "rio-gateway",
  });
  assertEqual(receipt.receipt_type, "governed_action");
  assertEqual(receipt.verification.chain_length, 5);
  const result = standaloneVerify(receipt);
  assert(result.valid, `Governed receipt hash failed: ${result.errors?.join(", ")}`);
  assert(result.signature_valid === true, "Governed receipt signature should be VALID");
});

test("signed receipt cross-verifies against ledger entry", () => {
  const keys = generateKeyPair();
  const intent = makeIntent();
  const exec = makeExecution(intent.intent_id);
  const receipt = generateReceipt({
    intent_hash: hashIntent(intent), execution_hash: hashExecution(exec),
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
  });
  signReceipt(receipt, {
    privateKey: keys.privateKeyObj,
    publicKeyHex: keys.publicKeyHex,
    signerId: "rio-gateway",
  });
  const ledger = createLedger();
  const entry = ledger.append({
    intent_id: intent.intent_id, action: intent.action, agent_id: intent.agent_id,
    status: "executed", detail: "ok", receipt_hash: receipt.hash_chain.receipt_hash,
    intent_hash: receipt.hash_chain.intent_hash,
  });
  const crossResult = verifyReceiptAgainstLedger(receipt, entry);
  assert(crossResult.valid, `Cross-verification failed: ${crossResult.errors?.join(", ")}`);
  const standaloneResult = standaloneVerify(receipt);
  assert(standaloneResult.signature_valid === true, "Signature should verify after ledger append");
});

// ─── Results ─────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`${BOLD}RIO Receipt Protocol v2.2 Conformance Results${RESET}`);
console.log(`${"═".repeat(60)}`);
console.log(`  Total:  ${total}`);
console.log(`  ${GREEN}Passed: ${passed}${RESET}`);
if (failed > 0) console.log(`  ${RED}Failed: ${failed}${RESET}`);
console.log(`${"═".repeat(60)}`);
console.log(failed === 0
  ? `\n${GREEN}${BOLD}\u2713 CONFORMANT — All tests passed${RESET}\n`
  : `\n${RED}${BOLD}\u2717 NON-CONFORMANT — ${failed} test(s) failed${RESET}\n`
);
process.exit(failed === 0 ? 0 : 1);
