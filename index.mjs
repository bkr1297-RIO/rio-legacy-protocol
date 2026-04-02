/**
 * RIO Receipt Protocol — Package Entry Point
 *
 * Unified exports for the RIO Receipt Protocol.
 * Import from "rio-receipt-protocol" to get everything,
 * or from specific subpaths for tree-shaking.
 *
 * @module rio-receipt-protocol
 * @version 2.2.0
 * @license MIT OR Apache-2.0
 */

// ─── Core: Receipt Generation & Verification ───────────────────────
export {
  sha256,
  hashIntent,
  hashExecution,
  hashGovernance,
  hashAuthorization,
  generateReceipt,
  verifyReceipt,
} from "./reference/receipts.mjs";

// ─── Ledger ─────────────────────────────────────────────────────────
export { GENESIS_HASH, createLedger } from "./reference/ledger.mjs";

// ─── Standalone Verifier ────────────────────────────────────────────
export {
  verifyReceipt as verifyReceiptStandalone,
  verifyChain,
  verifyReceiptAgainstLedger,
  verifyReceiptBatch,
} from "./reference/verifier.mjs";
