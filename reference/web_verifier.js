/**
 * RIO Receipt Protocol Web Verifier (JavaScript)
 * This script provides functions to verify RIO Receipts and their hash chains
 * using standard Web Crypto API for SHA-256 hashing.
 * It mirrors the logic of the Python verifier.py for language-agnostic proof.
 */

/**
 * Verifies the cryptographic signature of a single RIO Receipt.
 * (Placeholder for actual cryptographic verification logic)
 * @param {object} receipt - The RIO Receipt object.
 * @returns {boolean} - True if the signature is considered valid (or passes placeholder check), false otherwise.
 */
/**
 * Reconstructs the payload that was signed: id + action + agent_id + timestamp.
 * @param {object} receipt - The RIO Receipt object.
 * @returns {Uint8Array} - The payload as a Uint8Array.
 */
function canonicalizeForSigning(receipt) {
    const payloadStr = `${receipt.id}${receipt.action.type}${receipt.agent_id}${receipt.timestamp}`;
    return new TextEncoder().encode(payloadStr);
}

/**
 * Verifies the cryptographic signature of a single RIO Receipt using Ed25519 and Web Crypto API.
 * @param {object} receipt - The RIO Receipt object.
 * @returns {Promise<boolean>} - A promise that resolves with true if the signature is valid, false otherwise.
 */
async function verifyReceiptSignature(receipt) {
    const requiredFields = ['id', 'action', 'agent_id', 'timestamp', 'signature', 'public_key', 'verification_method'];
    if (!requiredFields.every(field => field in receipt)) {
        console.error("Error: Receipt missing one or more required fields for signature verification.");
        return false;
    }

    if (receipt.verification_method !== 'ed25519') {
        console.error(`Unsupported verification_method: ${receipt.verification_method}. This verifier supports 'ed25519' only.`);
        return false;
    }

    try {
        const signature = hexToUint8Array(receipt.signature);
        const publicKey = hexToUint8Array(receipt.public_key);

        const algorithm = { name: 'Ed25519' };
        const key = await crypto.subtle.importKey(
            'raw',
            publicKey,
            algorithm,
            true,
            ['verify']
        );

        const payload = canonicalizeForSigning(receipt);

        const isValid = await crypto.subtle.verify(
            algorithm,
            key,
            signature,
            payload
        );

        if (!isValid) {
            console.error(`Signature verification FAILED for receipt ID: ${receipt.id}`);
        }
        return isValid;
    } catch (e) {
        console.error(`An error occurred during signature verification: ${e}`);
        return false;
    }
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param {string} hexString - The hexadecimal string.
 * @returns {Uint8Array} - The converted Uint8Array.
 */
function hexToUint8Array(hexString) {
    const matches = hexString.match(/.{1,2}/g);
    if (!matches) {
        throw new Error('Invalid hex string');
    }
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

/**
 * Calculates the SHA-256 hash of a JSON object.
 * @param {object} data - The JSON object to hash.
 * @returns {Promise<string>} - A promise that resolves with the SHA-256 hash as a hexadecimal string.
 */
async function calculateHash(data) {
    // Ensure consistent JSON serialization for hashing
    const serializedData = JSON.stringify(data, Object.keys(data).sort());
    const textEncoder = new TextEncoder();
    const dataBuffer = textEncoder.encode(serializedData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hexHash;
}

/**
 * Verifies the SHA-256 hash chain of a list of ledger entries.
 * Each entry must contain 'hash' and 'previous_hash' fields.
 * @param {Array<object>} ledgerEntries - An array of ledger entry objects.
 * @returns {boolean} - True if the hash chain is valid, false otherwise.
 */
async function verifyHashChain(ledgerEntries) {
    if (!ledgerEntries || ledgerEntries.length === 0) {
        console.log("No ledger entries to verify.");
        return true;
    }

    for (let i = ledgerEntries.length - 1; i > 0; i--) {
        const currentEntry = ledgerEntries[i];
        const previousEntry = ledgerEntries[i - 1];

        if (!currentEntry.hash || !currentEntry.previous_hash) {
            console.error(`Error: Ledger entry ${i} missing 'hash' or 'previous_hash'.`);
            return false;
        }
        if (!previousEntry.hash) {
            console.error(`Error: Ledger entry ${i - 1} missing 'hash'.`);
            return false;
        }

        // Verify that the current entry's previous_hash matches the actual hash of the previous entry
        if (currentEntry.previous_hash !== previousEntry.hash) {
            console.error(`Hash chain broken at entry ${i}: current.previous_hash (${currentEntry.previous_hash}) != previous.hash (${previousEntry.hash})`);
            return false;
        }

        // Optionally, re-calculate the hash of the previous entry's content to ensure integrity
        // This would require the full content of the previous entry, not just its hash.
        // For this basic verifier, we're trusting the 'hash' field of the previous entry.
    }

    console.log("Hash chain verified successfully.");
    return true;
}

/**
 * Performs a full verification of a RIO Receipt and its ledger chain.
 * @param {object} receipt - The RIO Receipt object to verify.
 * @param {Array<object>} [ledgerEntries] - Optional array of ledger entry objects for hash chain verification.
 * @returns {Promise<boolean>} - A promise that resolves with true if verification passes, false otherwise.
 */
async function verifyRioReceipt(receipt, ledgerEntries = null) {
    console.log(`\n--- Verifying Receipt: ${receipt.id || 'N/A'} ---`);

    // 1. Verify individual receipt signature
    if (!(await verifyReceiptSignature(receipt))) {
        console.error("Receipt signature verification FAILED.");
        return false;
    }
    console.log("Receipt signature verification PASSED.");

    // 2. Verify hash chain if a ledger is provided
    if (ledgerEntries) {
        console.log("--- Verifying Ledger Chain ---");
        if (!Array.isArray(ledgerEntries)) {
            console.error("Error: Ledger entries must be an array.");
            return false;
        }

        // Find the receipt in the ledger to get its hash and previous_hash for chain verification
        // (This part might need adjustment based on how the ledger is structured and how receipts are linked)
        let receiptHashInLedger = null;
        for (const entry of ledgerEntries) {
            if (entry.id === receipt.id) {
                receiptHashInLedger = entry.hash;
                break;
            }
        }

        if (!receiptHashInLedger) {
            console.warn("Warning: Receipt not found in the provided ledger for full chain verification.");
            // Decide whether to fail or partially succeed if receipt is not in ledger
        }

        if (!(await verifyHashChain(ledgerEntries))) {
            console.error("Ledger hash chain verification FAILED.");
            return false;
        }
        console.log("Ledger hash chain verification PASSED.");
    } else {
        console.log("No ledger entries provided for hash chain verification.");
    }

    console.log(`--- Verification COMPLETE for ${receipt.id || 'N/A'} ---`);
    return true;
}

// Export functions for use in a browser environment or module system
// For direct use in <script> tags, these functions will be globally available.
// For module systems (e.g., ES Modules), uncomment the following:
// export { verifyReceiptSignature, calculateHash, verifyHashChain, verifyRioReceipt };
