# Public API Notes

Use this file when you need quick route-level guidance without reloading the full skill into context.

## Core Discovery

### GET /v1/public/endpoints

Primary machine-readable catalog for routing and comparison.

Useful query params:

- q: free-text search across provider, service, and endpoint metadata
- protocol: mpp, l402, x402, a2a, or mcp
- paymentRail: filter by payment rail such as tempo, x402, api_key, or free
- sortBy: default, proof, telemetry, trust, governance, evidence, health, workflow, paid_reliability, value, price, or updated
- freshOnly: restrict to recently refreshed endpoints
- limit, offset: pagination

The response carries far more than URL plus method. The highest-signal fields are usually:

- endpoint: transport, HTTP method, payment rail, verification status, approval posture
- service: display name, docs URL, homepage, tags
- provider: provider family, source type, documented profile
- certification: public trust summary and freshness windows
- workflowHealth, endpointHealth, serviceHealth
- recentPaid, openFindings, freshness, priceEngine

## Directory Lists and Lookup

### GET /v1/services

Paginated service list for broad browsing or follow-up by service id.

### GET /v1/providers

Provider list for platform-level discovery and grouping.

### POST /v1/services/lookup

Use when you already know a likely service name, docs URL, homepage, or endpoint URL and want to match it to a registry record.

Example payload:

~~~json
{
  "displayName": "AgentMail",
  "homepageUrl": "https://agentmail.to",
  "docsUrl": "https://docs.agentmail.to",
  "endpoints": [
    {
      "url": "https://mpp.api.agentmail.to/v0/inboxes",
      "httpMethod": "GET"
    }
  ]
}
~~~

## Detail Surfaces

Use these once you have an id or namespace:

- GET /v1/services/:id
- GET /v1/services/:id/view
- GET /v1/endpoints/:id
- GET /v1/endpoints/:id/view
- GET /v1/providers/:id
- GET /v1/providers/:id/view
- GET /v1/providers/by-slug/:slug
- GET /v1/namespaces/:namespace
- GET /v1/namespaces/:namespace/view

Prefer the JSON routes when summarizing for another tool. Use the view routes when a human-readable detail page is more useful.

## Agent-Facing Interfaces

Some services and namespaces expose generated interfaces you can pass through to another agent or client:

- GET /v1/services/:id/skill.md
- GET /v1/services/:id/manifest.json
- GET /v1/services/:id/client.md
- GET /v1/namespaces/:namespace/skill.md
- GET /v1/namespaces/:namespace/manifest.json
- GET /v1/namespaces/:namespace/client.md

These are often better starting points than inventing an integration guide from scratch.

## Signals and Paid Explain

### GET /v1/signals

Live board for incidents, movers, spotlight entries, and market-style summaries.

Use it when the user asks:

- what changed recently
- which services are rising or slipping
- where reliability degraded
- what looks newly valuable or risky

### GET /v1/signals/explain

Paid narrative expansion of a signal. Expect an MPP payment challenge on first access.

Treat signals/explain as an interpretation layer. The underlying signal record plus the related service or endpoint detail remain canonical.

## UI Routes

These are useful when a user wants a human-facing entry point:

- GET /v1
- GET /v1/router
- GET /v1/compare
- GET /v1/market
- GET /v1/signals/view
