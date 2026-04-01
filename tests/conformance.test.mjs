/**
 * RIO Receipt Protocol — Conformance Test Suite
 *
 * Any implementation of the RIO Receipt Protocol can run these tests
 * to prove conformance. The tests verify:
 *
 * 1. Receipt generation produces valid receipts
 * 2. Receipt verification correctly validates and rejects receipts
 * 3. Ledger entries form a valid hash chain
 * 4. Chain verification detects tampering
 * 5. Cross-verification between receipts and ledger entries works
 *
 * Run: node tests/conformance.test.mjs
 *
 * Exit code 0 = all tests pass (conformant)
 * Exit code 1 = one or more tests fail (non-conformant)
 *
 * @version 1.0.0
 * @license MIT OR Apache-2.0
 */

import { createHash, randomUUID } from "node:crypto";
import {
  generateReceipt,
  verifyReceipt,
  hashIntent,
  hashGovernance,
  hashAuthorization,
  hashExecution,
  sha256,
} from "../reference/receipts.mjs";
import { createLedger, GENESIS_HASH } from "../reference/ledger.mjs";
import {
  verifyReceipt as standaloneVerifyReceipt,
  verifyChain as standaloneVerifyChain,
  verifyReceiptAgainstLedger,
  verifyReceiptBatch,
} from "../reference/verifier.mjs";

// ─── Test Framework (zero dependencies) ──────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let currentSuite = "";

