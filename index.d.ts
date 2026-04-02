/**
 * RIO Receipt Protocol — TypeScript Declarations
 * @module rio-receipt-protocol
 * @version 2.2.0
 */

// ─── Core Types ─────────────────────────────────────────────────────

export interface HashChain {
  intent_hash: string;
  governance_hash: string | null;
  authorization_hash: string | null;
  execution_hash: string;
  receipt_hash: string;
}

export interface Verification {
  algorithm: "SHA-256";
  chain_length: 3 | 5;
  chain_order: string[];
}

export interface IngestionProvenance {
  source: string;
  channel: string;
  source_message_id: string | null;
  timestamp: string;
}

export interface IdentityBinding {
  signer_id: string | null;
  public_key_hex: string | null;
  signature_hex: string | null;
  signature_payload_hash: string | null;
  verification_method: string | null;
  ed25519_signed: boolean;
}

export interface Receipt {
  receipt_id: string;
  receipt_type: string;
  intent_id: string;
  action: string;
  agent_id: string;
  authorized_by: string | null;
  timestamp: string;
  hash_chain: HashChain;
  verification: Verification;
  ingestion?: IngestionProvenance;
  identity_binding?: IdentityBinding;
}

export interface VerificationResult {
  valid: boolean;
  computed_hash: string;
  stored_hash: string;
  receipt_id: string;
  receipt_type: string;
}

export interface StandaloneVerificationResult extends VerificationResult {
  chain_length: number;
  signature_valid: boolean | null;
  errors: string[];
}

export interface ChainVerificationResult {
  valid: boolean;
  entries_checked: number;
  first_invalid: number | null;
  reason?: string;
  chain_tip?: string;
}

export interface CrossVerificationResult {
  valid: boolean;
  receipt_id: string;
  entry_id: string;
  receipt_valid: boolean;
  cross_references_valid: boolean;
  errors: string[];
}

export interface BatchVerificationResult {
  total: number;
  valid: number;
  invalid: number;
  all_valid: boolean;
  results: StandaloneVerificationResult[];
}

export interface LedgerEntry {
  entry_id: string;
  prev_hash: string;
  ledger_hash: string;
  timestamp: string;
  intent_id: string;
  action: string;
  agent_id: string;
  status: string;
  detail: string;
  receipt_hash?: string;
  authorization_hash?: string;
  intent_hash?: string;
}

export interface Ledger {
  append(data: {
    intentId: string;
    action: string;
    agentId: string;
    status: string;
    detail: string;
    receiptHash?: string;
    authorizationHash?: string;
    intentHash?: string;
  }): LedgerEntry;
  verifyChain(): ChainVerificationResult;
  getEntries(limit?: number, offset?: number): LedgerEntry[];
  getEntriesByIntent(intentId: string): LedgerEntry[];
  getEntryCount(): number;
  getCurrentHash(): string;
  getLatestEntry(): LedgerEntry | null;
  export(): LedgerEntry[];
}

export interface GenerateReceiptData {
  intentHash: string;
  executionHash: string;
  governanceHash?: string;
  authorizationHash?: string;
  intentId: string;
  action: string;
  agentId: string;
  authorizedBy?: string;
  receiptType?: string;
  ingestion?: Partial<IngestionProvenance>;
  identity_binding?: Partial<IdentityBinding>;
}

// ─── Core Functions ─────────────────────────────────────────────────

export function sha256(data: string): string;

export function hashIntent(intent: {
  intent_id: string;
  action: string;
  agent_id: string;
  parameters: Record<string, unknown>;
  timestamp: string;
}): string;

export function hashExecution(execution: {
  intent_id: string;
  action: string;
  result: unknown;
  connector: string;
  timestamp: string;
}): string;

export function hashGovernance(governance: {
  intent_id: string;
  status: string;
  risk_level: string;
  requires_approval: boolean;
  checks: string[];
}): string;

export function hashAuthorization(authorization: {
  intent_id: string;
  decision: string;
  authorized_by: string;
  timestamp: string;
  conditions?: unknown;
}): string;

export function generateReceipt(data: GenerateReceiptData): Receipt;
export function verifyReceipt(receipt: Receipt): VerificationResult;

export interface KeyPair {
  privateKeyHex: string;
  publicKeyHex: string;
  privateKeyObj: object;
  publicKeyObj: object;
}

export function generateKeyPair(): KeyPair;
export function signReceipt(
  receipt: Receipt,
  options: { privateKey: object; publicKeyHex: string; signerId: string }
): Receipt;

// ─── Ledger ─────────────────────────────────────────────────────────

export const GENESIS_HASH: string;
export function createLedger(options?: { filePath?: string }): Ledger;

// ─── Standalone Verifier ────────────────────────────────────────────

export function verifyReceiptStandalone(receipt: Receipt): StandaloneVerificationResult;
export function verifyChain(entries: LedgerEntry[]): ChainVerificationResult;
export function verifyReceiptAgainstLedger(receipt: Receipt, ledgerEntry: LedgerEntry): CrossVerificationResult;
export function verifyReceiptBatch(receipts: Receipt[]): BatchVerificationResult;
