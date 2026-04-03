/**
 * RIO Receipt Protocol — Key Rotation Example
 *
 * This example demonstrates how to rotate Ed25519 signing keys
 * while maintaining verifiability of receipts signed with old keys.
 *
 * Key rotation is essential for production deployments:
 *   - Limits exposure if a key is compromised
 *   - Meets compliance requirements for key lifecycle management
 *   - Enables multi-signer architectures
 *
 * The pattern: maintain a key registry that maps key IDs to public keys.
 * When verifying a receipt, look up the public key by the signer_id
 * in the receipt's identity_binding.
 *
 * Usage:
 *   node examples/key_rotation_demo.mjs
 */

import {
  hashIntent,
  hashExecution,
  generateReceipt,
  generateKeyPair,
  signReceipt,
  verifyReceiptStandalone,
} from "../index.mjs";

// ═══════════════════════════════════════════════════════════
// 1. KEY REGISTRY
// ═══════════════════════════════════════════════════════════

/**
 * A key registry maps signer IDs + key versions to public keys.
 * In production, this would be backed by a database or HSM.
 *
 * Schema:
 *   key_id       TEXT PRIMARY KEY,   -- e.g., "gateway-v1"
 *   signer_id    TEXT NOT NULL,      -- e.g., "gateway"
 *   public_key   TEXT NOT NULL,      -- hex-encoded Ed25519 public key
 *   created_at   TIMESTAMPTZ,
 *   revoked_at   TIMESTAMPTZ,        -- NULL if active
 *   status       TEXT DEFAULT 'active'  -- 'active' | 'rotated' | 'revoked'
 */
class KeyRegistry {
  constructor() {
    this.keys = new Map(); // keyId -> { signerId, publicKeyHex, status, createdAt, revokedAt }
  }

  /**
   * Register a new key pair. Returns the key ID.
   */
  register(signerId, publicKeyHex, version = 1) {
    const keyId = `${signerId}-v${version}`;
    this.keys.set(keyId, {
      signerId,
      publicKeyHex,
      status: "active",
      createdAt: new Date().toISOString(),
      revokedAt: null,
    });
    return keyId;
  }

  /**
   * Rotate a key: mark the old version as 'rotated' and register the new one.
   * The old key remains in the registry for verification of old receipts.
   */
  rotate(signerId, newPublicKeyHex, oldVersion, newVersion) {
    const oldKeyId = `${signerId}-v${oldVersion}`;
    const oldEntry = this.keys.get(oldKeyId);
    if (oldEntry) {
      oldEntry.status = "rotated";
      oldEntry.revokedAt = new Date().toISOString();
    }
    return this.register(signerId, newPublicKeyHex, newVersion);
  }

  /**
   * Revoke a key (e.g., if compromised). Receipts signed with revoked
   * keys should be flagged for review.
   */
  revoke(keyId) {
    const entry = this.keys.get(keyId);
    if (entry) {
      entry.status = "revoked";
      entry.revokedAt = new Date().toISOString();
    }
  }

  /**
   * Look up a public key by signer_id. Used during verification.
   * Searches all versions (active, rotated) — revoked keys return
   * with a warning flag.
   */
  lookupByPublicKey(publicKeyHex) {
    for (const [keyId, entry] of this.keys) {
      if (entry.publicKeyHex === publicKeyHex) {
        return { keyId, ...entry };
      }
    }
    return null;
  }

  /**
   * Get the currently active key for a signer.
   */
  getActiveKey(signerId) {
    for (const [keyId, entry] of this.keys) {
      if (entry.signerId === signerId && entry.status === "active") {
        return { keyId, ...entry };
      }
    }
    return null;
  }

