# Verifying a SignalCollection

Verification is part of the deploy, not an optional extra. Everything a block explorer
asks for is published — the point is to paste those exact values, never to reconstruct or
guess them.

## Where each field comes from

| Explorer field | Source | Value |
| --- | --- | --- |
| Contract address | your receipt | the deployed address on the chosen chain |
| Source code | `GET /collections/artifact` → `source` | the complete file — **no imports exist**, so single-file verification needs no flattening |
| Compiler | `verify.compiler` | `0.8.26+commit.8a97fa7a` (the full commit form, not just `0.8.26`) |
| Optimization enabled | `verify.optimizerRuns` context | yes |
| Optimization runs | `verify.optimizerRuns` | `200` |
| EVM version | `verify.evmVersion` | `paris` — select it explicitly; the compiler's own default for 0.8.26 is newer and will not match |
| License | the source header | `CC0-1.0` (cosmetic on the form; some explorers only offer a subset — pick the closest) |
| Constructor arguments | `verify.constructorArgs` | the ABI-encoded hex; some forms want it **without** the leading `0x`, appended after the creation code |

A single `POST /collections/prepare` reply carries all of it under `verify`, plus
`artifactUrl` for the source. Do not mix fields from two prepares (an older reply has
different bytecode after any contract edit).

## Bankr

One message:

> Verify contract `<address>` on chain `<chainId>` with the source at
> `<artifactUrl>` field `source`, compiler `0.8.26+commit.8a97fa7a`, optimizer enabled
> with 200 runs, EVM version `paris`, constructor arguments `<constructorArgs>`.

Bankr's verify path submits source, compiler version, optimizer runs and constructor
arguments to Etherscan or Blockscout — same four things the form wants.

## Explorer form (Etherscan family)

1. Open the contract address → **Contract** tab → **Verify and Publish** (or
   **More Options → Verify** on a freshly deployed address).
2. Verification method: **Single file** (Solidity).
3. Compiler: `v0.8.26+commit.8a97fa7a`.
4. Optimization: **Yes**, runs **200**.
5. EVM version: **paris** (shown as an option once a ≥0.8.22 compiler is selected).
6. Paste the `source` field verbatim — the artifact's source, byte for byte. A retyped or
   re-formatted copy produces different metadata and fails on a byte comparison.
7. Constructor arguments: paste `verify.constructorArgs`. The form may offer to auto-fill
   them from the creation code; if it does, confirm the decoded values equal `params`.
8. Submit. Success shows the source read-only with a green check.

## Blockscout and chain-native explorers

Same fields, different labels: **Optimization enabled / Optimization runs / EVM
version** under compiler settings, constructor arguments in the deployment section. Use
the explorer that actually indexes the chain in question — some of Bankr's chains verify
on Blockscout rather than Etherscan.

## From a toolchain

```bash
# hardhat: constructor args as a module of decoded values (NOT the hex blob)
cat > /tmp/args.js <<'EOF'
module.exports = ["Nova Nodes", "NOVA", "0x…", 2222n, 1000000000000000n, 20n, 20n,
  "", "", "0x…", 500n, 0, 123n, "Nova Nodes — agent NFT collection.",
  "https://agents.example.com/nova/"];
EOF
npx hardhat verify --network <name> --constructor-args /tmp/args.js <address>
```

The hex `constructorArgs` and this list are two encodings of the same values — decode
with `decodeAbiParameters(artifact.constructorInputs, constructorArgs)` if you need the
list. (And `forge verify-contract` with `--num-of-optimizations 200 --evm-version paris`.)

## When verification fails

| Symptom | Cause | Fix |
| --- | --- | --- |
| "does not match bytecode" | source edited, re-formatted, or taken from another copy | re-fetch `source` from the artifact and paste it byte for byte |
| Constructor arguments don't match | hex pasted with/without `0x` wrongly, or args from a different prepare | use this deploy's `verify.constructorArgs`; strip or add `0x` per the form's hint |
| Wrong compiler / no such version | only `0.8.26` picked without the commit, or another patch | pick exactly `v0.8.26+commit.8a97fa7a` |
| Runs mismatch | optimization runs not 200, or optimization off | yes / 200 |
| EVM version mismatch | form defaulted to a newer target | select `paris` explicitly |
| "Unable to locate ContractCode" | not deployed on this chain, or not indexed yet | re-check the receipt; retry after indexing |
| Address already verified | a previous attempt succeeded | read the verified source instead — then still report it as verified |
| Explorer doesn't cover this chain | wrong explorer for the chain | use the chain's own explorer / Blockscout |
| Rate limits / pending | submission too soon after deploy | wait for confirmations, retry once |

## Honesty

- Verified only when the explorer says so and shows the source. Never before.
- Verification refused ⇒ report the address as **deployed, unverified**, with what you
  tried and the failure line above. The contract is live either way; hiding that is
  worse than saying it plainly.
- Never claim an explorer link as proof of verification without opening it — a link to a
  contract page with no verified source is an unverified contract.
