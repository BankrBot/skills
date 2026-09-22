# Arbitrary Transaction Reference

Submit raw EVM transactions with explicit calldata, call any contract function by signature, read ABIs, and deploy or verify contracts. For a signed-and-broadcast REST call without the agent, see [sign-submit-api.md](sign-submit-api.md) (`POST /wallet/submit`).

## Supported Chains

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| Polygon | 137 |
| Base | 8453 |
| Unichain | 130 |
| World Chain | 480 |
| Arbitrum | 42161 |
| BNB Chain | 56 |
| Robinhood Chain | 4663 |
| Arc | 5042 |

Bankr never sponsors gas for arbitrary calldata: the wallet pays its own gas in the chain's native token (ETH, POL, BNB — native USDC on Arc).

## JSON Format

```
Submit this transaction:
{
  "to": "0xContractAddress...",
  "data": "0xFunctionSelector...",
  "value": "0",
  "chainId": 8453
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `to` | Yes | Target address (0x + 40 hex chars) |
| `data` | Yes | Calldata, 0x-prefixed hex (`"0x"` for none). `calldata` is accepted as an alias |
| `value` | Yes | Native value as a numeric string; `"0"` for a plain contract call |
| `chainId` | Yes | A chain ID from the table above; a chain name (`"chain": "base"`) also works |

Keep `value` at `"0"` for plain contract calls. The agent submits native amounts in whole units (`"0.01"` = 0.01 ETH), so to attach value, state the amount in the prompt as well ("…and send 0.01 ETH with it") — or use `POST /wallet/submit`, where `value` is always wei.

## Contract Calls, ABIs, Deploys

- **Call a function by signature** — "Call supply(address,uint256,address,uint16) on Aave's pool 0x… on Base with …". Bankr encodes the arguments; prefer a dedicated prompt (swap, transfer, Polymarket bet) when one exists.
- **Read state** — "Read balanceOf(address) on 0x… for 0x…" (no transaction, not gated).
- **Read an ABI** — "Get the ABI of 0x… on Base". Works for contracts verified on Sourcify, Etherscan or Blockscout; an EIP-1967 proxy returns its implementation's functions, but you still call the proxy address. Struct (tuple) parameters and return values are expanded into the parenthesized form the encoder accepts, and every signature is checked to parse before it is offered, so a struct-taking function like a Uniswap V4 position mint encodes on the first attempt. A function whose signature can't be rendered is listed as unsupported rather than silently dropped.
- **Deploy** — from compiled creation bytecode (a file in your Bankr file storage, or short inline hex) through a deterministic CREATE2 deployer; constructor arguments are passed ABI-encoded, an optional salt fixes the address, and no native value can be attached.
- **Verify** — submit source, exact compiler version, optimizer runs and constructor args to Etherscan and Blockscout. A contract deployed moments ago may need a few blocks before it verifies.

## Guards

A transaction must pass every check below; none of these is transient, so don't retry blind.

| Refusal | Cause |
|---|---|
| "Arbitrary contract calls are disabled by your Security settings" | The wallet's **Enable arbitrary contract calls** switch (bankr.bot → Security) is off. It is on by default; when re-enabled it can be given a timer (10, 30, 60 or 1440 minutes) after which it switches off again. It gates raw transactions, contract writes and deploys — named operations like swaps are unaffected |
| Spend or recipient limits | The native `value` is priced in USD against the wallet's per-transaction and daily limits; the wallet's permitted-recipients list is checked on `to` when `value > 0` |
| "Recipient … is not in the trusted addresses list" | The API key carries a recipient allowlist and `to` (the contract) isn't on it; your own addresses are always allowed |
| "Blocked: this is a raw ERC-20 transfer…" | `transfer` / `transferFrom` calldata on a token contract is refused — use a normal transfer prompt, which verifies the recipient |
| "Blocked: … has no contract code" | Calldata sent to an address with no code would do nothing and still cost gas. Empty calldata (a plain native send) is allowed |
| "Blocked: contract … does not implement function selector …" | Native value attached to a function the contract doesn't have would be swallowed by its fallback (proxies are exempt) |
| "Transaction blocked by security scan" | The transaction was flagged as malicious |
| "Transaction reverted on <chain>" | The contract rejected the calldata; check encoding and contract state |
| Signature won't encode (`tuple`) | Struct parameters must be written in parenthesized form — `mint((address,uint256) params)`, not `mint(tuple params)`; the error explains the expected form |

With a connected (external) wallet, the prepared transaction is returned for you to sign in that wallet instead of being broadcast.
