# SignalCollection: the contract and the two endpoints

Everything the skill compresses, in full: the constructor, every function, every error,
the art modes, the agent document every token carries, and the exact request/response
shapes of `GET /collections/artifact` and `POST /collections/prepare`.

The contract is one flat Solidity file with **no imports**. Published source, ABI and
creation bytecode all come from the artifact endpoint, so nothing here needs a compiler
to verify or a dependency tree to reconstruct.

## Constructor

Sixteen arguments, in this order. `POST /collections/prepare` ABI-encodes them for you;
this table is what the encoded bytes mean.

| # | Argument | Type | Rule |
| --- | --- | --- | --- |
| 0 | `name` | `string` | 1–64 characters, required; no `"`, `\` or control characters (it is written into JSON) |
| 1 | `symbol` | `string` | 1–16 letters/digits; prepare derives it from the name when absent |
| 2 | `owner` | `address` | The collection owner. Zero address ⇒ contract takes the deploying account (`msg.sender`) — fine for a direct wallet deploy, wrong through a factory |
| 3 | `maxSupply` | `uint256` | 1–1,000,000. Immutable |
| 4 | `mintPrice` | `uint256` | Wei per public mint; `0` = free mint. Mutable by the owner |
| 5 | `maxMintPerWallet` | `uint256` | 1–`maxSupply`. Immutable. Cumulative across a wallet's lifetime |
| 6 | `maxCreatorMints` | `uint256` | ≤ `maxSupply`. Immutable. Owner's free reserve; `0` = none |
| 7 | `baseURI` | `string` | Hosted art; empty ⇒ on-chain art. Must end with `/` — prepare appends it |
| 8 | `contractURI` | `string` | Collection-level metadata (OpenSea reads it); may be empty |
| 9 | `royaltyReceiver` | `address` | EIP-2981 receiver. Required when `royaltyBps > 0` |
| 10 | `royaltyBps` | `uint96` | 0–10000 (10000 = 100%). `0` disables royalties |
| 11 | `artStyle` | `uint8` | `0` creature, `1` mosaic, `2` horizon — only used when `baseURI` is empty |
| 12 | `artSeed` | `uint256` | Seed for the on-chain render; prepare derives one from the name when absent |
| 13 | `description` | `string` | The `description` in every token's agent document; empty ⇒ contract writes `An AI agent in the <name> collection.`. No `"`, `\` or control characters |
| 14 | `agentBaseURI` | `string` | Where each token's agent is served: endpoint = `<agentBaseURI><id>`. Empty ⇒ `"services": []`. No `"`, `\` or control characters |
| 15 | `artForm` | `uint8` | `0` blob, `1` round, `2` square, `3` tall, `4` diamond, `5` arch. The creature silhouette; `mosaic` and `horizon` ignore it |

`artForm` sits last on purpose, not by oversight. It was added after the other fifteen
were already in production, and solc 0.8.26's IR pipeline fails to compile this contract
with a second `uint8` anywhere earlier in the parameter list — a stack-too-deep failure
in the ABI encoder that no amount of refactoring moved. Appending it compiles; moving it
back to sit beside `artStyle` does not, so the odd ordering is load-bearing.

Reverts at construction: `ZeroSupply`, `ZeroWalletCap`, `CreatorCapAboveSupply`,
`UnknownArtStyle`, `UnknownArtForm` (form > 5), `InvalidRoyalty` (bps > 10000, or bps >
0 with a zero receiver), `InvalidMetadataString` (a name, description or agent base URI
that would break the metadata JSON).

The constructor is **not payable** — it takes no value, so the creation transaction
carries only gas.

## Read functions

No transaction needed; an agent can phrase any of these as "Read `f()` on `<address>`".

