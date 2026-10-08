# USDCtoFiat for Bankr

Cash out a Bankr wallet's Base USDC to eligible fiat payment apps through USDCtoFiat by Galleon.

The CLI calls `@usdctofiat/offramp@9.0.0`:

```ts
cashout({ mode: "fast" | "best", signer, amount, currency, platform, payee })
```

- **Fast**: live market rate, 0% spread. Attribution is locked to TOFIAT.
- **Best**: Delegate strategy. 10 bps on fill, taken from USDC released to the taker.

Attribution is handled by `@usdctofiat/offramp`.

Unsigned Base transactions are submitted through Bankr `/wallet/submit`. No private key. No Peer API key.

## Install

```text
install the usdctofiat skill from https://github.com/BankrBot/skills/tree/main/usdctofiat
```

Then install the local runtime dependencies:

```bash
cd usdctofiat
npm ci
```

Set a write-enabled `BANKR_API_KEY`.

## Safety model

- Read commands do not move funds.
- Write commands fail closed without `--confirm`; the agent must show the generated preview and wait for a later-turn user confirmation.
- `cashout` requires an explicit `--mode fast` or `--mode best`.
- Accepted Bankr transaction hashes and the returned `depositId` are retained for reconciliation. A missing hash remains an unknown outcome.
- Unknown transaction outcomes are never automatically retried.
- Cash App creation stops before wallet access; Wise remains excluded by provider policy. Discover separate Fast/Best catalogs before offering other routes.
- SDK 9 errors preserve public recovery fields without exposing raw causes. Fast top-up and withdrawal remain supported; numeric Best recovery uses `deposits()` and full `close()`.
- Best status/withdraw now require `--escrow` with the numeric id. Both the preview and `close()` bind that exact owned pair, avoiding collisions across old/new escrows. SDK history is bounded to 100 rows; a missing deposit blocks recovery until reconciled.
- Previews show the practical 1 USDC minimum and Best's 1,500 USDC per-buyer cap. An estimate or deposit transaction is not fiat settlement.

## Checks

`npm test` runs offline SDK-contract and mocked Bankr wallet/submission checks. `npm run smoke` discovers capabilities without wallet access. No test moves funds.

See `SKILL.md` for the command contract and recovery rules.
