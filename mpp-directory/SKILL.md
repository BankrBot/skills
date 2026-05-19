---
name: mpp-directory
description: mpp.directory is a public registry and routing surface for machine-payments services across MPP, x402, l402, MCP, and A2A. Use when an agent needs to discover providers, services, endpoints, namespaces, certifications, passports, health, pricing, incidents, or live signals before choosing an API or workflow. Triggers on mentions of mpp.directory, MPP registry, paid API discovery, endpoint routing, namespace manifests, protocol comparison, or finding the best machine-payments endpoint.
metadata:
  {"clawdbot":{"emoji":"📡","homepage":"https://mpp.directory"}}
---

# mpp.directory

mpp.directory is a public discovery and intelligence layer for machine-payments services. It indexes providers, services, endpoints, verification state, workflow health, pricing hints, incidents, certifications, and agent-facing interfaces across multiple protocol families.

## Public Surfaces

- Dashboard: https://mpp.directory/v1
- Endpoint catalog: https://mpp.directory/v1/public/endpoints
- Services: https://mpp.directory/v1/services
- Providers: https://mpp.directory/v1/providers
- Signals: https://mpp.directory/v1/signals
- Router UI: https://mpp.directory/v1/router
- Compare UI: https://mpp.directory/v1/compare
- Market UI: https://mpp.directory/v1/market

See references/public-api.md for the most useful routes, query params, and response cues.

## Fast Paths

### Find candidate endpoints

1. Start with /v1/public/endpoints.
2. Filter by q, protocol, paymentRail, sortBy, and freshOnly.
3. Use certification, freshness, workflow health, incident pressure, and price signals together.
4. Open the matching service or endpoint detail page before making a strong recommendation.

### Compare providers or protocols

1. Use /v1/public/endpoints for machine-readable search.
2. Use /v1/compare or /v1/router when the user wants routing help or tradeoffs.
3. Prefer fresh, certified endpoints over stale or docs-only listings.

### Inspect live market or reliability movement

1. Use /v1/signals for current movers, incidents, and notable changes.
2. If the user wants a premium narrative summary, use /v1/signals/explain and expect an MPP payment challenge.
3. Verify the underlying endpoint or service detail before escalating an alert.

### Reuse an agent-facing interface

If a service or namespace already exposes a generated skill, manifest, or client guide, prefer those surfaces before writing custom instructions:

- /v1/services/:id/skill.md
- /v1/services/:id/manifest.json
- /v1/services/:id/client.md
- /v1/namespaces/:namespace/skill.md
- /v1/namespaces/:namespace/manifest.json
- /v1/namespaces/:namespace/client.md

## Task Guide

### When the user wants discovery

- Start with the public endpoint catalog, not a homepage scrape.
- Search by capability or provider name, then filter by protocol and payment rail.
- Use certification, health, freshness, and price data together. Do not rank on one field alone.

### When the user wants the best endpoint

- Clarify whether best means cheapest, freshest, healthiest, most autonomous, or most verified.
- Prefer endpoints with recent proof, low incident pressure, and a matching authorization posture.
- Call out when a listing is docs-backed or stale instead of runtime-fresh.

### When the user wants onboarding or integration help

- Look for service or namespace skill.md, manifest.json, or client.md surfaces first.
- Use provider and service pages to gather docs, homepage, tags, related endpoints, and payment rails.

### When the user wants trust or incident context

- Read /v1/signals plus the service or endpoint detail.
- Use certifications, open findings, workflow health, endpoint health, and incident history together.
- Do not treat a listed service as endorsed just because it is indexed.

## Usage Examples

### Example prompts

~~~
Use mpp.directory to find fresh x402 or MPP endpoints for search, then rank the top options by verification quality and price.
~~~

~~~
Look up this provider on mpp.directory, summarize its services and payment rails, and tell me which route looks safest for an autonomous agent.
~~~

~~~
Check mpp.directory signals for anything relevant to MCP reliability this week, then explain the most important mover.
~~~

### Example reads

~~~bash
curl -fsSL 'https://mpp.directory/v1/public/endpoints?q=search&protocol=x402&freshOnly=true&limit=10'
curl -fsSL 'https://mpp.directory/v1/services?limit=20'
curl -fsSL 'https://mpp.directory/v1/providers'
curl -fsSL 'https://mpp.directory/v1/signals'
~~~

## Reliability Rules

- Treat /v1/public/endpoints as the primary machine-readable discovery surface.
- Prefer fresh, certified, runtime-backed records over stale or docs-only records.
- Do not assume a listed endpoint is cheap, public, or autonomous without checking pricing and authorization posture.
- Use detail JSON or detail pages before making a strong claim about trust, incidents, or integration steps.
- Treat paid /v1/signals/explain as optional analysis, not the source of truth.
