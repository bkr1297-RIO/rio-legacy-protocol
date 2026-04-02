# RIO Receipt Protocol — Architecture

The diagram below shows where the RIO Receipt Protocol sits in a system. The protocol is the middle layer. It does not care what is above it (any AI provider, any agent framework) or below it (any storage backend, any governance system). It produces verifiable receipts.

```mermaid
graph TB
    subgraph AI["AI Layer — Any Provider"]
        direction LR
        OAI["OpenAI"]
        ANT["Anthropic"]
        GEM["Google"]
        OSS["Open Source<br/>Models"]
        CUS["Custom<br/>Agents"]
    end

    subgraph APP["Application Layer"]
        direction LR
        ORCH["Agent Orchestration<br/><i>LangChain, CrewAI, AutoGen,<br/>custom frameworks</i>"]
        ACT["Action Execution<br/><i>send email, API call,<br/>database write, payment</i>"]
    end

    subgraph RRP["RIO Receipt Protocol — Open Standard"]
        direction LR
        INT["Intent<br/>Hashing"]
        EXE["Execution<br/>Hashing"]
        REC["Receipt<br/>Generation"]
        VER["Verification"]
        LED["Tamper-Evident<br/>Ledger"]
    end

    subgraph GOV["Governance Layer — Optional"]
        direction LR
        POL["Policy<br/>Engine"]
        APR["Human<br/>Approval"]
        AUT["Authorization<br/>Signing"]
    end

    subgraph STORE["Storage / Infrastructure"]
        direction LR
        FS["File System<br/>JSON"]
        DB["Database<br/>SQL / NoSQL"]
        S3["Object Storage<br/>S3 / GCS"]
        BC["Blockchain<br/><i>optional</i>"]
    end

    AI --> APP
    APP --> RRP
    GOV -.->|extends receipts<br/>from 3-hash to 5-hash| RRP
    RRP --> STORE

    INT --> EXE --> REC --> LED
    REC --> VER

    classDef aiLayer fill:#1e3a5f,stroke:#3b82f6,stroke-width:2px,color:#e2e8f0
    classDef appLayer fill:#1e3a4f,stroke:#60a5fa,stroke-width:1px,color:#e2e8f0
    classDef protocolLayer fill:#422006,stroke:#f59e0b,stroke-width:3px,color:#fbbf24
    classDef govLayer fill:#1a2e1a,stroke:#22c55e,stroke-width:1px,color:#bbf7d0
    classDef storeLayer fill:#1e293b,stroke:#64748b,stroke-width:1px,color:#94a3b8
    classDef protocolNode fill:#78350f,stroke:#f59e0b,stroke-width:2px,color:#fef3c7

    class AI aiLayer
    class APP appLayer
    class RRP protocolLayer
    class GOV govLayer
    class STORE storeLayer
    class OAI,ANT,GEM,OSS,CUS aiLayer
    class ORCH,ACT appLayer
    class INT,EXE,REC,VER,LED protocolNode
    class POL,APR,AUT govLayer
    class FS,DB,S3,BC storeLayer
```

## Key Points

The RIO Receipt Protocol is **provider-agnostic**. It works with any AI system — OpenAI, Anthropic, Google, open-source models, or custom agents. The protocol does not interact with the AI layer directly; it operates on the outputs (intents and execution results) that the application layer produces.

The protocol is **storage-agnostic**. Receipts and ledger entries are JSON objects. They can be stored in files, databases, object storage, or even a blockchain. The protocol defines the format and the verification rules, not where the data lives.

The governance layer is **optional**. Without it, the protocol produces 3-hash proof-layer receipts (intent, execution, receipt). With it, the protocol produces 5-hash governed receipts that additionally prove governance evaluation and human authorization occurred.

## Receipt Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant App as Application
    participant Proto as RIO Receipt Protocol
    participant Ledger as Tamper-Evident Ledger

    AI->>App: Propose action
    App->>Proto: Hash intent
    App->>App: Execute action
    App->>Proto: Hash execution
    Proto->>Proto: Generate receipt<br/>(bind intent + execution hashes)
    Proto->>Proto: Verify receipt
    Proto->>Ledger: Append to hash chain
    Ledger-->>App: Ledger entry with prev_hash linkage
```

The entire flow — from intent to ledger entry — happens in milliseconds. The receipt is generated locally using SHA-256. No external service calls are required.
