/**
 * RIO Receipt Protocol — REST API Server
 * Docker Quickstart
 *
 * A lightweight HTTP server that wraps the RIO Receipt Protocol
 * reference implementation as a REST API. Zero external dependencies
 * beyond Node.js built-ins and the rio-receipt-protocol package.
 *
 * Endpoints:
 *   POST /receipts        — Generate a receipt
 *   POST /receipts/verify — Verify a receipt
 *   POST /receipts/sign   — Sign a receipt with Ed25519
 *   POST /ledger          — Append an entry to the ledger
 *   POST /ledger/verify   — Verify the ledger hash chain
 *   GET  /health          — Health check
 *
 * @version 1.0.0
 * @license MIT OR Apache-2.0
 */

import { createServer } from "node:http";
import {
  sha256,
  hashIntent,
  hashExecution,
  hashGovernance,
  hashAuthorization,
  generateReceipt,
  verifyReceipt,
  generateKeyPair,
  signReceipt,
} from "rio-receipt-protocol";
import {
  verifyReceipt as verifyReceiptStandalone,
  verifyChain,
  verifyReceiptAgainstLedger,
  verifyReceiptBatch,
} from "rio-receipt-protocol/verifier";
import { createLedger } from "rio-receipt-protocol/ledger";

// ─── Configuration ──────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const LEDGER_FILE = process.env.LEDGER_FILE || "./data/ledger.json";

// ─── State ──────────────────────────────────────────────────────────

const ledger = createLedger({ filePath: LEDGER_FILE });

// Generate a server signing key pair on startup (or load from env)
let serverKeyPair;
if (process.env.ED25519_PRIVATE_KEY_HEX && process.env.ED25519_PUBLIC_KEY_HEX) {
  // Import existing key pair from environment
  const { createPrivateKey } = await import("node:crypto");
  const privBytes = Buffer.from(process.env.ED25519_PRIVATE_KEY_HEX, "hex");
  const pkcs8Header = Buffer.from("302e020100300506032b657004220420", "hex");
  const pkcs8Der = Buffer.concat([pkcs8Header, privBytes]);
  const privateKeyObj = createPrivateKey({ key: pkcs8Der, format: "der", type: "pkcs8" });

  serverKeyPair = {
    privateKeyHex: process.env.ED25519_PRIVATE_KEY_HEX,
    publicKeyHex: process.env.ED25519_PUBLIC_KEY_HEX,
    privateKeyObj: privateKeyObj,
  };
  console.log(`[RIO API] Loaded Ed25519 key pair from environment`);
  console.log(`[RIO API] Public key: ${serverKeyPair.publicKeyHex}`);
} else {
  serverKeyPair = generateKeyPair();
  console.log(`[RIO API] Generated ephemeral Ed25519 key pair`);
  console.log(`[RIO API] Public key: ${serverKeyPair.publicKeyHex}`);
  console.log(`[RIO API] ⚠  Set ED25519_PRIVATE_KEY_HEX and ED25519_PUBLIC_KEY_HEX in .env for persistent keys`);
}

// ─── Helpers ────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err.message}`));
      }
    });
    req.on("error", reject);
  });
}

