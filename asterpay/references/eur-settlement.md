# EUR Settlement Flow

## Overview

AsterPay provides EUR settlement for AI agents, enabling them to convert USDC earnings to EUR and send to any European bank account via SEPA Instant.

## Settlement Pipeline

```
1. Agent initiates off-ramp request
   → Amount (USDC) + Recipient IBAN

2. AsterPay validates request
   → IBAN format check
   → Amount limits check
   → Compliance screening

3. USDC collected on Base
   → x402 protocol payment
   → Coinbase CDP facilitator settlement
   → No API keys needed

4. Licensed partner conversion
   → USDC → EUR at market rate
   → MiCA-compliant processing
   → Transparent fee structure

5. SEPA Instant transfer
   → EUR sent to recipient IBAN
   → Settlement in <10 seconds
   → Available 24/7/365
```

## SEPA Instant Details

| Feature | Detail |
|---------|--------|
| Speed | 1-10 seconds |
| Availability | 24/7/365 |
| Maximum | €100,000 per transaction |
| Coverage | 36 SEPA countries |
| Currency | EUR only |

## Fee Structure

| Component | Fee |
|-----------|-----|
| Protocol fee (x402) | Gas on Base (~$0.001) |
| Conversion fee | Competitive market spread |
| SEPA transfer | Included |
| No monthly fees | - |
| No minimum volume | - |

## IBAN Validation

AsterPay validates IBANs before processing:

- Format validation (country code + check digits + BBAN)
- SEPA membership check
- Bank routing verification

### Supported IBAN Formats

| Country | Format | Example |
|---------|--------|---------|
| Germany | DE + 20 chars | DE89370400440532013000 |
| France | FR + 25 chars | FR7630006000011234567890189 |
| Finland | FI + 16 chars | FI2112345600000785 |
| Netherlands | NL + 16 chars | NL91ABNA0417164300 |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `INVALID_IBAN` | Malformed IBAN | Check format, country code |
| `INSUFFICIENT_USDC` | Not enough USDC balance | Top up USDC on Base |
| `AMOUNT_TOO_LOW` | Below minimum (1 USDC) | Increase amount |
| `AMOUNT_TOO_HIGH` | Above SEPA Instant limit | Split into multiple transfers |
| `UNSUPPORTED_COUNTRY` | IBAN country not in SEPA | Use supported country IBAN |
| `SETTLEMENT_DELAYED` | Bank processing delay | Wait up to 30 minutes, then contact support |
