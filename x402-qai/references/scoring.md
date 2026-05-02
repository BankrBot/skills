# x402 QAI Scoring System

## Overview

The compliance scanner evaluates x402 endpoints across four categories. Each category contains individual rules that pass or fail. The overall score is a weighted combination of category scores.

## Categories

### Discovery
Checks whether the endpoint properly advertises its x402 payment requirement.
- Returns HTTP 402 status code
- Includes payment-related headers in the 402 response
- Discoverable payment metadata

### Headers
Validates the format and content of x402-specific headers.
- Correct header names and values
- Required fields present
- Proper formatting of payment details (amount, network, token)

### Payment Flow
Tests the end-to-end payment and access flow.
- Payment can be initiated from the 402 response
- Access granted after valid payment
- Proper response after successful payment

### Error Handling
Verifies proper error responses for edge cases.
- Rejects invalid payment proofs
- Proper error codes for malformed requests
- Graceful handling of expired payments

## Grade Thresholds

| Grade | Score Range | Description |
|-------|------------|-------------|
| A | 90-100 | Fully compliant -- all major rules pass |
| B | 80-89 | Minor issues -- mostly compliant with small gaps |
| C | 70-79 | Partial compliance -- some rules failing |
| D | 60-69 | Significant gaps -- major rules failing |
| F | Below 60 | Non-compliant -- fundamental issues |

## Score Calculation

Each category produces a score from 0-100 based on the percentage of rules that pass within it. The overall score is the average of all category scores. The `passed` boolean is true when the overall score is 60 or above (grade D or better).
