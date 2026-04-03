/**
 * RIO Receipt Protocol — Database Persistence Example
 *
 * This example shows how to persist receipts and ledger entries
 * to a relational database (PostgreSQL or SQLite).
 *
 * The receipt protocol generates in-memory receipts and ledger entries.
 * For production use, you need to persist them. This example provides
 * adapter patterns for common databases.
 *
 * Prerequisites:
 *   - For PostgreSQL: npm install pg
 *   - For SQLite: npm install better-sqlite3
 *
 * Usage:
 *   node examples/database_persistence_demo.mjs
 *
 * This demo runs without a real database — it shows the SQL schema
 * and adapter pattern you would use in production.
 */

import {
  hashIntent,
  hashExecution,
  generateReceipt,
  createLedger,
  generateKeyPair,
  signReceipt,
} from "../index.mjs";

// ═══════════════════════════════════════════════════════════
// 1. DATABASE SCHEMA (PostgreSQL)
// ═══════════════════════════════════════════════════════════

const POSTGRES_SCHEMA = `
-- Receipts table: stores the full receipt JSON and indexed fields
CREATE TABLE IF NOT EXISTS rio_receipts (
  receipt_id    TEXT PRIMARY KEY,
  receipt_hash  TEXT NOT NULL UNIQUE,
  intent_id     TEXT NOT NULL,
  action        TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  receipt_type  TEXT NOT NULL DEFAULT 'action',
  authorized_by TEXT,
  chain_length  INTEGER NOT NULL,
  signed        BOOLEAN NOT NULL DEFAULT FALSE,
  signer_id     TEXT,
  payload       JSONB NOT NULL,           -- full receipt JSON
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT idx_intent UNIQUE (intent_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_action ON rio_receipts(action);
CREATE INDEX IF NOT EXISTS idx_receipts_agent ON rio_receipts(agent_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON rio_receipts(created_at);

-- Ledger table: stores hash-chained entries
CREATE TABLE IF NOT EXISTS rio_ledger (
  entry_id    TEXT PRIMARY KEY,
  entry_type  TEXT NOT NULL,
  intent_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  status      TEXT NOT NULL,
  detail      TEXT,
  hash        TEXT NOT NULL UNIQUE,
  prev_hash   TEXT NOT NULL,
  receipt_hash TEXT,
  payload     JSONB NOT NULL,              -- full entry JSON
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_intent ON rio_ledger(intent_id);
CREATE INDEX IF NOT EXISTS idx_ledger_hash ON rio_ledger(hash);
`;

