# Signing Transactions via Bankr

All Arcadia write tools return unsigned transactions as `{ to, data, value, chainId }`. Use Bankr to sign and broadcast.

## Single Transaction

```bash
TX='{"to":"0x...","data":"0x...","value":"0","chainId":8453}'
bankr prompt "Submit this transaction: $TX"
```

## Multi-Step Example (Approve + Deposit)

```bash
# Step 1: Approve token spend
APPROVE_TX=$(node scripts/arcadia.mjs write_wallet_approve '{"token_address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","spender_address":"0x...","amount":"1000000"}')
bankr prompt "Submit this transaction: $APPROVE_TX"

# Step 2: Deposit into account
DEPOSIT_TX=$(node scripts/arcadia.mjs write_account_deposit '{"account_address":"0x...","assets":[{"asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","id":0,"amount":"1000000"}]}')
bankr prompt "Submit this transaction: $DEPOSIT_TX"
```

## Safety

- Always confirm transaction details with the user before submitting
- Check account health factor with `read_account_info` before risky operations
- Never pass private keys as tool arguments
