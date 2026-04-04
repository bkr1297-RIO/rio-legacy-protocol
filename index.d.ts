/**
 * RIO Receipt Protocol — TypeScript Declarations
 * @module rio-receipt-protocol
 * @version 2.3.0
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

// ─── v2.3 Identity Types ──────────────────────────────────────────

export interface Delegation {
  delegation_id: string;
  delegate_id: string;
  delegate_actor_type: "human" | "ai_agent" | "service" | "system" | "external";
  scope: string[];
  risk_ceiling: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  delegated_at: string;
  expires_at: string | null;
}

export interface IdentityBinding {
  signer_id: string | null;
  public_key_hex: string | null;
  signature_hex: string | null;
  signature_payload_hash: string | null;
  verification_method: string | null;
  ed25519_signed: boolean;
  /** v2.3: Role the signer was exercising (e.g., 'approver', 'operator', 'auditor') */
  role_exercised?: string | null;
  /** v2.3: Type of actor that signed this receipt */
  actor_type?: "human" | "ai_agent" | "service" | "system" | "external" | null;
  /** v2.3: Signing key version number for rotation support */
  key_version?: number | null;
  /** v2.3: Delegation grant details when acting on behalf of another */
  delegation?: Delegation | null;
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
    intent_id: string;
    action: string;
    agent_id: string;
    status: string;
    detail: string;
    receipt_hash?: string;
    authorization_hash?: string;
    intent_hash?: string;
  }): LedgerEntry;
  verifyChain(): ChainVerificationResult;
  getEntries(limit?: number, offset?: number): LedgerEntry[];
  getEntriesByIntent(intent_id: string): LedgerEntry[];
  getEntryCount(): number;
  getCurrentHash(): string;
  getLatestEntry(): LedgerEntry | null;
  export(): LedgerEntry[];
}

export interface GenerateReceiptData {
  intent_hash: string;
  execution_hash: string;
  governance_hash?: string;
  authorization_hash?: string;
  intent_id: string;
  action: string;
  agent_id: string;
  authorized_by?: string;
  receipt_type?: string;
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
  options: {
    privateKey: object;
    publicKeyHex: string;
    signerId: string;
    /** v2.3: role the signer is exercising */
    roleExercised?: string;
    /** v2.3: type of actor */
    actorType?: "human" | "ai_agent" | "service" | "system" | "external";
    /** v2.3: signing key version number */
    keyVersion?: number;
    /** v2.3: delegation grant details */
    delegation?: Delegation;
  }
): Receipt;

// ─── Ledger ─────────────────────────────────────────────────────────

export const GENESIS_HASH: string;
export function createLedger(options?: { filePath?: string }): Ledger;

// ─── Standalone Verifier ────────────────────────────────────────────

export function verifyReceiptStandalone(receipt: Receipt): StandaloneVerificationResult;
export function verifyChain(entries: LedgerEntry[]): ChainVerificationResult;
export function verifyReceiptAgainstLedger(receipt: Receipt, ledgerEntry: LedgerEntry): CrossVerificationResult;
export function verifyReceiptBatch(receipts: Receipt[]): BatchVerificationResult;
