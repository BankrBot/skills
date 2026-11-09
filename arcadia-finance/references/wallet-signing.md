# Submitting Arcadia transactions with Bankr

Every Arcadia write tool returns `{ "transaction": { "to", "data", "value", "chainId" } }`. Submit the `transaction` object with Bankr.

## Prerequisites

- The Bankr wallet must have **Enable arbitrary contract calls** on (requires MFA). While it is off, raw submissions are blocked.
- The wallet pays gas in the chain's native token.
- Supported chains: Base (8453), Unichain (130), Robinhood Chain (4663).

## Through the agent

```bash
TX=$(scripts/arcadia.sh write_account_create '{"wallet_address":"0x...","salt":1,"chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"
```

## Approve, then deposit

```bash
APPROVE_TX=$(scripts/arcadia.sh write_wallet_approve '{"token_address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","spender_address":"0x...","amount":"1000000","chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $APPROVE_TX"

DEPOSIT_TX=$(scripts/arcadia.sh write_account_deposit '{"account_address":"0x...","asset_addresses":["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],"asset_amounts":["1000000"],"chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $DEPOSIT_TX"
```

## Through the Wallet API

`POST https://api.bankr.bot/wallet/submit` broadcasts the same object without the agent. See the Bankr skill's `references/sign-submit-api.md` for the request format and error handling.

## Notes

- Submit batched transactions within 30 seconds. Their calldata expires.
- If a submission fails with a `transactionHash`, check that hash before retrying. The transaction may already be onchain.
- Confirm the details with the user before submitting.