// ═══════════════════════════════════════════════════════════
// 2. DATABASE SCHEMA (SQLite)
// ═══════════════════════════════════════════════════════════

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS rio_receipts (
  receipt_id    TEXT PRIMARY KEY,
  receipt_hash  TEXT NOT NULL UNIQUE,
  intent_id     TEXT NOT NULL UNIQUE,
  action        TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  receipt_type  TEXT NOT NULL DEFAULT 'action',
  authorized_by TEXT,
  chain_length  INTEGER NOT NULL,
  signed        INTEGER NOT NULL DEFAULT 0,
  signer_id     TEXT,
  payload       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rio_ledger (
  entry_id    TEXT PRIMARY KEY,
  entry_type  TEXT NOT NULL,
  intent_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  status      TEXT NOT NULL,
  detail      TEXT,
  hash        TEXT NOT NULL UNIQUE,
  prev_hash   TEXT NOT NULL,
  receipt_hash TEXT,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// ═══════════════════════════════════════════════════════════
// 3. ADAPTER PATTERN
// ═══════════════════════════════════════════════════════════

/**
 * Database adapter for persisting RIO receipts and ledger entries.
 * Replace the db.query calls with your database driver.
 */
class RIODatabaseAdapter {
  constructor(db) {
    this.db = db; // Your database connection (pg.Pool, better-sqlite3, etc.)
  }

  /**
   * Save a receipt to the database.
   * Extracts indexed fields from the receipt for efficient querying.
   */
  async saveReceipt(receipt) {
    const signed = receipt.identity_binding?.ed25519_signed === true;
    const values = {
      receipt_id: receipt.receipt_id,
      receipt_hash: receipt.hash_chain.receipt_hash,
      intent_id: receipt.intent_id,
      action: receipt.action,
      agent_id: receipt.agent_id,
      receipt_type: receipt.type || "action",
      authorized_by: receipt.authorized_by || null,
      chain_length: receipt.verification.chain_length,
      signed,
      signer_id: receipt.identity_binding?.signer_id || null,
      payload: JSON.stringify(receipt),
    };

    // PostgreSQL example:
    // await this.db.query(
    //   `INSERT INTO rio_receipts (receipt_id, receipt_hash, intent_id, action, agent_id,
    //     receipt_type, authorized_by, chain_length, signed, signer_id, payload)
    //    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    //   Object.values(values)
    // );

    return values;
  }

  /**
   * Save a ledger entry to the database.
   */
  async saveLedgerEntry(entry) {
    const values = {
      entry_id: entry.entry_id,
      entry_type: entry.status,           // ledger entries use 'status' not 'entry_type'
      intent_id: entry.intent_id,
      action: entry.action,
      agent_id: entry.agent_id,
      status: entry.status,
      detail: entry.detail || null,
      hash: entry.ledger_hash,            // field is 'ledger_hash' not 'hash'
      prev_hash: entry.prev_hash,
      receipt_hash: entry.receipt_hash || null,
      payload: JSON.stringify(entry),
    };

    // PostgreSQL example:
    // await this.db.query(
    //   `INSERT INTO rio_ledger (entry_id, entry_type, intent_id, action, agent_id,
    //     status, detail, hash, prev_hash, receipt_hash, payload)
    //    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    //   Object.values(values)
    // );

    return values;
  }

  /**
   * Retrieve a receipt by receipt_id.
   */
  async getReceipt(receiptId) {
    // const result = await this.db.query(
    //   `SELECT payload FROM rio_receipts WHERE receipt_id = $1`, [receiptId]
    // );
    // return JSON.parse(result.rows[0].payload);
  }

  /**
   * Retrieve all ledger entries in order for chain verification.
   */
  async getLedgerEntries() {
    // const result = await this.db.query(
    //   `SELECT payload FROM rio_ledger ORDER BY created_at ASC`
    // );
    // return result.rows.map(r => JSON.parse(r.payload));
  }

  /**
   * Query receipts by action type.
   */
  async getReceiptsByAction(action) {
    // const result = await this.db.query(
    //   `SELECT payload FROM rio_receipts WHERE action = $1 ORDER BY created_at DESC`,
    //   [action]
    // );
    // return result.rows.map(r => JSON.parse(r.payload));
  }
}

// ═══════════════════════════════════════════════════════════
// 4. DEMO — Generate receipts and show what would be persisted
// ═══════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════");
console.log("  RIO Receipt Protocol — Database Persistence Demo");
console.log("═══════════════════════════════════════════════════════\n");

// Generate a receipt
const intentId = "i-db-demo-001";
const keys = generateKeyPair();

const intentHash = hashIntent({
  intent_id: intentId,
  action: "process_payment",
  agent_id: "payment-agent",
  parameters: { amount: 250.00, currency: "USD", vendor: "acme-corp" },
  timestamp: new Date().toISOString(),
});

const executionHash = hashExecution({
  intent_id: intentId,
  action: "process_payment",
  result: { transaction_id: "TXN-98765", status: "completed" },
  connector: "stripe-sdk",
  timestamp: new Date().toISOString(),
});

const receipt = generateReceipt({
  intent_hash: intentHash,
  execution_hash: executionHash,
  intent_id: intentId,
  action: "process_payment",
  agent_id: "payment-agent",
});

signReceipt(receipt, {
  privateKey: keys.privateKeyObj,
  publicKeyHex: keys.publicKeyHex,
  signerId: "payment-gateway",
});

// Create ledger and append
const ledger = createLedger();
ledger.append({
  intent_id: intentId,
  action: "process_payment",
  agent_id: "payment-agent",
  status: "executed",
  detail: "Payment processed: $250.00 USD to acme-corp",
  receipt_hash: receipt.hash_chain.receipt_hash,
});

// Show what would be persisted
const adapter = new RIODatabaseAdapter(null);
const receiptRow = await adapter.saveReceipt(receipt);
const entries = ledger.export();
const ledgerRow = await adapter.saveLedgerEntry(entries[0]);

console.log("1. PostgreSQL Schema:");
console.log("   (See POSTGRES_SCHEMA constant in this file)\n");

console.log("2. SQLite Schema:");
console.log("   (See SQLITE_SCHEMA constant in this file)\n");

console.log("3. Receipt row that would be inserted:");
console.log("   receipt_id:    ", receiptRow.receipt_id);
console.log("   receipt_hash:  ", receiptRow.receipt_hash.substring(0, 16) + "...");
console.log("   intent_id:     ", receiptRow.intent_id);
console.log("   action:        ", receiptRow.action);
console.log("   agent_id:      ", receiptRow.agent_id);
console.log("   receipt_type:  ", receiptRow.receipt_type);
console.log("   chain_length:  ", receiptRow.chain_length);
console.log("   signed:        ", receiptRow.signed);
console.log("   signer_id:     ", receiptRow.signer_id);
console.log("");

console.log("4. Ledger row that would be inserted:");
console.log("   entry_id:      ", ledgerRow.entry_id);
console.log("   entry_type:    ", ledgerRow.entry_type);
console.log("   intent_id:     ", ledgerRow.intent_id);
console.log("   hash:          ", ledgerRow.hash.substring(0, 16) + "...");
console.log("   prev_hash:     ", ledgerRow.prev_hash.substring(0, 16) + "...");
console.log("");

console.log("5. Key design decisions:");
console.log("   - Store full receipt JSON in 'payload' column for complete reconstruction");
console.log("   - Extract indexed fields (action, agent_id, etc.) for efficient queries");
console.log("   - Use UNIQUE constraint on receipt_hash to prevent duplicates");
console.log("   - Ledger entries ordered by created_at for chain verification");
console.log("   - The adapter pattern works with any SQL database");
console.log("");
console.log("═══════════════════════════════════════════════════════");