| Returns | Function |
| --- | --- |
| `string` | `name()`, `symbol()`, `baseURI()`, `contractURI()`, `agentDescription()`, `agentBaseURI()` |
| `address` | `owner()`, `royaltyReceiver()` |
| `uint256` | `totalSupply()`, `maxSupply()`, `mintPrice()`, `maxMintPerWallet()`, `maxCreatorMints()`, `creatorMinted()`, `artSeed()`, `minted(address)` |
| `uint8` | `artStyle()`, `artForm()` |
| `uint96` | `royaltyBps()` |
| `bool` | `mintPaused()` |
| `string` | `tokenURI(uint256)` — hosted `…/<id>.json`, or the on-chain metadata `data:application/json;base64,…` |
| `bytes` | `metadata(uint256 tokenId, string key)` — the ERC-8048 agent profile; empty bytes (`0x`) when unset, never reverts |
| `string[], uint8[]` | `traits(uint256 tokenId)` — the trait names and their numeric values for one token; reverts `ERC721NonexistentToken` for an id that was never minted |
| `address, uint256` | `royaltyInfo(uint256 tokenId, uint256 salePrice)` |
| `bool` | `supportsInterface(bytes4)` — `0x01ffc9a7`, `0x80ac58cd`, `0x5b5e139f`, `0x2a55205a`, `0xdf670be1` |
| `uint256`, `address` | `balanceOf(address)`, `ownerOf(uint256)` |
| `address`, `bool` | `getApproved(uint256)`, `isApprovedForAll(address, address)` |

## State-changing functions

| Call | Who | Value | Effect |
| --- | --- | --- | --- |
| `mint(quantity)` | anyone | **exactly** `mintPrice × quantity` | Public mint, ids sequential from 1. Checks in order: not paused, `1 ≤ quantity ≤ maxMintPerWallet`, supply fits, wallet's cumulative mints fit, exact payment |
| `mintToCreator(quantity)` | owner | none | Free mint against `maxCreatorMints`, drawn from the same `maxSupply` |
| `setBaseURI(uri)` | owner | — | Switches `tokenURI` to hosted mode — this is the reveal |
| `setContractURI(uri)` | owner | — | Collection metadata |
| `setAgentBaseURI(uri)` | owner | — | Repoints every token's RESTAP endpoint to `<uri><id>`; `InvalidMetadataString` if the URI would break the JSON. Empty string drops the `services` entry |
| `setAgentDescription(text)` | owner | — | Rewrites every token's document `description`; `InvalidMetadataString` on `"`, `\` or control characters |
| `setMintPrice(wei)` | owner | — | Reprice; caps never change |
| `setMintPaused(bool)` | owner | — | Halt/resume the public mint |
| `setRoyalty(receiver, bps)` | owner | — | EIP-2981 default royalty; `bps = 0` turns it off |
| `setMetadata(tokenId, key, value)` | token owner or approved operator | — | Writes one key of the ERC-8048 agent profile; emits `MetadataSet`. Reverts `ERC721InsufficientApproval` for a stranger, `ERC721NonexistentToken` for a token that was never minted |
| `setContext(tokenId, text)` | token owner or approved operator | — | `setMetadata(tokenId, "context", text)` — the canonical key, brackets cannot be missed |
| `setEndpoint(tokenId, scheme, uri)` | token owner or approved operator | — | `setMetadata(tokenId, "endpoint[<scheme>]", uri)` |
| `withdraw()` | owner | — | Entire balance to the owner |
| `transferOwnership(to)` | owner | — | `to` must not be the zero address |
| `transferFrom`, `safeTransferFrom` ×2, `approve`, `setApprovalForAll` | standard ERC-721 rules | — | Approvals cleared on transfer |

Supply counters are written **before** `_safeMint` calls into a receiver contract, so a
reentrant receiver sees the caps it just spent.

## Events

`Transfer`, `Approval`, `ApprovalForAll`, `OwnershipTransferred`, `Minted(minter, quantity)`,
`CreatorMinted(receiver, quantity)`, `BaseURIUpdated`, `ContractURIUpdated`,
`AgentBaseURIUpdated(agentBaseURI)`, `AgentDescriptionUpdated(agentDescription)`,
`MintPriceUpdated`, `MintPausedSet`, `RoyaltyUpdated`, `Withdrawn(to, amount)`,
`MetadataSet(tokenId, indexedKey, key, value)` (ERC-8048).

## Errors

