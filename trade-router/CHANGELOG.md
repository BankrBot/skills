# Changelog

All notable changes to the Trade Router MCP skill are documented here.

## [1.4.0] — 2026-04-23

### Added
- **`SECURITY.md`** — complete threat model, data flow diagram, permissions manifest, and threat matrix. Addresses the "suspicious" verdict returned by static analysis tools (VirusTotal, ClawHub moderation) that cannot infer the non-custodial architecture from behavior alone.
- **`LICENSE`** (MIT) — previously missing, triggering additional scanner caution.
- **`CHANGELOG.md`** — this file.
- **Documentation badge**: Security: non-custodial shield in README.
- **Disclosure policy**: `security@traderouter.ai` for vulnerability reports, 48h acknowledgement commitment.

### Changed
- **README rewrite**: leads with "Is this safe?" section before features. Links prominently to SECURITY.md. Clarifies signing flow in 4 steps.

### Clarified (no behavior change)
- Private key is read once, used for local Solana signing via `solders`, never transmitted, logged, or persisted.
- Only signed transactions are sent to the server. Unsigned transactions returned by `/swap` are signed locally before submission to `/protect`.
- Dry-run mode and daily loss limits were already implemented in 1.3.0 but are now documented as first-class safety features.

### Why this matters
No code change in this release. The update is entirely documentation and moderation-friendliness, responding to automated scanners flagging the package as "suspicious" because they observe: (a) `PRIVATE_KEY` env var read, (b) HTTPS calls to external API, (c) financial transaction submission. The scanner's caution was correct but uninformed — the complete behavior is non-custodial by construction. This release makes that provable to human reviewers in under 5 minutes.

## [1.3.0] — prior

### Added
- Combo orders (combined limit + trailing stop)
- Multi-DEX routing across Raydium, PumpSwap, Orca, Meteora
- WebSocket TWAP / DCA orders with configurable intervals

## [1.2.0] and earlier

See git history.
