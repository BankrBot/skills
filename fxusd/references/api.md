# fxUSD API Reference

Public app base URL:

`https://fxsave.up.railway.app`

## CLI helper

Script:
- `scripts/fxusd_cli.py`

Examples:

```bash
python3 scripts/fxusd_cli.py mint \
  --from-address 0x... \
  --amount 10 \
  --source-token fxUSD
```

```bash
python3 scripts/fxusd_cli.py redeem \
  --from-address 0x... \
  --amount 1 \
  --target-token USDC
```

```bash
python3 scripts/fxusd_cli.py approval \
  --from-address 0x... \
  --amount 1 \
  --token fxSAVE
```

## Endpoint: `/api/fxsave/fxsave-bundle`

Method: `POST`

Purpose:
- Build an executable Enso shortcut bundle for `mint` or `redeem`

### Mint request

```json
{
  "amount": "1",
  "direction": "mint",
  "fromAddress": "0x...",
  "receiver": "0x...",
  "sourceTokenAddress": "0x55380fe7a1910dff29a47b622057ab4139da42c5",
  "sourceTokenSymbol": "fxUSD",
  "sourceTokenDecimals": 18
}
```

### Redeem request

```json
{
  "amount": "1",
  "direction": "redeem",
  "fromAddress": "0x...",
  "receiver": "0x...",
  "targetTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "targetTokenSymbol": "USDC",
  "targetTokenDecimals": 6
}
```

### Success response shape

```json
{
  "flow": [],
  "result": {
    "tx": {
      "to": "0x...",
      "from": "0x...",
      "data": "0x...",
      "value": "0"
    },
    "amountsOut": {},
    "minAmountsOut": {},
    "bridgingEstimates": []
  },
  "quotePlan": {},
  "warnings": []
}
```

## Endpoint: `/api/fxsave/fxsave-approve`

Method: `POST`

Purpose:
- Build the approval tx payload for the current source token

### Request

```json
{
  "amount": "1000000000000000000",
  "fromAddress": "0x...",
  "tokenAddress": "0x273f20fa9fbe803e5d6959add9582dac240ec3be"
}
```

### Success response shape

```json
{
  "result": {
    "spender": "0x...",
    "amount": "1000000000000000000",
    "tx": {
      "to": "0x...",
      "data": "0x...",
      "value": "0"
    }
  }
}
```

## Execution pattern

1. Build the bundle.
2. Identify the source token for the current direction.
3. Build approval payload for that source token.
4. Compare allowance.
5. Submit approval if needed.
6. Submit `result.tx`.
7. Tell the user final settlement may lag the Base confirmation.