  /**
   * List all keys for a signer (for audit purposes).
   */
  listKeys(signerId) {
    const result = [];
    for (const [keyId, entry] of this.keys) {
      if (entry.signerId === signerId) {
        result.push({ keyId, ...entry });
      }
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════
// 2. ENHANCED VERIFICATION WITH KEY REGISTRY
// ═══════════════════════════════════════════════════════════

/**
 * Verify a receipt and check the signing key's status in the registry.
 */
function verifyWithRegistry(receipt, registry) {
  // Step 1: Standard cryptographic verification
  const result = verifyReceiptStandalone(receipt);

  // Step 2: Check key status in registry
  const binding = receipt.identity_binding;
  if (!binding?.public_key_hex) {
    return { ...result, key_status: "unsigned", key_warning: null };
  }

  const keyEntry = registry.lookupByPublicKey(binding.public_key_hex);
  if (!keyEntry) {
    return {
      ...result,
      key_status: "unknown",
      key_warning: "Public key not found in registry — cannot confirm signer identity",
    };
  }

  if (keyEntry.status === "revoked") {
    return {
      ...result,
      key_status: "revoked",
      key_warning: `Key ${keyEntry.keyId} was revoked at ${keyEntry.revokedAt}. Receipt should be reviewed.`,
    };
  }

  return {
    ...result,
    key_status: keyEntry.status, // "active" or "rotated"
    key_id: keyEntry.keyId,
    key_warning: keyEntry.status === "rotated"
      ? `Key ${keyEntry.keyId} has been rotated. Receipt is valid but was signed with a previous key.`
      : null,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. DEMO
// ═══════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════");
console.log("  RIO Receipt Protocol — Key Rotation Demo");
console.log("═══════════════════════════════════════════════════════\n");

const registry = new KeyRegistry();

// --- Phase 1: Initial key ---
console.log("Phase 1: Generate initial key pair (v1)");
const keysV1 = generateKeyPair();
const keyIdV1 = registry.register("gateway", keysV1.publicKeyHex, 1);
console.log(`  Registered: ${keyIdV1}`);
console.log(`  Public key: ${keysV1.publicKeyHex.substring(0, 16)}...`);

// Sign a receipt with v1
function makeReceipt(intentId, action) {
  const intentHash = hashIntent({
    intent_id: intentId, action, agent_id: "demo-agent",
    parameters: { test: true }, timestamp: new Date().toISOString(),
  });
  const executionHash = hashExecution({
    intent_id: intentId, action, result: { ok: true },
    connector: "demo", timestamp: new Date().toISOString(),
  });
  return generateReceipt({
    intent_hash: intentHash, execution_hash: executionHash,
    intent_id: intentId, action, agent_id: "demo-agent",
  });
}

const receipt1 = makeReceipt("i-001", "send_email");
signReceipt(receipt1, {
  privateKey: keysV1.privateKeyObj,
  publicKeyHex: keysV1.publicKeyHex,
  signerId: "gateway",
});
console.log(`  Signed receipt: ${receipt1.receipt_id}`);

const v1Result = verifyWithRegistry(receipt1, registry);
console.log(`  Verification:   ${v1Result.valid ? "PASS" : "FAIL"}`);
console.log(`  Key status:     ${v1Result.key_status}`);
console.log(`  Key warning:    ${v1Result.key_warning || "none"}`);

// --- Phase 2: Rotate to v2 ---
console.log("\nPhase 2: Rotate to new key pair (v2)");
const keysV2 = generateKeyPair();
const keyIdV2 = registry.rotate("gateway", keysV2.publicKeyHex, 1, 2);
console.log(`  Registered: ${keyIdV2}`);
console.log(`  Old key (v1) status: ${registry.keys.get("gateway-v1").status}`);

// Sign a new receipt with v2
const receipt2 = makeReceipt("i-002", "delete_file");
signReceipt(receipt2, {
  privateKey: keysV2.privateKeyObj,
  publicKeyHex: keysV2.publicKeyHex,
  signerId: "gateway",
});
console.log(`  Signed receipt: ${receipt2.receipt_id}`);

const v2Result = verifyWithRegistry(receipt2, registry);
console.log(`  Verification:   ${v2Result.valid ? "PASS" : "FAIL"}`);
console.log(`  Key status:     ${v2Result.key_status}`);

// Verify the OLD receipt (signed with v1) — should still verify
console.log("\n  Re-verify old receipt (signed with v1):");
const oldResult = verifyWithRegistry(receipt1, registry);
console.log(`  Verification:   ${oldResult.valid ? "PASS" : "FAIL"}`);
console.log(`  Key status:     ${oldResult.key_status}`);
console.log(`  Key warning:    ${oldResult.key_warning || "none"}`);

// --- Phase 3: Revoke v1 (simulating compromise) ---
console.log("\nPhase 3: Revoke v1 (simulating key compromise)");
registry.revoke("gateway-v1");
console.log(`  Revoked: gateway-v1`);

const revokedResult = verifyWithRegistry(receipt1, registry);
console.log(`  Re-verify receipt signed with revoked key:`);
console.log(`  Verification:   ${revokedResult.valid ? "PASS" : "FAIL"} (crypto still valid)`);
console.log(`  Key status:     ${revokedResult.key_status}`);
console.log(`  Key warning:    ${revokedResult.key_warning}`);

// --- Summary ---
console.log("\nKey Registry State:");
const allKeys = registry.listKeys("gateway");
for (const k of allKeys) {
  console.log(`  ${k.keyId}: status=${k.status}, created=${k.createdAt.substring(0, 19)}, revoked=${k.revokedAt?.substring(0, 19) || "—"}`);
}

console.log("\nKey Takeaways:");
console.log("  1. Old receipts remain cryptographically valid after key rotation");
console.log("  2. The registry tracks key lifecycle (active → rotated → revoked)");
console.log("  3. Revoked keys flag receipts for review but don't invalidate the crypto");
console.log("  4. Verifiers should check BOTH crypto validity AND key status");
console.log("  5. Never delete old public keys — they're needed to verify old receipts");
console.log("\n═══════════════════════════════════════════════════════");