function suite(name) {
  currentSuite = name;
  console.log(`\n${BOLD}${name}${RESET}`);
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err) {
    failedTests++;
    console.log(`  ${RED}✗${RESET} ${name}`);
    console.log(`    ${RED}${err.message}${RESET}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// ─── Test Fixtures ───────────────────────────────────────────────────

function createTestIntent() {
  return {
    intent_id: randomUUID(),
    action: "send_email",
    agent_id: "test-agent-001",
    parameters: { to: "user@example.com", subject: "Test" },
    timestamp: new Date().toISOString(),
  };
}

function createTestGovernance(intentId) {
  return {
    intent_id: intentId,
    status: "approved",
    risk_level: "low",
    requires_approval: false,
    checks: [
      { check: "agent_recognized", result: "pass" },
      { check: "action_permitted", result: "pass" },
    ],
  };
}

function createTestAuthorization(intentId) {
  return {
    intent_id: intentId,
    decision: "approved",
    authorized_by: "POLICY:auto_approve_low_risk",
    timestamp: new Date().toISOString(),
    conditions: null,
  };
}

function createTestExecution(intentId) {
  return {
    intent_id: intentId,
    action: "send_email",
    result: "success",
    connector: "gmail",
    timestamp: new Date().toISOString(),
  };
}

function generateFullReceipt(overrides = {}) {
  const intent = createTestIntent();
  const governance = createTestGovernance(intent.intent_id);
  const authorization = createTestAuthorization(intent.intent_id);
  const execution = createTestExecution(intent.intent_id);

  return generateReceipt({
    intent_hash: hashIntent(intent),
    governance_hash: hashGovernance(governance),
    authorization_hash: hashAuthorization(authorization),
    execution_hash: hashExecution(execution),
    intent_id: intent.intent_id,
    action: intent.action,
    agent_id: intent.agent_id,
    authorized_by: authorization.authorized_by,
    ...overrides,
  });
}

// ─── Test Suites ─────────────────────────────────────────────────────

console.log(`${BOLD}${CYAN}RIO Receipt Protocol — Conformance Test Suite${RESET}`);
console.log(`${DIM}Testing reference implementation against protocol specification${RESET}`);

// ── Suite 1: SHA-256 Hashing ─────────────────────────────────────────

suite("1. SHA-256 Hashing");

test("sha256 produces 64-character hex string", () => {
  const hash = sha256("test");
  assertEqual(hash.length, 64);
  assert(/^[a-f0-9]{64}$/.test(hash), "Hash must be lowercase hex");
});

test("sha256 is deterministic", () => {
  const a = sha256("hello world");
  const b = sha256("hello world");
  assertEqual(a, b);
});

test("sha256 produces different hashes for different inputs", () => {
  const a = sha256("input-a");
  const b = sha256("input-b");
  assert(a !== b, "Different inputs must produce different hashes");
});

test("sha256 matches known test vector", () => {
  // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  const hash = sha256("");
  assertEqual(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

// ── Suite 2: Stage Hashing ───────────────────────────────────────────

suite("2. Stage Hash Functions");

test("hashIntent produces valid SHA-256", () => {
  const intent = createTestIntent();
  const hash = hashIntent(intent);
  assert(/^[a-f0-9]{64}$/.test(hash), "Must be valid SHA-256 hex");
});

test("hashIntent is deterministic for same input", () => {
  const intent = createTestIntent();
  assertEqual(hashIntent(intent), hashIntent(intent));
});

test("hashGovernance produces valid SHA-256", () => {
  const gov = createTestGovernance(randomUUID());
  const hash = hashGovernance(gov);
  assert(/^[a-f0-9]{64}$/.test(hash));
});

test("hashAuthorization produces valid SHA-256", () => {
  const auth = createTestAuthorization(randomUUID());
  const hash = hashAuthorization(auth);
  assert(/^[a-f0-9]{64}$/.test(hash));
});

test("hashExecution produces valid SHA-256", () => {
  const exec = createTestExecution(randomUUID());
  const hash = hashExecution(exec);
  assert(/^[a-f0-9]{64}$/.test(hash));
});

// ── Suite 3: Receipt Generation ──────────────────────────────────────

suite("3. Receipt Generation");

test("generateReceipt returns a receipt with all required fields", () => {
  const receipt = generateFullReceipt();
  assert(receipt.receipt_id, "Must have receipt_id");
  assert(receipt.receipt_type, "Must have receipt_type");
  assert(receipt.intent_id, "Must have intent_id");
  assert(receipt.action, "Must have action");
  assert(receipt.agent_id, "Must have agent_id");
  assert(receipt.authorized_by, "Must have authorized_by");
  assert(receipt.timestamp, "Must have timestamp");
  assert(receipt.hash_chain, "Must have hash_chain");
  assert(receipt.verification, "Must have verification");
});

test("receipt_type defaults to governed_action", () => {
  const receipt = generateFullReceipt();
  assertEqual(receipt.receipt_type, "governed_action");
});

test("receipt_type can be overridden", () => {
  const receipt = generateFullReceipt({ receipt_type: "kill_switch" });
  assertEqual(receipt.receipt_type, "kill_switch");
});

test("hash_chain contains all 5 required hashes", () => {
  const receipt = generateFullReceipt();
  const hc = receipt.hash_chain;
  assert(/^[a-f0-9]{64}$/.test(hc.intent_hash), "intent_hash");
  assert(/^[a-f0-9]{64}$/.test(hc.governance_hash), "governance_hash");
  assert(/^[a-f0-9]{64}$/.test(hc.authorization_hash), "authorization_hash");
  assert(/^[a-f0-9]{64}$/.test(hc.execution_hash), "execution_hash");
  assert(/^[a-f0-9]{64}$/.test(hc.receipt_hash), "receipt_hash");
});

test("verification metadata is correct", () => {
  const receipt = generateFullReceipt();
  assertEqual(receipt.verification.algorithm, "SHA-256");
  assertEqual(receipt.verification.chain_length, 5);
  assertEqual(receipt.verification.chain_order.length, 5);
  assertEqual(receipt.verification.chain_order[0], "intent_hash");
  assertEqual(receipt.verification.chain_order[4], "receipt_hash");
});

test("ingestion provenance is included when provided", () => {
  const receipt = generateFullReceipt({
    ingestion: {
      source: "api",
      channel: "POST /intent",
      source_message_id: "msg-123",
    },
  });
  assert(receipt.ingestion, "Must have ingestion");
  assertEqual(receipt.ingestion.source, "api");
  assertEqual(receipt.ingestion.channel, "POST /intent");
  assertEqual(receipt.ingestion.source_message_id, "msg-123");
  assert(receipt.ingestion.timestamp, "Must have ingestion timestamp");
});

test("ingestion is absent when not provided", () => {
  const receipt = generateFullReceipt();
  assert(!receipt.ingestion, "Must not have ingestion when not provided");
});

test("identity_binding is included when provided", () => {
  const receipt = generateFullReceipt({
    identity_binding: {
      signer_id: "human-root",
      public_key_hex: "a".repeat(64),
      signature_payload_hash: "b".repeat(64),
      verification_method: "ed25519-nacl",
      ed25519_signed: true,
    },
  });
  assert(receipt.identity_binding, "Must have identity_binding");
  assertEqual(receipt.identity_binding.ed25519_signed, true);
  assertEqual(receipt.identity_binding.signer_id, "human-root");
});

test("identity_binding is absent when not provided", () => {
  const receipt = generateFullReceipt();
  assert(!receipt.identity_binding, "Must not have identity_binding when not provided");
});

// ── Suite 4: Receipt Verification ────────────────────────────────────

suite("4. Receipt Verification");

test("valid receipt passes verification", () => {
  const receipt = generateFullReceipt();
  const result = verifyReceipt(receipt);
  assert(result.valid, `Expected valid, got: ${JSON.stringify(result)}`);
});

test("tampered receipt_id fails verification", () => {
  const receipt = generateFullReceipt();
  receipt.receipt_id = randomUUID(); // tamper
  const result = verifyReceipt(receipt);
  assert(!result.valid, "Tampered receipt must fail");
});

test("tampered timestamp fails verification", () => {
  const receipt = generateFullReceipt();
  receipt.timestamp = "2020-01-01T00:00:00.000Z"; // tamper
  const result = verifyReceipt(receipt);
  assert(!result.valid, "Tampered receipt must fail");
});

test("tampered intent_hash fails verification", () => {
  const receipt = generateFullReceipt();
  receipt.hash_chain.intent_hash = "f".repeat(64); // tamper
  const result = verifyReceipt(receipt);
  assert(!result.valid, "Tampered receipt must fail");
});

test("standalone verifier also validates correctly", () => {
  const receipt = generateFullReceipt();
  const result = standaloneVerifyReceipt(receipt);
  assert(result.valid, "Standalone verifier must agree");
  assertEqual(result.errors.length, 0);
});

test("standalone verifier detects tampering", () => {
  const receipt = generateFullReceipt();
  receipt.hash_chain.receipt_hash = "0".repeat(64); // tamper
  const result = standaloneVerifyReceipt(receipt);
  assert(!result.valid, "Must detect tampering");
  assert(result.errors.length > 0, "Must report errors");
});

test("batch verification works", () => {
  const receipts = [generateFullReceipt(), generateFullReceipt(), generateFullReceipt()];
  const result = verifyReceiptBatch(receipts);
  assertEqual(result.total, 3);
  assertEqual(result.valid, 3);
  assertEqual(result.invalid, 0);
  assert(result.all_valid);
});

test("batch verification detects mixed valid/invalid", () => {
  const good = generateFullReceipt();
  const bad = generateFullReceipt();
  bad.receipt_id = randomUUID(); // tamper
  const result = verifyReceiptBatch([good, bad]);
  assertEqual(result.total, 2);
  assertEqual(result.valid, 1);
  assertEqual(result.invalid, 1);
  assert(!result.all_valid);
});

// ── Suite 5: Ledger Hash Chain ───────────────────────────────────────

suite("5. Ledger Hash Chain");

test("genesis hash is 64 zeros", () => {
  assertEqual(GENESIS_HASH, "0".repeat(64));
  assertEqual(GENESIS_HASH.length, 64);
});

test("empty ledger has valid chain", () => {
  const ledger = createLedger();
  const result = ledger.verifyChain();
  assert(result.valid);
  assertEqual(result.entries_checked, 0);
});

test("single entry links to genesis hash", () => {
  const ledger = createLedger();
  const entry = ledger.append({
    intent_id: randomUUID(),
    action: "send_email",
    agent_id: "test-agent",
    status: "executed",
    detail: "Test entry",
  });
  assertEqual(entry.prev_hash, GENESIS_HASH);
  assert(/^[a-f0-9]{64}$/.test(entry.ledger_hash));
});

test("chain of 10 entries is valid", () => {
  const ledger = createLedger();
  for (let i = 0; i < 10; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: `action_${i}`,
      agent_id: "test-agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const result = ledger.verifyChain();
  assert(result.valid);
  assertEqual(result.entries_checked, 10);
});

test("each entry links to the previous entry", () => {
  const ledger = createLedger();
  const entries = [];
  for (let i = 0; i < 5; i++) {
    entries.push(
      ledger.append({
        intent_id: randomUUID(),
        action: "test",
        agent_id: "agent",
        status: "executed",
        detail: `Entry ${i}`,
      })
    );
  }
  for (let i = 1; i < entries.length; i++) {
    assertEqual(
      entries[i].prev_hash,
      entries[i - 1].ledger_hash,
      `Entry ${i} must link to entry ${i - 1}`
    );
  }
});

test("standalone chain verifier agrees with ledger verifier", () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: "test",
      agent_id: "agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const exported = ledger.export();
  const result = standaloneVerifyChain(exported);
  assert(result.valid);
  assertEqual(result.entries_checked, 5);
});

// ── Suite 6: Tamper Detection ────────────────────────────────────────

suite("6. Tamper Detection");

test("modifying an entry's detail breaks the chain", () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: "test",
      agent_id: "agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const exported = ledger.export();
  exported[2].detail = "TAMPERED"; // modify entry 2
  const result = standaloneVerifyChain(exported);
  assert(!result.valid, "Must detect tampering");
  assertEqual(result.first_invalid, 2);
});

test("modifying an entry's hash breaks the chain at that entry", () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: "test",
      agent_id: "agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const exported = ledger.export();
  exported[1].ledger_hash = "f".repeat(64); // tamper hash
  const result = standaloneVerifyChain(exported);
  assert(!result.valid);
  // Should fail at entry 1 (hash mismatch) or entry 2 (prev_hash mismatch)
  assert(result.first_invalid <= 2, `First invalid should be 1 or 2, got ${result.first_invalid}`);
});

test("inserting an entry breaks the chain", () => {
  const ledger = createLedger();
  for (let i = 0; i < 3; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: "test",
      agent_id: "agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const exported = ledger.export();
  // Insert a fake entry between 0 and 1
  const fake = { ...exported[0], entry_id: randomUUID(), detail: "FAKE" };
  exported.splice(1, 0, fake);
  const result = standaloneVerifyChain(exported);
  assert(!result.valid, "Must detect insertion");
});

test("deleting an entry breaks the chain", () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: "test",
      agent_id: "agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const exported = ledger.export();
  exported.splice(2, 1); // delete entry 2
  const result = standaloneVerifyChain(exported);
  assert(!result.valid, "Must detect deletion");
});

test("reordering entries breaks the chain", () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) {
    ledger.append({
      intent_id: randomUUID(),
      action: "test",
      agent_id: "agent",
      status: "executed",
      detail: `Entry ${i}`,
    });
  }
  const exported = ledger.export();
  // Swap entries 1 and 2
  [exported[1], exported[2]] = [exported[2], exported[1]];
  const result = standaloneVerifyChain(exported);
  assert(!result.valid, "Must detect reordering");
});

// ── Suite 7: Cross-Verification ──────────────────────────────────────

suite("7. Cross-Verification (Receipt ↔ Ledger)");

test("matching receipt and ledger entry pass cross-verification", () => {
  const receipt = generateFullReceipt();
  const ledgerEntry = {
    entry_id: randomUUID(),
    prev_hash: GENESIS_HASH,
    ledger_hash: "x".repeat(64),
    timestamp: new Date().toISOString(),
    intent_id: receipt.intent_id,
    action: receipt.action,
    agent_id: receipt.agent_id,
    status: "executed",
    detail: "Test",
    receipt_hash: receipt.hash_chain.receipt_hash,
    authorization_hash: receipt.hash_chain.authorization_hash,
    intent_hash: receipt.hash_chain.intent_hash,
  };
  const result = verifyReceiptAgainstLedger(receipt, ledgerEntry);
  assert(result.valid, `Expected valid cross-verification: ${JSON.stringify(result.errors)}`);
});

test("mismatched receipt_hash fails cross-verification", () => {
  const receipt = generateFullReceipt();
  const ledgerEntry = {
    entry_id: randomUUID(),
    intent_id: receipt.intent_id,
    receipt_hash: "0".repeat(64), // wrong hash
    intent_hash: receipt.hash_chain.intent_hash,
  };
  const result = verifyReceiptAgainstLedger(receipt, ledgerEntry);
  assert(!result.valid, "Must detect receipt_hash mismatch");
});

test("mismatched intent_id fails cross-verification", () => {
  const receipt = generateFullReceipt();
  const ledgerEntry = {
    entry_id: randomUUID(),
    intent_id: randomUUID(), // wrong intent
    receipt_hash: receipt.hash_chain.receipt_hash,
    intent_hash: receipt.hash_chain.intent_hash,
  };
  const result = verifyReceiptAgainstLedger(receipt, ledgerEntry);
  assert(!result.valid, "Must detect intent_id mismatch");
});

// ── Suite 8: Edge Cases ──────────────────────────────────────────────

suite("8. Edge Cases");

test("receipt with all v2.1 fields passes verification", () => {
  const receipt = generateFullReceipt({
    receipt_type: "onboard",
    ingestion: {
      source: "webhook",
      channel: "POST /api/onboard",
      source_message_id: "wh-456",
    },
    identity_binding: {
      signer_id: "human-root",
      public_key_hex: "a".repeat(64),
      signature_payload_hash: "b".repeat(64),
      verification_method: "ed25519-nacl",
      ed25519_signed: true,
    },
  });
  const result = verifyReceipt(receipt);
  assert(result.valid, "Full v2.1 receipt must pass");
});

test("v2.0 receipt (no ingestion, no identity_binding) passes verification", () => {
  const receipt = generateFullReceipt();
  // Simulate v2.0 by ensuring no v2.1 fields
  assert(!receipt.ingestion);
  assert(!receipt.identity_binding);
  const result = verifyReceipt(receipt);
  assert(result.valid, "v2.0 receipt must pass (backward compatible)");
});

test("ledger with receipt_hash links correctly", () => {
  const ledger = createLedger();
  const receipt = generateFullReceipt();
  const entry = ledger.append({
    intent_id: receipt.intent_id,
    action: receipt.action,
    agent_id: receipt.agent_id,
    status: "executed",
    detail: "Full pipeline",
    receipt_hash: receipt.hash_chain.receipt_hash,
    intent_hash: receipt.hash_chain.intent_hash,
  });
  assertEqual(entry.receipt_hash, receipt.hash_chain.receipt_hash);
});

test("empty array passes chain verification", () => {
  const result = standaloneVerifyChain([]);
  assert(result.valid);
  assertEqual(result.entries_checked, 0);
});

test("non-array input fails chain verification", () => {
  const result = standaloneVerifyChain("not an array");
  assert(!result.valid);
});

// ── Results ──────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(
  `${BOLD}Results: ${passedTests}/${totalTests} passed${RESET}` +
    (failedTests > 0 ? ` ${RED}(${failedTests} failed)${RESET}` : ` ${GREEN}(all pass)${RESET}`)
);
console.log(`${"─".repeat(60)}\n`);

if (failedTests > 0) {
  console.log(`${RED}${BOLD}CONFORMANCE: FAIL${RESET}`);
  console.log(`${DIM}Fix the failing tests to achieve conformance.${RESET}\n`);
  process.exit(1);
} else {
  console.log(`${GREEN}${BOLD}CONFORMANCE: PASS${RESET}`);
  console.log(`${DIM}This implementation conforms to the RIO Receipt Protocol specification.${RESET}\n`);
  process.exit(0);
}
