# RIO Receipt Protocol — Integration Guide

This guide demonstrates how to integrate the RIO Receipt Protocol with popular AI frameworks. Every example follows the same pattern: capture the intent before calling the AI, capture the execution result after, and generate a tamper-evident receipt that links the two.

The receipt protocol is framework-agnostic. It does not wrap or modify your AI calls — it records what happened, cryptographically, so that any party can independently verify the action trail later.

---

## Table of Contents

1. [Core Pattern](#core-pattern)
2. [OpenAI Integration (Node.js)](#openai-integration-nodejs)
3. [OpenAI Integration (Python)](#openai-integration-python)
4. [Anthropic Claude Integration (Node.js)](#anthropic-claude-integration-nodejs)
5. [Anthropic Claude Integration (Python)](#anthropic-claude-integration-python)
6. [LangChain Integration (Python)](#langchain-integration-python)
7. [LangChain Integration (Node.js)](#langchain-integration-nodejs)
8. [Multi-Agent Systems](#multi-agent-systems)
9. [Governed Receipts (Human-in-the-Loop)](#governed-receipts-human-in-the-loop)
10. [Verifying Receipts](#verifying-receipts)

---

## Core Pattern

Every integration follows four steps:

```
1. BEFORE the action  →  hash the intent (what was requested)
2. AFTER  the action  →  hash the execution (what actually happened)
3. ALWAYS             →  generate a receipt linking both hashes
4. OPTIONALLY         →  sign the receipt with Ed25519 for non-repudiation
```

The receipt's `hash_chain` is the cryptographic proof. The `receipt_hash` is computed from the intent and execution hashes, so tampering with any field invalidates the chain. Optional governance and authorization hashes extend this to a 5-hash chain for human-approval workflows.

### Adding Ed25519 Signatures

Signing is optional but recommended for production deployments. It binds the receipt to a specific signer, providing non-repudiation.

**Node.js:**

```javascript
import { generateKeyPair, signReceipt } from "rio-receipt-protocol";

// Generate a key pair once (store the private key securely)
const keys = generateKeyPair();

// After generating a receipt, sign it
signReceipt(receipt, { privateKey: keys.privateKeyObj, publicKeyHex: keys.publicKeyHex, signerId: "my-gateway" });
// receipt.identity_binding now contains:
//   signature_hex, public_key_hex, signer_id, signed_at,
//   verification_method: "ed25519-nacl", ed25519_signed: true
```

**Python:**

```python
from rio_receipt_protocol import generate_keypair, sign_receipt

# Generate a key pair once (store the private key securely)
public_key, private_key = generate_keypair()

# After generating a receipt, sign it
signed_receipt = sign_receipt(receipt, private_key, "my-gateway")
# signed_receipt["identity_binding"] now contains the signature
```

The verifier automatically checks Ed25519 signatures when present — no extra verification code needed.

---

## OpenAI Integration (Node.js)

```javascript
import OpenAI from "openai";
import { hashIntent, hashExecution, generateReceipt, verifyReceipt, generateKeyPair, signReceipt } from "rio-receipt-protocol";

const openai = new OpenAI();
const keys = generateKeyPair(); // Generate once, store securely

async function governedCompletion(prompt, agentId = "openai-agent") {
  const intentId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // 1. Hash the intent BEFORE calling OpenAI
  const intentHash = hashIntent({
    intent_id: intentId,
    action: "chat_completion",
    agent_id: agentId,
    parameters: { model: "gpt-4o", prompt },
    timestamp,
  });

  // 2. Call OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  // 3. Hash the execution AFTER the call returns
  const executionHash = hashExecution({
    intent_id: intentId,
    action: "chat_completion",
    result: { id: completion.id, model: completion.model, usage: completion.usage },
    connector: "openai-sdk",
    timestamp: new Date().toISOString(),
  });

  // 4. Generate the receipt
  const receipt = generateReceipt({
    intent_hash: intentHash,
    execution_hash: executionHash,
    intent_id: intentId,
    action: "chat_completion",
    agent_id: agentId,
  });

  // 5. Sign the receipt
  signReceipt(receipt, { privateKey: keys.privateKeyObj, publicKeyHex: keys.publicKeyHex, signerId: "openai-gateway" });

  // 6. Verify (includes signature check)
  const result = verifyReceipt(receipt);
  console.log("Receipt valid:", result.valid);

  return { completion, receipt };
}
```

---

## OpenAI Integration (Python)

```python
from openai import OpenAI
from rio_receipt_protocol import hash_intent, hash_execution, generate_receipt, verify_receipt
import uuid
from datetime import datetime, timezone

client = OpenAI()

def governed_completion(prompt: str, agent_id: str = "openai-agent"):
    intent_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    # 1. Hash the intent
    intent_hash = hash_intent(
        intent_id=intent_id,
        action="chat_completion",
        agent_id=agent_id,
        parameters={"model": "gpt-4o", "prompt": prompt},
        timestamp=timestamp,
    )

    # 2. Call OpenAI
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )

    # 3. Hash the execution
    execution_hash = hash_execution(
        intent_id=intent_id,
        action="chat_completion",
        result={"id": completion.id, "model": completion.model},
        connector="openai-sdk",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    # 4. Generate and verify the receipt
    receipt = generate_receipt(
        intent_hash=intent_hash,
        execution_hash=execution_hash,
        intent_id=intent_id,
        action="chat_completion",
        agent_id=agent_id,
    )
    result = verify_receipt(receipt)
    assert result["valid"], "Receipt verification failed"

    return completion, receipt
```

---

## Anthropic Claude Integration (Node.js)

```javascript
import Anthropic from "@anthropic-ai/sdk";
import { hashIntent, hashExecution, generateReceipt, verifyReceipt } from "rio-receipt-protocol";

const anthropic = new Anthropic();

async function governedMessage(prompt, agentId = "claude-agent") {
  const intentId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // 1. Hash the intent
  const intentHash = hashIntent({
    intent_id: intentId,
    action: "message_create",
    agent_id: agentId,
    parameters: { model: "claude-sonnet-4-20250514", prompt },
    timestamp,
  });

  // 2. Call Anthropic
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  // 3. Hash the execution
  const executionHash = hashExecution({
    intent_id: intentId,
    action: "message_create",
    result: { id: message.id, model: message.model, usage: message.usage, stop_reason: message.stop_reason },
    connector: "anthropic-sdk",
    timestamp: new Date().toISOString(),
  });

  // 4. Generate the receipt
  const receipt = generateReceipt({
    intent_hash: intentHash,
    execution_hash: executionHash,
    intent_id: intentId,
    action: "message_create",
    agent_id: agentId,
  });

  const result = verifyReceipt(receipt);
  console.log("Receipt valid:", result.valid);

  return { message, receipt };
}
```

---

## Anthropic Claude Integration (Python)

```python
import anthropic
from rio_receipt_protocol import hash_intent, hash_execution, generate_receipt, verify_receipt
import uuid
from datetime import datetime, timezone

client = anthropic.Anthropic()

def governed_message(prompt: str, agent_id: str = "claude-agent"):
    intent_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    intent_hash = hash_intent(
        intent_id=intent_id,
        action="message_create",
        agent_id=agent_id,
        parameters={"model": "claude-sonnet-4-20250514", "prompt": prompt},
        timestamp=timestamp,
    )

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    execution_hash = hash_execution(
        intent_id=intent_id,
        action="message_create",
        result={"id": message.id, "model": message.model, "stop_reason": message.stop_reason},
        connector="anthropic-sdk",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    receipt = generate_receipt(
        intent_hash=intent_hash,
        execution_hash=execution_hash,
        intent_id=intent_id,
        action="message_create",
        agent_id=agent_id,
    )
    assert verify_receipt(receipt)["valid"]

    return message, receipt
```

---

## LangChain Integration (Python)

RIO integrates with LangChain as a callback handler, automatically generating receipts for every LLM call in a chain or agent.

```python
from langchain_openai import ChatOpenAI
from langchain_core.callbacks import BaseCallbackHandler
from rio_receipt_protocol import hash_intent, hash_execution, generate_receipt, verify_receipt, create_ledger
import uuid
from datetime import datetime, timezone


class RIOCallbackHandler(BaseCallbackHandler):
    """LangChain callback that generates RIO receipts for every LLM call."""

    def __init__(self, agent_id: str = "langchain-agent", ledger=None):
        self.agent_id = agent_id
        self.ledger = ledger or create_ledger()
        self._pending = {}  # run_id -> intent data

    def on_llm_start(self, serialized, prompts, *, run_id, **kwargs):
        """Capture intent before the LLM call."""
        intent_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        model = serialized.get("kwargs", {}).get("model_name", "unknown")

        intent_hash = hash_intent(
            intent_id=intent_id,
            action="llm_call",
            agent_id=self.agent_id,
            parameters={"model": model, "prompts": prompts},
            timestamp=timestamp,
        )

        self._pending[str(run_id)] = {
            "intent_id": intent_id,
            "intent_hash": intent_hash,
            "model": model,
        }

    def on_llm_end(self, response, *, run_id, **kwargs):
        """Capture execution and generate receipt after the LLM call."""
        pending = self._pending.pop(str(run_id), None)
        if not pending:
            return

        execution_hash = hash_execution(
            intent_id=pending["intent_id"],
            action="llm_call",
            result={"generations": len(response.generations), "model": pending["model"]},
            connector="langchain",
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        receipt = generate_receipt(
            intent_hash=pending["intent_hash"],
            execution_hash=execution_hash,
            intent_id=pending["intent_id"],
            action="llm_call",
            agent_id=self.agent_id,
        )

        result = verify_receipt(receipt)
        self.ledger.append(
            intent_id=pending["intent_id"],
            action="llm_call",
            agent_id=self.agent_id,
            status="executed" if result["valid"] else "failed",
            detail=f"LangChain LLM call ({pending['model']})",
            receipt_hash=receipt["hash_chain"]["receipt_hash"],
        )


# Usage
rio = RIOCallbackHandler(agent_id="my-langchain-agent")
llm = ChatOpenAI(model="gpt-4o", callbacks=[rio])

response = llm.invoke("What is the capital of France?")

# Every LLM call now has a receipt in the ledger
chain_result = rio.ledger.verify_chain()
print(f"Ledger entries: {rio.ledger.get_entry_count()}, Chain valid: {chain_result['valid']}")
```

---

## LangChain Integration (Node.js)

```javascript
import { ChatOpenAI } from "@langchain/openai";
import { hashIntent, hashExecution, generateReceipt, verifyReceipt, createLedger } from "rio-receipt-protocol";

const ledger = createLedger();

// Wrap any LangChain call with receipt generation
async function trackedInvoke(llm, prompt, agentId = "langchain-agent") {
  const intentId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const intentHash = hashIntent({
    intent_id: intentId,
    action: "llm_call",
    agent_id: agentId,
    parameters: { model: llm.modelName, prompt },
    timestamp,
  });

  const response = await llm.invoke(prompt);

  const executionHash = hashExecution({
    intent_id: intentId,
    action: "llm_call",
    result: { content_length: response.content.length },
    connector: "langchain",
    timestamp: new Date().toISOString(),
  });

  const receipt = generateReceipt({
    intent_hash: intentHash,
    execution_hash: executionHash,
    intent_id: intentId,
    action: "llm_call",
    agent_id: agentId,
  });

  ledger.append({
    intent_id: intentId,
    action: "llm_call",
    agent_id: agentId,
    status: "executed",
    detail: `LangChain call (${llm.modelName})`,
    receipt_hash: receipt.hash_chain.receipt_hash,
  });

  return { response, receipt };
}

const llm = new ChatOpenAI({ modelName: "gpt-4o" });
const { response, receipt } = await trackedInvoke(llm, "What is the capital of France?");
console.log("Chain valid:", ledger.verifyChain().valid);
```

---

## Multi-Agent Systems

When multiple agents collaborate, each agent generates its own receipts. The shared ledger provides a unified audit trail.

```javascript
import { hashIntent, hashExecution, generateReceipt, createLedger } from "rio-receipt-protocol";

const ledger = createLedger();

// Agent A: Research agent
async function researchAgent(query) {
  const intentId = crypto.randomUUID();

  const intentHash = hashIntent({
    intent_id: intentId,
    action: "web_search",
    agent_id: "agent-research",
    parameters: { query },
    timestamp: new Date().toISOString(),
  });

  const results = await searchWeb(query); // your search function

  const executionHash = hashExecution({
    intent_id: intentId,
    action: "web_search",
    result: { result_count: results.length },
    connector: "search-api",
    timestamp: new Date().toISOString(),
  });

  const receipt = generateReceipt({
    intent_hash: intentHash,
    execution_hash: executionHash,
    intent_id: intentId,
    action: "web_search",
    agent_id: "agent-research",
  });

  ledger.append({
    intent_id: intentId,
    action: "web_search",
    agent_id: "agent-research",
    status: "executed",
    detail: `Search: ${query}`,
    receipt_hash: receipt.hash_chain.receipt_hash,
  });

  return { results, receipt };
}

// Agent B: Writing agent (uses research results)
async function writingAgent(topic, sources) {
  const intentId = crypto.randomUUID();

  const intentHash = hashIntent({
    intent_id: intentId,
    action: "generate_text",
    agent_id: "agent-writer",
    parameters: { topic, source_count: sources.length },
    timestamp: new Date().toISOString(),
  });

  const article = await generateArticle(topic, sources); // your LLM call

  const executionHash = hashExecution({
    intent_id: intentId,
    action: "generate_text",
    result: { word_count: article.split(" ").length },
    connector: "openai-sdk",
    timestamp: new Date().toISOString(),
  });

  const receipt = generateReceipt({
    intent_hash: intentHash,
    execution_hash: executionHash,
    intent_id: intentId,
    action: "generate_text",
    agent_id: "agent-writer",
  });

  ledger.append({
    intent_id: intentId,
    action: "generate_text",
    agent_id: "agent-writer",
    status: "executed",
    detail: `Article: ${topic}`,
    receipt_hash: receipt.hash_chain.receipt_hash,
  });

  return { article, receipt };
}

// Both agents share the same ledger — full audit trail
const research = await researchAgent("quantum computing breakthroughs 2026");
const article = await writingAgent("Quantum Computing in 2026", research.results);

console.log("Total actions recorded:", ledger.getEntryCount());
console.log("Chain valid:", ledger.verifyChain().valid);
```

---

## Governed Receipts (Human-in-the-Loop)

For high-risk actions, extend the proof-layer receipt with governance and authorization hashes. This creates a 5-hash chain that cryptographically proves a human reviewed and approved the action.

```python
from rio_receipt_protocol import (
    hash_intent, hash_execution, hash_governance, hash_authorization,
    generate_receipt, verify_receipt, create_ledger,
)
import uuid
from datetime import datetime, timezone

ledger = create_ledger()

def governed_action(action_type: str, parameters: dict, agent_id: str):
    intent_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # 1. Hash the intent
    intent_hash = hash_intent(
        intent_id=intent_id, action=action_type, agent_id=agent_id,
        parameters=parameters, timestamp=now,
    )

    # 2. Governance evaluation (your policy engine)
    governance_hash = hash_governance(
        intent_id=intent_id,
        status="requires_approval",
        risk_level="high",
        requires_approval=True,
        checks=["policy_check", "rate_limit", "cost_threshold"],
    )

    # 3. Human approval (your approval UI/workflow)
    approval = get_human_approval(intent_id)  # your function
    authorization_hash = hash_authorization(
        intent_id=intent_id,
        decision="approved",
        authorized_by=f"HUMAN:{approval.email}",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    # 4. Execute the action
    result = execute_action(action_type, parameters)  # your function

    # 5. Hash the execution
    execution_hash = hash_execution(
        intent_id=intent_id, action=action_type,
        result=result, connector="internal",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    # 6. Generate a GOVERNED receipt (5-hash chain)
    receipt = generate_receipt(
        intent_hash=intent_hash,
        execution_hash=execution_hash,
        governance_hash=governance_hash,
        authorization_hash=authorization_hash,
        intent_id=intent_id,
        action=action_type,
        agent_id=agent_id,
        authorized_by=f"HUMAN:{approval.email}",
    )

    # The receipt now has chain_length: 5
    assert receipt["verification"]["chain_length"] == 5
    assert verify_receipt(receipt)["valid"]

    # 7. Record in the ledger
    ledger.append(
        intent_id=intent_id, action=action_type, agent_id=agent_id,
        status="executed", detail=f"Governed: {action_type}",
        receipt_hash=receipt["hash_chain"]["receipt_hash"],
        authorization_hash=receipt["hash_chain"]["authorization_hash"],
        intent_hash=receipt["hash_chain"]["intent_hash"],
    )

    return receipt
```

---

## Verifying Receipts

Any party can independently verify receipts and ledger chains without access to the original system.

```javascript
// Node.js — Standalone verification
import { verifyReceiptStandalone, verifyChain, verifyReceiptBatch } from "rio-receipt-protocol";
import { readFileSync } from "fs";

// Verify a single receipt
const receipt = JSON.parse(readFileSync("receipt.json", "utf-8"));
const result = verifyReceiptStandalone(receipt);
console.log(result.valid ? "PASS" : "FAIL", result);

// Verify a ledger chain
const ledger = JSON.parse(readFileSync("ledger.json", "utf-8"));
const chain = verifyChain(ledger);
console.log(chain.valid ? "CHAIN INTACT" : "CHAIN BROKEN", chain);

// Batch verify
const receipts = JSON.parse(readFileSync("receipts.json", "utf-8"));
const batch = verifyReceiptBatch(receipts);
console.log(`${batch.valid}/${batch.total} valid`);
```

```python
# Python — Standalone verification
from rio_receipt_protocol import verify_receipt_standalone, verify_chain, verify_receipt_batch
import json

with open("receipt.json") as f:
    receipt = json.load(f)

result = verify_receipt_standalone(receipt)
print("PASS" if result["valid"] else "FAIL", result)

with open("ledger.json") as f:
    entries = json.load(f)

chain = verify_chain(entries)
print("CHAIN INTACT" if chain["valid"] else "CHAIN BROKEN")
```

---

## What's Next

The RIO Receipt Protocol is the proof layer. It answers one question: **"Can you prove what happened?"**

The protocol does not enforce policy, manage permissions, or control execution. Those are responsibilities of the governance system built on top of it. The receipt is the evidence — the ledger is the record — and together they make AI actions independently verifiable.

For the full specification, see [`spec/receipt-schema.json`](../spec/receipt-schema.json) and [`spec/signing-rules.md`](../spec/signing-rules.md).