| Error | When | Tell the user |
| --- | --- | --- |
| `WrongPayment(expected, sent)` | value ≠ `mintPrice × quantity` | Recompute from `mintPrice()`; there is no refund path |
| `PerWalletCapExceeded(cap)` | one order above the cap, or cumulative mints hit it | Read `minted(<address>)`; the cap is immutable |
| `SoldOut` | `totalSupply + quantity > maxSupply` | Read `totalSupply()` |
| `MintingIsPaused` | owner paused | Read `mintPaused()` |
| `CreatorCapExceeded(cap)` | reserve empty/zero | Read `creatorMinted()` |
| `NotOwner` | caller isn't the owner | Read `owner()` |
| `ZeroOwner` | `transferOwnership(0)` | Ownership cannot be renounced to zero |
| `InvalidMetadataString` | name, description or agent base URI carries `"`, `\` or a control character | Fix the field in prepare — a JSON string cannot carry them |
| `ZeroSupply` / `ZeroWalletCap` / `CreatorCapAboveSupply` / `UnknownArtStyle` / `UnknownArtForm` / `InvalidRoyalty` | constructor/royalty validation | Fix the field prepare named |
| `NothingToWithdraw` / `WithdrawFailed` | empty balance / rejected transfer | Check the balance or the owner's ability to receive |
| `ERC721InvalidOwner` | `balanceOf(0)` | — |
| `ERC721NonexistentToken` | id not minted | Ids start at 1 and exist only after mint |
| `ERC721IncorrectOwner` | `transferFrom` from the wrong owner | Read `ownerOf(id)` |
| `ERC721InsufficientApproval` | caller not owner/approved/operator | Read `getApproved(id)` |
| `ERC721InvalidApprover` | `approve` to self or by non-authorized | — |
| `ERC721InvalidOperator` | `setApprovalForAll(0, …)` | — |
| `ERC721InvalidReceiver` | transfer/mint to zero, or a contract that rejects ERC-721 | — |

## Art modes

**Hosted (constructor `baseURI` non-empty).**
`tokenURI(id) = baseURI + id + ".json"` — files must be `1.json`, `2.json`, … under the
base URL, and each file must be the document below, because that is what is
fetched from the URL. Any `http`, `https` or `ipfs` base works. `setBaseURI` switches a
live contract into (or out of) hosted mode, which is how a reveal is done.

**On-chain (`baseURI` empty).** The contract renders a 16×16 mirrored pixel image and
wraps it in the token's document (below); the image is the `image` field,
still a `data:image/svg+xml;base64,…` URI. Colour and texture traits come from
`keccak256(artSeed, tokenId)`, so a token always renders the same bytes. Colour is
computed as integer HSL — identical on every chain and compiler patch level.

`artStyle` picks the world the collection lives in; `artForm` picks the shape of the
subject inside it. They answer different questions, which is why both exist: every
creature token shares one face — same eyes, same mouth, one of four extras — so the
outline is the only thing that tells two creature collections apart.

| `artStyle` | Name | Composition |
| --- | --- | --- |
| 0 | creature | Complementary ground, a body whose outline is `artForm`, pattern (plain/stripes/spots), 2×2 eyes with pupil, mouth, and one of four extras: antenna, horns, ears, none |
| 1 | mosaic | Four hues of one palette over a dark ground, per-cell hash scatter with gaps |
| 2 | horizon | Gradient sky, centre sun, scattered stars, ground with a lit edge and a centre hill |

| `artForm` | Name | Outline |
| --- | --- | --- |
| 0 | blob | A wide oval — the shape every creature collection drew before this existed |
| 1 | round | A circle |
| 2 | square | A blocky head with hard corners |
| 3 | tall | A narrow vertical capsule |
| 4 | diamond | A rhombus, widest across the middle |
| 5 | arch | A domed top over a flat foot |

`mosaic` and `horizon` ignore `artForm` entirely — they compose a scene rather than a
body — so passing one there is harmless but means nothing. Every outline keeps rows 5 to
11 of the grid, which is exactly where the eyes and the mouth are drawn, so the face
furniture is never left floating off the body it belongs to.

Mirroring: a cell's colour depends only on its distance from the vertical axis, so both
halves are always identical.

## The agent document (ERC-721 metadata + RESTAP)

In on-chain mode `tokenURI(id)` is `data:application/json;base64,<document>`, and the
document is the contract's own ERC-721 metadata, carrying the token's service entry:

```json
{
  "name": "Nova Nodes #7",
  "description": "Nova Nodes — agent NFT collection.",
  "attributes": [{ "trait_type": "style", "value": "creature" }],
  "image": "data:image/svg+xml;base64,…",
  "services": [
    { "name": "RESTAP", "endpoint": "https://agents.example.com/nova/7", "version": "0.1.4-beta" }
  ]
}
```

- The document carries **no ERC-8004 `type` field**, and that is deliberate. A marketplace
  that sees `#registration-v1` treats the token as an agent registration and renders that
  document's own `active` / `x402Support` flags *in place of* `attributes`, so the traits
  are read but never listed. Observed directly on a marketplace that indexes both shapes:
  the `registration-v1` collection showed only `Active` and `x402 Support`, while a
  collection serving plain ERC-721 metadata with an identical agent layer showed all of
  its art traits. The agent layer is the ERC-8048 profile below, which is read straight
  from the contract instead of inferred from this document.
