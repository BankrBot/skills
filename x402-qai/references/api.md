# x402 QAI API Reference

Base URL: `https://qai.0x402.sh`

All responses are JSON. No API key required. No payment required.

---

## POST /api/scan

Scan a URL for x402 spec compliance.

**Request Body:**
```json
{
  "url": "https://example.com/api/resource"
}
```

**Response:**
```json
{
  "url": "https://example.com/api/resource",
  "score": 85,
  "passed": true,
  "categories": {
    "discovery": {
      "score": 90,
      "rules": [...]
    },
    "headers": {
      "score": 80,
      "rules": [...]
    },
    "paymentFlow": {
      "score": 85,
      "rules": [...]
    },
    "errorHandling": {
      "score": 85,
      "rules": [...]
    }
  },
  "rules": [
    {
      "name": "returns-402",
      "category": "discovery",
      "passed": true,
      "message": "Endpoint returns HTTP 402"
    }
  ]
}
```

---

## GET /api/explore

Browse the x402 service marketplace.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | -- | Search query (filters by name/description) |
| `limit` | int | 20 | Max results |

**Response:**
```json
[
  {
    "name": "Example API",
    "description": "Data feed with x402 payment",
    "url": "https://example.com/api",
    "price": "$0.01",
    "network": "base"
  }
]
```

---

## POST /api/workflows/estimate

Estimate costs for a multi-step x402 workflow.

**Request Body:**
```json
{
  "steps": [
    {
      "url": "https://example.com/api/step1"
    },
    {
      "url": "https://example.com/api/step2"
    }
  ]
}
```

**Response:**
```json
{
  "totalCost": "$0.03",
  "steps": [
    {
      "url": "https://example.com/api/step1",
      "cost": "$0.01",
      "network": "base"
    },
    {
      "url": "https://example.com/api/step2",
      "cost": "$0.02",
      "network": "base"
    }
  ]
}
```

---

## Report URL

Shareable compliance report page. No API call needed -- construct the URL directly.

**Format:** `https://qai.0x402.sh/report/{base64url_encoded_url}`

**Example:**
```
URL: https://example.com/api/resource
Encoded: aHR0cHM6Ly9leGFtcGxlLmNvbS9hcGkvcmVzb3VyY2U
Report: https://qai.0x402.sh/report/aHR0cHM6Ly9leGFtcGxlLmNvbS9hcGkvcmVzb3VyY2U
```

---

## Badge URL

Embeddable compliance badge image. No API call needed -- construct the URL directly.

**Format:** `https://qai.0x402.sh/api/badge/{base64url_encoded_url}`

**Markdown embed:**
```markdown
[![x402 Compliance](https://qai.0x402.sh/api/badge/{encoded})](https://qai.0x402.sh/report/{encoded})
```