function respond(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function respondError(res, status, message) {
  respond(res, status, { error: message });
}

// ─── Routes ─────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const { method, url } = req;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  try {
    // ── GET /health ──────────────────────────────────────────────
    if (method === "GET" && url === "/health") {
      return respond(res, 200, {
        status: "ok",
        service: "rio-receipt-protocol",
        version: "2.2.0",
        ledger_entries: ledger.getEntryCount(),
        chain_tip: ledger.getCurrentHash(),
        ed25519_public_key: serverKeyPair.publicKeyHex,
        timestamp: new Date().toISOString(),
      });
    }

    // ── POST /receipts ───────────────────────────────────────────
    if (method === "POST" && url === "/receipts") {
      const body = await readBody(req);

      // Validate required fields
      if (!body.intent || !body.execution) {
        return respondError(res, 400, "Missing required fields: intent and execution");
      }

      // Hash the intent and execution
      const intent = body.intent;
      const execution = body.execution;

      // Ensure required intent fields
      if (!intent.intent_id) intent.intent_id = crypto.randomUUID();
      if (!intent.timestamp) intent.timestamp = new Date().toISOString();
      if (!execution.intent_id) execution.intent_id = intent.intent_id;
      if (!execution.timestamp) execution.timestamp = new Date().toISOString();

      const intentHash = hashIntent(intent);
      const executionHash = hashExecution(execution);

      // Build receipt data
      const receiptData = {
        intent_hash: intentHash,
        execution_hash: executionHash,
        intent_id: intent.intent_id,
        action: intent.action || execution.action,
        agent_id: intent.agent_id || "unknown",
      };

      // Optional governance
      if (body.governance) {
        if (!body.governance.intent_id) body.governance.intent_id = intent.intent_id;
        receiptData.governance_hash = hashGovernance(body.governance);
      }

      // Optional authorization
      if (body.authorization) {
        if (!body.authorization.intent_id) body.authorization.intent_id = intent.intent_id;
        receiptData.authorization_hash = hashAuthorization(body.authorization);
        receiptData.authorized_by = body.authorization.authorized_by;
      }

      // Generate the receipt
      const receipt = generateReceipt(receiptData);

      // Auto-sign if requested
      if (body.sign !== false) {
        signReceipt(receipt, {
          privateKey: serverKeyPair.privateKeyObj,
          publicKeyHex: serverKeyPair.publicKeyHex,
          signerId: body.signer_id || "rio-api-server",
        });
      }

      // Auto-append to ledger if requested
      let ledgerEntry = null;
      if (body.append_to_ledger !== false) {
        ledgerEntry = ledger.append({
          intent_id: receipt.intent_id,
          action: receipt.action,
          agent_id: receipt.agent_id,
          status: "executed",
          detail: `Receipt ${receipt.receipt_id} generated via API`,
          receipt_hash: receipt.hash_chain.receipt_hash,
          intent_hash: receipt.hash_chain.intent_hash,
        });
      }

      return respond(res, 201, {
        receipt,
        ledger_entry: ledgerEntry,
        verification: verifyReceiptStandalone(receipt),
      });
    }

    // ── POST /receipts/verify ────────────────────────────────────
    if (method === "POST" && url === "/receipts/verify") {
      const body = await readBody(req);

      // Accept single receipt or array
      if (Array.isArray(body)) {
        const result = verifyReceiptBatch(body);
        return respond(res, 200, result);
      }

      if (!body.receipt_id || !body.hash_chain) {
        return respondError(res, 400, "Invalid receipt: missing receipt_id or hash_chain");
      }

      const result = verifyReceiptStandalone(body);
      return respond(res, 200, result);
    }

    // ── POST /receipts/sign ──────────────────────────────────────
    if (method === "POST" && url === "/receipts/sign") {
      const body = await readBody(req);

      if (!body.receipt_id || !body.hash_chain) {
        return respondError(res, 400, "Invalid receipt: missing receipt_id or hash_chain");
      }

      // Sign with the server's key pair
      signReceipt(body, {
        privateKey: serverKeyPair.privateKeyObj,
        publicKeyHex: serverKeyPair.publicKeyHex,
        signerId: body.signer_id || "rio-api-server",
      });

      return respond(res, 200, {
        receipt: body,
        signed: true,
        public_key_hex: serverKeyPair.publicKeyHex,
      });
    }

    // ── POST /ledger ─────────────────────────────────────────────
    if (method === "POST" && url === "/ledger") {
      const body = await readBody(req);

      if (!body.intent_id || !body.action || !body.agent_id || !body.status) {
        return respondError(
          res,
          400,
          "Missing required fields: intent_id, action, agent_id, status"
        );
      }

      const entry = ledger.append({
        intent_id: body.intent_id,
        action: body.action,
        agent_id: body.agent_id,
        status: body.status,
        detail: body.detail || "",
        receipt_hash: body.receipt_hash || null,
        authorization_hash: body.authorization_hash || null,
        intent_hash: body.intent_hash || null,
      });

      return respond(res, 201, {
        entry,
        ledger_size: ledger.getEntryCount(),
        chain_tip: ledger.getCurrentHash(),
      });
    }

    // ── POST /ledger/verify ──────────────────────────────────────
    if (method === "POST" && url === "/ledger/verify") {
      const entries = ledger.export();
      const result = verifyChain(entries);

      return respond(res, 200, {
        ...result,
        ledger_size: entries.length,
        chain_tip: ledger.getCurrentHash(),
      });
    }

    // ── 404 ──────────────────────────────────────────────────────
    respondError(res, 404, `Not found: ${method} ${url}`);
  } catch (err) {
    console.error(`[RIO API] Error handling ${method} ${url}:`, err);
    respondError(res, 500, err.message);
  }
}

// ─── Start Server ───────────────────────────────────────────────────

const server = createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  RIO Receipt Protocol — REST API Server                  ║
║  Version: 2.2.0                                          ║
║  Listening: http://${HOST}:${PORT}                         ║
║  Ledger: ${LEDGER_FILE.padEnd(46)}║
╚══════════════════════════════════════════════════════════╝

Endpoints:
  POST /receipts        — Generate a receipt (auto-signs, auto-ledgers)
  POST /receipts/verify — Verify a receipt (or batch)
  POST /receipts/sign   — Sign a receipt with Ed25519
  POST /ledger          — Append entry to ledger
  POST /ledger/verify   — Verify ledger hash chain
  GET  /health          — Health check + server info
`);
});
