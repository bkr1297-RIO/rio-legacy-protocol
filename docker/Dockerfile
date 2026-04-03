FROM node:22-alpine

LABEL maintainer="RIO Protocol Contributors <riomethod5@gmail.com>"
LABEL description="RIO Receipt Protocol REST API — cryptographic proof for AI actions"
LABEL version="2.2.0"
LABEL license="MIT OR Apache-2.0"

WORKDIR /app

# Install the protocol package
RUN npm init -y && npm install rio-receipt-protocol@2.2.0

# Copy the REST API server
COPY server.mjs .

# Create data directory for ledger persistence
RUN mkdir -p /app/data

# Default port
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LEDGER_FILE=/app/data/ledger.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.mjs"]