- `name` is `<collection name> #<id>`; `attributes[0]` carries the art style by name.
- `attributes` is written **before** `image`, so a reader that caps how much of a
  response it parses still reaches the traits — the SVG data URI is the largest field.
- `services` is `[{ name: "RESTAP", endpoint: "<agentBaseURI><id>", version: "0.1.4-beta" }]`
  when an `agentBaseURI` was set, and `[]` otherwise — an endpoint is only ever claimed
  when one exists. RESTAP clients append `/.well-known/restap.json`, `POST /talk` and
  `GET`/`POST /news` to that endpoint.
- The description falls back to `An AI agent in the <name> collection.` while none is set.
- The three strings involved (`name`, `description`, `agentBaseURI`) are validated at
  construction and by `setAgent*`: no `"`, no `\`, no control character, so the JSON is
  always well-formed without an escape step.

## The agent profile (ERC-8048 / ERC-721T)

The metadata document is what a marketplace fetches; the profile is what a contract
reader sees with no HTTP call. The contract implements [ERC-8048](https://eips.ethereum.org/EIPS/eip-8048)
as [ERC-721T](https://github.com/nxt3d/721t) spells it out: interface id `0xdf670be1`,
`metadata(tokenId, key) → bytes`, and a `MetadataSet` event carrying both the raw and the
indexed key.

**Reading.** `metadata(id, key)` returns the stored bytes and never reverts: an unset key
is `0x`, and a token that was never minted reads `0x` too, so a tool probing a range of
ids cannot be bricked by a single missing token. Two keys answer from the
collection-level agent fields when nothing was written per token, which is what makes the
profile automatic on every mint:

| Key | Answer | Empty case |
| --- | --- | --- |
| `context` | `agentDescription`, or `An AI agent in the <name> collection.` | never — a live token always has a context |
| `endpoint[restap]` | `<agentBaseURI><id>` | no `agentBaseURI` was ever set ⇒ `0x` |

**Writing.** `setMetadata(id, key, value)` stores raw bytes and emits `MetadataSet`.
Keys are lowercase and case-sensitive; the reserved set is `context`, `endpoint[mcp]`,
`endpoint[a2a]`, `endpoint[web]` and `address[<chain-id>]` (the value is the 20 raw
address bytes, not a hex string) — any other `endpoint[<scheme>]` is valid too.
`setContext(id, text)` and `setEndpoint(id, scheme, uri)` build the canonical key. Only
the token's owner or an approved operator may write — the same authority as moving the
token, because the profile is the agent's identity. A stranger reverts
`ERC721InsufficientApproval`; an id that was never minted reverts `ERC721NonexistentToken`.

Reading it back: `cast call <address> "metadata(uint256,string)(bytes)" 7 "endpoint[restap]"`,
or viem/ethers `readContract` with the same signature. The value is bytes — decode with
`cast parse-bytes32-string` or `TextDecoder`, not as an address.

## Traits

`traits(id)` and the document's `attributes` answer from the same hash, so the words a
marketplace shows and the pixels the contract draws cannot drift apart.

```ts
const [names, values] = await readContract({ // string[], uint8[]
  functionName: "traits", args: [tokenId],
});
```

One table per art style, sized to what the style genuinely varies — seven rows for
creature, five for the other two, because a fixed-size table would have had to invent
rows that mean nothing:

| Style | Rows |
| --- | --- |
| `creature` (0) | `background`, `body`, `pattern`, `eyes`, `mouth`, `accessory`, `form` |
| `mosaic` (1) | `background`, `primary`, `accent`, `tile`, `density` |
| `horizon` (2) | `sky`, `sun`, `ground`, `star`, `cloud` |

`form` is the one row every token in a collection shares: it mirrors the `artForm` the
collection was deployed with, because the silhouette is a decision about the collection
rather than a roll per token. Everything else is per token.

Colour rows are one of twelve named hue bands: `red`, `orange`, `yellow`, `chartreuse`,
`green`, `spring`, `cyan`, `azure`, `blue`, `violet`, `magenta`, `rose`. Each other row
is its axis's own vocabulary, and a value outside a table reads as the empty string
rather than as a neighbouring word it was never given:

| Row | Values |
| --- | --- |
| `pattern` | `plain`, `striped`, `dotted` |
| `eyes` | `round`, `wide`, `narrow`, `bright` |
| `mouth` | `thin`, `small`, `wide`, `open` |
| `accessory` | `none`, `antenna`, `horns`, `ears` |
| `form` | `blob`, `round`, `square`, `tall`, `diamond`, `arch` |
| `tile` | `fine`, `banded`, `coarse`, `blocky` |
| `density` | `dense`, `balanced`, `airy` |
| `star` | `few`, `some`, `many` |
| `cloud` | `none`, `wisp`, `drift`, `bank` |

The same rows appear in the ERC-8004 document as `attributes`, in words, `style` first:

```json
"attributes": [
  { "trait_type": "style", "value": "creature" },
  { "trait_type": "background", "value": "azure" },
  { "trait_type": "eyes", "value": "narrow" }
]
```

None of it is decoration: `tile` and `density` really coarsen the mosaic sampling,
`star` and `cloud` really scatter the sky and lay the cloud band, and `eyes` and `mouth`
really change the creature's face. A row that stopped describing the pixels would fail
the collection's own tests.

## GET /collections/artifact

Free, `GET` or `HEAD`, `Cache-Control: public, max-age=300`, CORS `*`.

| Field | Content |
| --- | --- |
| `contract` | `"SignalCollection"` |
| `sourceName` | `contracts/SignalCollection.sol` |
| `source` | The complete source file — byte-identical to the repository's |
| `compiler.version` / `compiler.longVersion` | `0.8.26` / `0.8.26+commit.8a97fa7a` |
| `compiler.settings` | `{ optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "paris" }` |
| `abi` | Full ABI, including the constructor |
| `constructorInputs` | Constructor parameter list (what `prepare` encodes against) |
| `creationBytecode` | `0x…` — 26,403 bytes of deploy code |
| `deployedBytecodeSize` | `23208` — runtime under the 24,576-byte code-size limit |

Status: `200` · `405` (other methods) · `503` `{ error: "Collection artifact not built" }`
when the artifact has not been built.

## POST /collections/prepare

Free, `POST` only, body `application/json`, `Cache-Control: no-store`, CORS `*`.

### Request

| Field | Type | Required | Default / rule |
| --- | --- | --- | --- |
| `name` | string | yes | 1–64 chars; no `"`, `\` or control characters |
| `symbol` | string | no | first 4 letters/digits of the name, uppercased (`"Nova Nodes"` → `NOVA`) |
| `owner` | `0x` address | no* | zero ⇒ contract takes `msg.sender`; *required in practice when deploying through a factory, and required if you want royalties without naming a receiver |
| `chainId` | integer ≥ 1 | no | echoed back so the deploy is checked against it |
| `maxSupply` | integer or string | yes | 1–1,000,000 |
| `mintPriceEth` | decimal string | no | e.g. `"0.001"`; ignored if `mintPriceWei` is present |
| `mintPriceWei` | integer or string | no | `0` |
| `maxMintPerWallet` | integer or string | no | `maxSupply` |
| `maxCreatorMints` | integer or string | no | `0` |
| `baseURI` | URL | no | must start `http://`, `https://` or `ipfs://`; trailing `/` appended |
| `contractURI` | URL | no | same schemes, no trailing rule |
| `description` | string | no | `"<name> — agent NFT collection."`; ≤ 512 chars; no `"`, `\` or control characters |
| `agentBaseURI` | URL | no | same schemes as `baseURI`, trailing `/` appended; the endpoint each token declares |
| `royaltyReceiver` | `0x` address | no | defaults to `owner`; with neither, a nonzero `royaltyBps` is a `400` |
| `royaltyBps` | integer or string | no | `500` (5%); 0–10000 |
| `artStyle` | `0`–`2` or `creature` / `mosaic` / `horizon` | no | `0` — only used in on-chain mode |
| `artForm` | `0`–`5` or `blob` / `round` / `square` / `tall` / `diamond` / `arch` | no | `0` — creature only; `mosaic` and `horizon` ignore it |
| `artSeed` | integer or string | no | derived from `keccak256(name)` so the same request always deploys the same art |

### Response (`200`)

```jsonc
{
  "ok": true,
  "contract": "SignalCollection",
  "chainId": 4663,                       // or null when none was given
  "creationBytecode": "0x…",
  "constructorArgs": "0x…",              // the 16 arguments, ABI-encoded
  "deployData": "0x…",                   // creationBytecode + constructorArgs
  "params": {                            // echo of everything encoded — read it back
    "name": "Nova Nodes",
    "symbol": "NOVA",
    "owner": "0x…",                      // or null + ownerNote when not given
    "ownerNote": "…",
    "maxSupply": "2222",
    "mintPrice": { "wei": "1000000000000000", "eth": "0.001" },
    "maxMintPerWallet": "20",
    "maxCreatorMints": "20",
    "contractURI": "",
    "description": "Nova Nodes — agent NFT collection.",
    "agent": { "baseURI": "https://agents.example.com/nova/", "endpoint": "https://agents.example.com/nova/<id>" },
    "royalty": { "receiver": "0x…", "bps": "500" },
    "art": {
      "mode": "onchain",
      "baseURI": null,
      "style": 0,
      "styleName": "creature",
      "form": 2,
      "formName": "square",
      "seed": "…"
    }
  },
  "compiler": { /* as the artifact */ },
  "verify": {
    "compiler": "0.8.26+commit.8a97fa7a",
    "optimizerRuns": 200,
    "evmVersion": "paris",
    "viaIR": true,
    "constructorArgs": "0x…",
    "sourceAt": "https://api.signalbound.art/collections/artifact — field `source`"
  },
  "artifactUrl": "https://api.signalbound.art/collections/artifact"
}
```

`params.agent.baseURI` and `params.agent.endpoint` are `null` when no `agentBaseURI`
was passed. `params.art.form` and `params.art.formName` are `null` when a `baseURI` was
passed, or when `artStyle` is not `creature` — the echo declines to report a silhouette
that will not be drawn rather than implying a request was honoured.

### Status codes

| Code | Body | Meaning |
| --- | --- | --- |
| `200` | as above | ready to deploy |
| `400` | `{ error, field }` | the named field failed validation; fix exactly that field |
| `400` | `{ error: "Body must be valid JSON" }` | unparseable body |
| `405` | `{ error }` + `Allow: POST` | not a `POST` |
| `503` | `{ error: "Collection artifact not built", build: … }` | our side has not published the bytecode — never substitute another contract |

## Limits

| Thing | Limit |
| --- | --- |
| Name / symbol | 64 chars / 1–16 letters+digits |
| `description` | 512 chars; no `"`, `\` or control characters |
| `agentBaseURI` | optional http/https/ipfs URL; trailing `/` appended |
| `maxSupply` | 1–1,000,000 |
| `maxMintPerWallet` | 1–`maxSupply`, cumulative |
| `maxCreatorMints` | ≤ `maxSupply` |
| Royalty | 0–10000 bps, receiver required above 0 |
| `mintPrice` | < 1,000,000 ETH (sanity ceiling) |
| Art styles | 0, 1, 2 |
| Art forms | 0, 1, 2, 3, 4, 5 — creature only, ignored otherwise |
| Creation code | 27,045 bytes (≈54 KB hex) |
| Runtime code | 23,705 bytes / 24,576 limit |
