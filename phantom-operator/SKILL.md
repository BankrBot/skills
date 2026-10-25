---
name: phantom-operator
description: Privacy, OPSEC, and Monero intelligence skills for public-web exposure analysis, metadata audits, breach indicators, and wallet privacy posture, callable through x402 on Base.
tags: [privacy, opsec, security, osint, x402]
---

# PhantomOperator: Multi-Operator Privacy & OPSEC Skill

PhantomOperator is an autonomous privacy and OPSEC framework designed to locate personal identifiable information (PII), calculate operational security exposure scores, execute data-broker opt-outs, audit web/file metadata, and check credential breaches.

## Core Capabilities & Sub-Operators

### 1. Threat Scan (threat-scan)
- Objective: Conduct OSINT and public web searches for PII including full names, usernames, phone numbers, and addresses.
- Output: exposure report with threat tiers (critical, high, medium, low).

### 2. Data Broker Removal Request (data-removal)
- Objective: Submit opt-out and suppression requests to known people-search engines and data brokers.

### 3. Full Privacy Sweep (full-privacy-sweep)
- Objective: End-to-end workflow: threat scan, listing extraction, removal requests, audit log.

### 4. OPSEC Exposure Scoring (opsec-score)
- Objective: Multi-vector operational security assessment with a composite score (0-100) and prioritized mitigations.

### 5. Breach & Credential Check (breach-check)
- Objective: Check emails and passwords (SHA-1 k-anonymity, no plaintext disclosed) against known breaches.

### 6. Metadata Privacy Audit (metadata-audit)
- Objective: Audit URLs for metadata leakage, tracking and fingerprinting vectors.

## On-Chain & Payment Integrations

- Base Chain (8453):
  - Identity Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
  - Reputation Registry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
  - Accepted Payment: native USDC via x402 on Base (`eip155:8453`), token `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, paid to `0xC5f20C3Ad7B730B34620ecF39c2C5681482A6Cd6`.
- Solana:
  - Independent program registry for skill invocations with SOL micropayments.

## Live API

- Base URL: `https://freysaai.freysa.dev`
- x402 discovery: `https://freysaai.freysa.dev/.well-known/x402`
- OpenAPI: `https://freysaai.freysa.dev/openapi.json`
- ERC-8004 agent: `821239`
- No API key is required. Inspect a skill endpoint first; it returns an x402 payment requirement when unpaid.

Additional skills: `monero-opsec-audit`, `wallet-opsec-audit`, `cypherpunk-redteam-dossier`, and `sovereign-opsec-retainer`.

## Execution Rules
- Always obtain explicit user authorization before triggering active opt-out requests or scanning third-party personal identities.
- Format all scan results cleanly, grouping findings by urgency and actionable next steps.
