# ─────────────────────────────────────────────────────────────────────
# RIO Receipt Protocol — Docker Image
#
# Packages the full RIO Receipt Protocol as a production-ready
# container: reference implementation, REST API server, CLI verifier,
# conformance tests, and examples.
#
# Usage:
#   docker build -t rio-receipt-protocol .
#   docker run -p 3000:3000 rio-receipt-protocol
#
# Or with docker compose:
#   docker compose up -d
#
# Modes:
#   API server (default):  docker run -p 3000:3000 rio-receipt-protocol
#   CLI verifier:          docker run rio-receipt-protocol rio-verify receipt /app/examples/sample_receipt_valid.json
#   Run tests:             docker run rio-receipt-protocol npm test
#   Run demo:              docker run rio-receipt-protocol node cli/demo.mjs
#   Node.js REPL:          docker run -it rio-receipt-protocol node
#
# @version 2.2.0
# @license MIT OR Apache-2.0
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./

# Install dependencies (none for core, but respects any lock file)
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

# Copy the full protocol source
COPY index.mjs index.d.ts ./
COPY reference/ ./reference/
COPY cli/ ./cli/
COPY spec/ ./spec/
COPY tests/ ./tests/
COPY examples/ ./examples/
COPY docker/server.mjs ./docker/server.mjs
COPY README.md CHANGELOG.md LICENSE-MIT LICENSE-APACHE ./

# ── Stage 2: Production ─────────────────────────────────────────────
FROM node:22-alpine

LABEL maintainer="RIO Protocol Contributors <riomethod5@gmail.com>"
LABEL description="RIO Receipt Protocol — cryptographic proof for AI actions"
LABEL version="2.2.0"
LABEL license="MIT OR Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/bkr1297-RIO/rio-receipt-protocol"
LABEL org.opencontainers.image.documentation="https://github.com/bkr1297-RIO/rio-receipt-protocol#readme"

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app ./

# Create data directory for ledger persistence
RUN mkdir -p /app/data

# Make CLI executable
RUN chmod +x /app/cli/verify.mjs && \
    ln -sf /app/cli/verify.mjs /usr/local/bin/rio-verify

# ── Environment ──────────────────────────────────────────────────────
# Server configuration
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LEDGER_FILE=/app/data/ledger.json

# Ed25519 signing keys (optional — ephemeral keys generated if not set)
# Generate persistent keys:
#   docker run --rm rio-receipt-protocol node -e \
#     "import('rio-receipt-protocol').then(m=>{const k=m.generateKeyPair();console.log('ED25519_PRIVATE_KEY_HEX='+k.privateKeyHex);console.log('ED25519_PUBLIC_KEY_HEX='+k.publicKeyHex)})"
ENV ED25519_PRIVATE_KEY_HEX=""
ENV ED25519_PUBLIC_KEY_HEX=""

EXPOSE 3000

# ── Health Check ─────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# ── Default: Start REST API Server ───────────────────────────────────
CMD ["node", "docker/server.mjs"]
