# Deploying a SignalCollection

How the creation transaction actually goes out, in four shapes, and how to prove it
happened. The skill abridges this; this is the whole thing.

## The shape of a creation transaction

| Property | Value |
| --- | --- |
| `to` | **none** — this is a contract creation, not a call |
| `data` | `deployData` = `creationBytecode` + `constructorArgs` (both from `POST /collections/prepare`) |
| `value` | **none** — the constructor is not payable; there is nothing to send |
| gas | paid by the deployer wallet on the target chain |
| from | the wallet that will also appear as `msg.sender` — but ownership comes from constructor argument 2, not from `msg.sender` |

Two failure modes follow directly: a route that requires a `to` cannot carry this
transaction, and a factory that deploys it without passing `owner` becomes the owner.

Before signing anything, read the `params` echo back from prepare and compare it with
what the user asked for: name, symbol, supply, price, caps, royalty, chain, owner. That
echo is the receipt you agree to in advance.

## Shape 1 — Bankr (chat)

Ask in one message, passing the three values prepare returned:

> Deploy an NFT collection contract from this compiled creation bytecode, no value
> attached, on chain 4663: creation bytecode `<creationBytecode>`, ABI-encoded
> constructor arguments `<constructorArgs>`. Deploy through your CREATE2 deployer.

What Bankr does with that, from its own capability notes: creation bytecode comes from a
file in Bankr file storage or inline hex, goes through a deterministic CREATE2 deployer,
constructor arguments are passed ABI-encoded (which is exactly the shape prepare
returns), an optional salt fixes the address, and **no native value can be attached** —
which matches a non-payable constructor.

Our creation bytecode is ~21.6 KB (≈43 KB of hex). If inline hex is refused as too long,
save the artifact JSON to file storage first and reference the file instead.

**Not this:** `POST /wallet/submit` with an `EvmTransaction` — its schema requires `to`,
so it can only move, call or approve, never create. If someone proposes submitting a
creation that way, the request is malformed by definition.

After Bankr returns an address, still do Shape 4's read-back: a returned address is a
claim until `owner()` and the rules agree with the request.

## Shape 2 — viem / ethers (your own tooling)

```js
import { deployContract } from "viem/actions"; // or ethers.ContractFactory
import { artifact, prepared } from "./pack.js"; // GET artifact + POST prepare

const address = await deployContract(client, {
  abi: artifact.abi,
  bytecode: prepared.creationBytecode,
  args: decodeAbiParameters(artifact.constructorInputs, prepared.constructorArgs),
  account: deployer,
  chain,
});
```

Raw-transaction equivalent, when the stack only accepts unsigned transactions: omit `to`,
set `data` to `deployData`, leave value empty, sign and send on `chainId`.

## Shape 3 — a chain CLI

```bash
# cast: raw creation data, nothing to decode
cast create --rpc-url "$RPC_URL" --private-key "$KEY" --create --data "$DEPLOY_DATA"

# forge: from the published source (single file, no imports to fetch)
forge create contracts/SignalCollection.sol:SignalCollection \
  --rpc-url "$RPC_URL" --private-key "$KEY" \
  --constructor-args "$NAME" "$SYMBOL" "$OWNER" "$MAX_SUPPLY" "$MINT_PRICE" \
    "$MAX_PER_WALLET" "$CREATOR_MINTS" "$BASE_URI" "$CONTRACT_URI" \
    "$ROYALTY_RECEIVER" "$ROYALTY_BPS" "$ART_STYLE" "$ART_SEED" \
    "$DESCRIPTION" "$AGENT_BASE_URI" "$ART_FORM" \
  --evm-version paris --optimizer-runs 200
```

The private key never leaves the machine running the command. It is never pasted into a
chat, an endpoint, or a request body.

## Shape 4 — confirm it happened

An HTTP `200` means a transaction you may have sent, not one that landed. All four:

1. **Receipt** — status success on `chainId`, contract address = the one reported.
2. **Ownership** — `owner()` equals the user's wallet. If a factory took it, stop and
   say so; redeploy passing `owner`, do not paper over it with a silent
   `transferOwnership` the user did not ask for.
3. **Rules** — `name()`, `symbol()`, `totalSupply()` (0), `maxSupply()`, `mintPrice()`,
   `maxMintPerWallet()`, `maxCreatorMints()`, `baseURI()` or `artStyle()` and
   `artForm()`, `agentBaseURI()`, `agentDescription()`, `royaltyBps()` match `params`.
   `artForm()` is the one that decides whether the collection looks like the subject the
   user asked for, so read it rather than assuming prepare passed it through.
4. **Verification** — see `verification.md`. Unverified is a real state to report, not
   a detail to skip.

Then report: address, explorer link, verification status, and the mint instruction —
price per mint, supply, per-wallet cap, creator reserve.

## After the deploy

| Goal | Call |
| --- | --- |
| Give users mint instructions | `mint(quantity)` with exactly `mintPrice × quantity` |
| The owner keeps a reserve | `mintToCreator(quantity)` while `creatorMinted < maxCreatorMints` |
| Reveal hosted art later | owner: `setBaseURI("https://…/")` once `1.json`, `2.json`, … exist |
| Point tokens at the agents | owner: `setAgentBaseURI("https://agents…/")` — endpoint becomes `<uri><id>` |
| Rewrite what each registration says | owner: `setAgentDescription("…")` |
| Change the price | owner: `setMintPrice(wei)` |
| Stop minting | owner: `setMintPaused(true)` |
| Turn royalties down or off | owner: `setRoyalty(receiver, 0)` |
| Take proceeds | owner: `withdraw()` |
| Hand the collection over | owner: `transferOwnership(to)` |

The caps (`maxSupply`, `maxMintPerWallet`, `maxCreatorMints`) are immutable. A user
asking for a different supply after deploy is asking for a new contract.

## Deploy failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| Route refuses the transaction: `to` required | creation sent through a call-only route | use the deploy capability (Shape 1) or tooling (Shapes 2–3) |
| Deployed, but `owner()` is a factory | `owner` was not passed | redeploy with constructor argument 2 = the user's wallet |
| Deployed on the wrong chain | `chainId` ignored | prepare echoes `chainId`; check before signing |
| Out of gas / insufficient funds | deployer pays gas | the wallet needs the chain's native token |
| Explorer shows no contract | not deployed, or not yet indexed | re-check the receipt first; index later |
| `deployData` rejected as malformed | bytecode and arguments not concatenated | use prepare's `deployData`, do not re-join the pieces yourself |
| Contract creation reverts | a constructor rule failed (see `collection.md`) | decode the revert: it names the rule |
