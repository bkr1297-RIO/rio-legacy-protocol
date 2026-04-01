/**
 * RIO Receipt Protocol — Reference Implementation
 * Tamper-Evident Ledger (In-Memory with JSON File Persistence)
 *
 * This module provides a reference implementation of the RIO Ledger.
 * It stores entries in memory and persists to a JSON file on disk.
 * For production use, replace the storage backend with PostgreSQL
 * or another durable store that satisfies the spec requirements.
 *
 * Zero external dependencies beyond Node.js built-ins.
 *
 * @module rio-receipt-protocol/ledger
 * @version 1.0.0
 * @license MIT OR Apache-2.0
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * The genesis hash — the prev_hash for the first entry in any ledger.
 * 64 zero characters (SHA-256 representation of "nothing before this").
 */
export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Compute SHA-256 hash of a string.
 * @param {string} data
 * @returns {string} Lowercase hex-encoded SHA-256 hash
 */
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Create a new Ledger instance.
 *
 * @param {object} [options]
 * @param {string} [options.filePath] - Path to persist ledger as JSON. If omitted, ledger is in-memory only.
 * @returns {object} Ledger instance with append, verify, and query methods
 */
export function createLedger(options = {}) {
  let entries = [];
  let currentHash = GENESIS_HASH;
  const filePath = options.filePath || null;

  // Load from disk if file exists
  if (filePath && existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      entries = JSON.parse(raw);
      if (entries.length > 0) {
        currentHash = entries[entries.length - 1].ledger_hash;
      }
    } catch (err) {
      console.error(
        `[RIO Ledger] Failed to load from ${filePath}: ${err.message}. Starting fresh.`
      );
      entries = [];
      currentHash = GENESIS_HASH;
    }
  }

  /**
   * Persist the ledger to disk (if filePath is configured).
   */
  function persist() {
    if (!filePath) return;
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(entries, null, 2));
    } catch (err) {
      console.error(`[RIO Ledger] Failed to persist: ${err.message}`);
    }
  }

  /**
   * Build the canonical content string for hashing a ledger entry.
   * Field order MUST match the specification exactly.
   *
   * @param {object} entry
   * @returns {string} Canonical JSON string
   */
  function canonicalize(entry) {
    return JSON.stringify({
      entry_id: entry.entry_id,
      prev_hash: entry.prev_hash,
      timestamp: entry.timestamp,
      intent_id: entry.intent_id,
      action: entry.action,
      agent_id: entry.agent_id,
      status: entry.status,
      detail: entry.detail,
      receipt_hash: entry.receipt_hash || null,
      authorization_hash: entry.authorization_hash || null,
      intent_hash: entry.intent_hash || null,
    });
  }

  return {
    /**
     * Append an entry to the ledger.
     *
     * @param {object} data
     * @param {string} data.intent_id - The intent this entry relates to
     * @param {string} data.action - The action type
     * @param {string} data.agent_id - The agent that requested the action
     * @param {string} data.status - Entry status (submitted, governed, authorized, executed, denied, blocked)
     * @param {string} data.detail - Human-readable description
     * @param {string} [data.receipt_hash] - Hash of the associated receipt
     * @param {string} [data.authorization_hash] - Hash of the authorization record
     * @param {string} [data.intent_hash] - Hash of the original intent
     * @returns {object} The new ledger entry
     */
    append(data) {
      const prevHash = currentHash;
      const timestamp = new Date().toISOString();
      const entryId = randomUUID();

      const entry = {
        entry_id: entryId,
        prev_hash: prevHash,
        ledger_hash: null, // computed below
        timestamp,
        intent_id: data.intent_id,
        action: data.action,
        agent_id: data.agent_id,
        status: data.status,
        detail: data.detail,
        receipt_hash: data.receipt_hash || null,
        authorization_hash: data.authorization_hash || null,
        intent_hash: data.intent_hash || null,
      };

      entry.ledger_hash = sha256(canonicalize(entry));
      currentHash = entry.ledger_hash;
      entries.push(entry);
      persist();

      return entry;
    },

    /**
     * Verify the entire hash chain from genesis to the latest entry.
     *
     * @returns {object} { valid: boolean, entries_checked: number, first_invalid: number|null, reason?: string }
     */
    verifyChain() {
      if (entries.length === 0) {
        return { valid: true, entries_checked: 0, first_invalid: null };
      }

      let prev = GENESIS_HASH;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];

        // Check prev_hash linkage
        if (e.prev_hash !== prev) {
          return {
            valid: false,
            entries_checked: i + 1,
            first_invalid: i,
            reason: `Entry ${i} prev_hash mismatch. Expected: ${prev}, Got: ${e.prev_hash}`,
          };
        }

        // Recompute the hash
        const computed = sha256(canonicalize(e));
        if (computed !== e.ledger_hash) {
          return {
            valid: false,
            entries_checked: i + 1,
            first_invalid: i,
            reason: `Entry ${i} hash mismatch. Computed: ${computed}, Stored: ${e.ledger_hash}`,
          };
        }

        prev = e.ledger_hash;
      }

      return { valid: true, entries_checked: entries.length, first_invalid: null };
    },

    /**
     * Get entries with optional pagination.
     * @param {number} [limit=100]
     * @param {number} [offset=0]
     * @returns {Array} Ledger entries
     */
    getEntries(limit = 100, offset = 0) {
      return entries.slice(offset, offset + limit);
    },

    /**
     * Get all entries for a specific intent.
     * @param {string} intentId
     * @returns {Array}
     */
    getEntriesByIntent(intentId) {
      return entries.filter((e) => e.intent_id === intentId);
    },

    /**
     * Get the total number of entries.
     * @returns {number}
     */
    getEntryCount() {
      return entries.length;
    },

    /**
     * Get the current chain tip hash.
     * @returns {string}
     */
    getCurrentHash() {
      return currentHash;
    },

    /**
     * Get the most recent entry.
     * @returns {object|null}
     */
    getLatestEntry() {
      return entries.length > 0 ? entries[entries.length - 1] : null;
    },

    /**
     * Export the entire ledger as a JSON-serializable array.
     * Useful for backup, transfer, or external verification.
     * @returns {Array}
     */
    export() {
      return JSON.parse(JSON.stringify(entries));
    },
  };
}
