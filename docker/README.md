# RIO Receipt Protocol — Docker Quickstart

Run the RIO Receipt Protocol as a REST API server in Docker. Zero configuration required.

## Quick Start

```bash
cd docker
docker compose up -d
```

The API server starts on `http://localhost:3000`. Verify it's running:

```bash
curl http://localhost:3000/health
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/receipts` | Generate a receipt (auto-signs, auto-appends to ledger) |
| `POST` | `/receipts/verify` | Verify a receipt or batch of receipts |
| `POST` | `/receipts/sign` | Sign a receipt with Ed25519 |
| `POST` | `/ledger` | Append an entry to the ledger |
| `POST` | `/ledger/verify` | Verify the ledger hash chain |
| `GET` | `/health` | Health check and server info |

## Examples

### Generate a Receipt

```bash
curl -X POST http://localhost:3000/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "action": "SEND_EMAIL",
      "agent_id": "bondi-ai",
      "parameters": { "to": "user@example.com", "subject": "Hello" }
    },
    "execution": {
      "action": "SEND_EMAIL",
      "result": "sent",
      "connector": "gmail"
    }
  }'
```

The response includes the receipt, its ledger entry, and verification result:

```json
{
  "receipt": {
    "receipt_id": "...",
    "receipt_type": "action",
    "action": "SEND_EMAIL",
    "hash_chain": {
      "intent_hash": "...",
      "execution_hash": "...",
      "receipt_hash": "..."
    },
    "identity_binding": {
      "ed25519_signed": true,
      "signature_hex": "..."
    }
  },
  "ledger_entry": { ... },
  "verification": { "valid": true }
}
```

### Generate a Governed Receipt

Include `governance` and `authorization` for the full 5-hash chain:

```bash
curl -X POST http://localhost:3000/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "action": "TRANSFER_MONEY",
      "agent_id": "bondi-ai",
      "parameters": { "amount": 500, "to": "vendor-account" }
    },
    "governance": {
      "status": "approved",
      "risk_level": "HIGH",
      "requires_approval": true,
      "checks": ["amount_limit", "recipient_verified"]
    },
    "authorization": {
      "decision": "approved",
      "authorized_by": "brian@rio.dev"
    },
    "execution": {
      "action": "TRANSFER_MONEY",
      "result": "completed",
      "connector": "stripe"
    }
  }'
```

### Verify a Receipt

```bash
curl -X POST http://localhost:3000/receipts/verify \
  -H "Content-Type: application/json" \
  -d '<paste receipt JSON here>'
```

### Verify the Ledger

```bash
curl -X POST http://localhost:3000/ledger/verify
```

### Append a Ledger Entry

```bash
curl -X POST http://localhost:3000/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "intent_id": "abc-123",
    "action": "SEND_EMAIL",
    "agent_id": "bondi-ai",
    "status": "executed",
    "detail": "Email sent to user@example.com"
  }'
```

## Configuration

Copy `.env.example` to `.env` to customize:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `LEDGER_FILE` | `/app/data/ledger.json` | Ledger persistence path |
| `ED25519_PRIVATE_KEY_HEX` | *(generated)* | Persistent signing private key |
| `ED25519_PUBLIC_KEY_HEX` | *(generated)* | Persistent signing public key |

### Persistent Signing Keys

By default, the server generates an ephemeral Ed25519 key pair on startup. For production, generate and persist keys:

```bash
node -e "import('rio-receipt-protocol').then(m => { const k = m.generateKeyPair(); console.log('ED25519_PRIVATE_KEY_HEX=' + k.privateKeyHex); console.log('ED25519_PUBLIC_KEY_HEX=' + k.publicKeyHex); })"
```

Add the output to your `.env` file.

## Data Persistence

The ledger is persisted to a Docker volume (`rio-data`). Data survives container restarts.

To back up the ledger:

```bash
docker cp rio-receipt-api:/app/data/ledger.json ./ledger-backup.json
```

## Without Docker

Run the server directly with Node.js 18+:

```bash
npm install rio-receipt-protocol
node docker/server.mjs
```

## License

MIT OR Apache-2.0
