# Changelog

All notable changes to the Trade Router skill are documented here.

Versioning note:
- **ClawHub skill** (`SKILL.md`): the live listing at [clawhub.ai/re-bruce-wayne/trade-router](https://clawhub.ai/re-bruce-wayne/trade-router) is `v1.3.0` (last re-uploaded 2026-03-05). A re-upload to bump to `v1.3.1` is pending (will include the 2026-04-23 documentation additions below).
- **npm `@re-bruce-wayne/trade-router-mcp`**: independent track, latest `v1.0.5`.
- **PyPI `traderouter-mcp`**: independent track, latest `v1.0.0` (first release 2026-04-24).

## [Unreleased] — 2026-04-23 — pending ClawHub re-upload as v1.3.1

### Added — documentation only, no code changes to `SKILL.md`
- **[`trade-router/SECURITY.md`](./SECURITY.md)** — complete threat model, data-flow diagram, permissions manifest. Addresses the "suspicious" verdict returned by static analysis tools (VirusTotal, ClawHub moderation) that cannot infer the non-custodial architecture from static behavior alone.
- **[`trade-router/LICENSE`](./LICENSE)** — MIT. Missing license was triggering additional scanner caution.
- **[`trade-router/CHANGELOG.md`](./CHANGELOG.md)** — this file.
- **[`trade-router/README.md`](./README.md)** — security-first intro with clear 4-step signing flow.
- Disclosure policy: `security@traderouter.ai` for vulnerability reports, 48h acknowledgement commitment.

### Changed
- **README rewrite**: leads with "Is this safe?" section before features. Links prominently to SECURITY.md.

### Clarified (architectural — not a code change)
- Private key is read once from env, used for local Solana signing via `solders`, never transmitted, logged, or persisted.
- Only signed transactions are sent to the server. Unsigned transactions returned by `/swap` are signed locally before submission to `/protect`.
- Dry-run mode and daily loss limits were already implemented but are now documented as first-class safety features.

### Why this update exists
No code change in this entry. The update is entirely documentation and moderation-friendliness, responding to automated scanners flagging the skill as "suspicious" because they observe: (a) `PRIVATE_KEY` env var read, (b) HTTPS calls to external API, (c) financial transaction submission. The scanner's caution is correct but uninformed — the complete behavior is non-custodial by construction. This entry makes that provable to human reviewers in under 5 minutes.

Tracked in ClawHub GitHub issue [openclaw/clawhub#1811](https://github.com/openclaw/clawhub/issues/1811) for moderator review of the flag.

## [1.3.0] — 2026-03-05 (current live ClawHub version)

### Added
- Combo orders (combined limit + trailing stop)
- Multi-DEX routing across Raydium, PumpSwap, Orca, Meteora
- WebSocket TWAP / DCA orders with configurable intervals
- Flex endpoint (`/flex`) — trade-card PNG generation
- Mcap endpoint (`/mcap`) — market-cap + price lookups

## [1.2.0] and earlier

See git history in [re-bruce-wayne/openclaw-skills](https://github.com/re-bruce-wayne/openclaw-skills).
