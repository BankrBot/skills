# CannaStack API Reference

Base URL: `https://cannastack.0x402.sh`

All responses are JSON. No API key required. No payment required.

---

## POST /api/strain-finder

Search for a specific strain across dispensaries near a location.

**Request Body:**
```json
{
  "strain": "Blue Dream",
  "location": "Phoenix, AZ",
  "radius": 15
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strain` | string | yes | Strain name to search for |
| `location` | string | yes | City and state (e.g. "Phoenix, AZ") |
| `radius` | int | no | Search radius in miles (default: 10) |

**Response:**
```json
{
  "strain": "Blue Dream",
  "location": "Phoenix, AZ",
  "radius": 15,
  "matches": [
    {
      "dispensary": "Green Leaf Dispensary",
      "address": "123 Main St, Phoenix, AZ",
      "distance": 3.2,
      "products": [
        {
          "name": "Blue Dream - 3.5g",
          "brand": "Select",
          "genetics": "hybrid",
          "price": 35.00,
          "unit": "3.5g"
        }
      ]
    }
  ]
}
```

---

## POST /api/price-compare

Compare prices for a product category across dispensaries.

**Request Body:**
```json
{
  "category": "flower",
  "location": "Los Angeles, CA",
  "genetics": "sativa",
  "limit": 50
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | yes | Product type: flower, edible, concentrate, vape, preroll, topical |
| `location` | string | yes | City and state |
| `genetics` | string | no | Filter: sativa, indica, hybrid |
| `limit` | int | no | Max results (default: 20) |

**Response:**
```json
{
  "category": "flower",
  "location": "Los Angeles, CA",
  "genetics": "sativa",
  "stats": {
    "min": 15.00,
    "avg": 38.50,
    "max": 75.00,
    "count": 42
  },
  "products": [
    {
      "name": "Sour Diesel - 3.5g",
      "brand": "Connected",
      "dispensary": "MedMen",
      "price": 15.00,
      "genetics": "sativa"
    }
  ]
}
```

---

## POST /api/deal-scout

Find dispensaries with active deals near a location.

**Request Body:**
```json
{
  "location": "Denver, CO",
  "category": "edible"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location` | string | yes | City and state |
| `category` | string | no | Filter by product type |

**Response:**
```json
{
  "location": "Denver, CO",
  "dispensaries": [
    {
      "name": "The Green Solution",
      "deals": [
        "20% off all edibles",
        "Buy 2 get 1 free gummies"
      ],
      "products": [
        {
          "name": "Gummy Bears 100mg",
          "price": 18.00,
          "category": "edible"
        }
      ]
    }
  ]
}
```

---

## POST /api/price-history

Track price changes for a strain over time.

**Request Body:**
```json
{
  "strain": "Blue Dream",
  "location": "Phoenix, AZ",
  "days": 30
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strain` | string | yes | Strain name |
| `location` | string | yes | City and state |
| `days` | int | no | Lookback period in days (default: 7) |

**Response:**
```json
{
  "strain": "Blue Dream",
  "location": "Phoenix, AZ",
  "days": 30,
  "trend": "down",
  "pricePoints": [
    {
      "date": "2026-04-01",
      "avgPrice": 42.00,
      "minPrice": 30.00,
      "maxPrice": 55.00,
      "sampleSize": 12
    }
  ]
}
```
