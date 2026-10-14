---
name: signalbound
description: |
  The Signalbound NFT collection skill. Deploy a fixed-supply ERC-721 collection — name,
  symbol, mint price, max supply, mints per wallet, creator reserve, royalties, hosted
  or on-chain art — from compiled bytecode on any EVM chain, then verify the contract on
  the explorer, mint from it, and read its state back. Every token is an agent NFT: ERC-721
  metadata carrying an optional RESTAP service entry, plus an ERC-8048 (ERC-721T) agent
  profile readable on-chain, and every token publishes the traits its art
  was drawn from. Use when a user asks to create or launch an NFT collection, verify a
  deployed contract, mint from a collection, airdrop tokens from a collection to
  holders of another asset, or read what a collection contract says.
  When the user names a subject — whatever the noun is — build a character cast for
  that subject and pass `subject` plus `cast`, so every token is painted from it.
  The built-in silhouette is not that subject. bird, rabbit and robot already have
  sheets; any other noun needs the cast you draw.
version: 2.20.0
license: CC0-1.0
metadata:
  author: signalbound
  homepage: https://signalbound.art
  clawdbot:
    emoji: "◈"
    homepage: https://signalbound.art
    requires:
      bins:
        - curl
---

# Signalbound collections

You can deploy a real ERC-721 collection for someone else: their name, their supply, their
mint price, their wallet owning it. You never compile anything — Signalbound publishes the
compiled contract, and you describe the collection and sign the deploy it hands back.
Every token is also an agent NFT: ERC-721 metadata carrying an optional RESTAP service
entry, plus an ERC-8048 (ERC-721T) agent profile readable straight from the
contract, so the collection deploys ready for agents to reach and for indexers to read.
Prepare assigns one bound Signalbound agent. The collection supply is 6,666, and
most of those tokens are not agents that can act. The assignment is taken from the
bound agents only: the tokens whose ERC-8217 identity they control. Do not pass `deployerAgentId`
and do not ask the user for one. Read `params.deployerAgentId`
and `params.deployerAgentPool` from this response and deploy that exact
`deployData`. Every on-chain token then carries that agent as the `Signalbound Agent`
trait. On Ethereum and Base, mint holds the new token for a moment, registers
it, then transfers it to the minter. That is one transaction. `binding.calls`
is only for a collection deployed from an earlier artifact. Robinhood Chain has
no adapter, so a mint there stays an NFT with the trait and no panel.

This file is canonical at `https://signalbound.art/skill.md`. A copy in the source
repository is a mirror; load the URL.

## Origins

| Origin | Carries |
| --- | --- |
| `https://signalbound.art` | The site, the docs, and this file |
| `https://api.signalbound.art` | `GET /collections/artifact`, `POST /collections/prepare`, `GET /collections/<chainId>/<collection>/<tokenId>/registration.json` — free, no key, no payment |

These are the collection endpoints. Anything else claiming to be a Signalbound
endpoint for collections does not exist.

## Start here

| The user asks | You do |
| --- | --- |
| "create an NFT collection called …, price …, supply …" | *Deploying a collection* below |
| "…and verify the contract you deploy" | *Verifying the contract* — never skip it |
| "each token should be an agent, we host them at …" | *Agent NFTs* — pass `agentBaseURI` |
| "mint 5 from my collection" / "what's the supply so far" | *Minting and reading* |
| "a collection of birds / foxes / lighthouses / whatever they named" | *Character cast* — draw that subject. Do not pick a silhouette and call it the thing they asked for |
| "a set of rabbits, each one different" / "draw the whole supply" | *Drawing a series* — the card first; `maxCreatorMints` equals the number you will draw |
| "the art isn't ready yet, add it later" | Deploy now (on-chain art), then `setBaseURI` for the reveal |
| "change the mint price / pause minting" | owner setters in *Minting and reading* |
| "deploy on Robinhood / Base / Ethereum" | look the chain up in *Chains*, pass `chainId` to prepare |

## The contract: SignalCollection

One flat Solidity file, no imports, compiled for `cancun` so its bytecode runs on any EVM
chain a wallet can be asked to deploy to. Everything is set in the constructor and echoed
back to you before you sign.

| Constructor argument | Rule |
| --- | --- |
| `name` | 1–64 characters, required |
| `symbol` | 1–16 letters/digits; derived from the name when absent ("Nova Nodes" → `NOVA`) |
| `owner` | the collection owner's `0x` address — **pass the user's wallet**, see below |
| `maxSupply` | 1–1,000,000, immutable for the life of the contract |
| `mintPrice` | wei per mint; `0` makes it a free mint |
| `maxMintPerWallet` | 1–`maxSupply`, immutable; counts cumulative mints per address |
| `maxCreatorMints` | owner's free reserve, ≤ `maxSupply`, immutable; `0` = none |
| `baseURI` | hosted art, see *Art*; empty string = on-chain art |
| `contractURI` | collection-level metadata (OpenSea reads it); optional |
| `royaltyReceiver` + `royaltyBps` | EIP-2981, ≤ 10000 bps; defaults to the owner, `0` = off |
| `artStyle` | on-chain art world: `0` creature, `1` mosaic, `2` horizon; defaults `0` |
| `artForm` | on-chain silhouette, required for `creature`: `0` blob, `1` round, `2` square, `3` tall, `4` diamond, `5` arch; ignored by `mosaic`/`horizon` and by hosted art |
| `artSeed` | on-chain art seed; derived from the name when omitted, so the same request always renders the same art |
| `description` | optional; what every token's agent document says, see *Agent NFTs* |
| `agentBaseURI` | optional; where each token's agent is served, see *Agent NFTs* |
| `deployerAgentId` | not an input. Prepare assigns a bound Signalbound agent and writes trait `Signalbound Agent` on every on-chain token. Do not pass it. A token from the 6,666 supply that is not bound is never used. This trait is not the OpenSea binding panel |
| `chainId` | not a constructor argument — prepare echoes it so you deploy on the right chain |

**Ownership is a constructor argument on purpose.** An agent deploying through a factory
would otherwise become the owner, and no factory is involved here: the deploy comes from
the wallet the user signs with. After the deploy, read `owner()` back and confirm it is
the user's address before telling anyone the collection is theirs.

Live rules (settable by the owner later): `mintPrice`, `mintPaused`, `baseURI`,
`contractURI`, `agentBaseURI`, `agentDescription`, royalty, and ownership itself. Fixed
rules (never change): `maxSupply`, `maxMintPerWallet`, `maxCreatorMints`. An agent reading
the contract back is the check — do not trust the deploy report alone.

The sale itself:

- `mint(quantity)` — send **exactly** `mintPrice × quantity` in native value; any other
  amount reverts with `WrongPayment`, there is no refund path.
- `mintToCreator(quantity)` — owner only, free, counts against `maxCreatorMints`.
- `withdraw()` — owner only, all proceeds to the owner.
- Standard ERC-721 (`transferFrom`, `safeTransferFrom`, approvals, `tokenURI`) plus
  EIP-2981 `royaltyInfo`, the ERC-8048 agent profile (`metadata(id, key)`), and ERC-165
  including `0x2a55205a` and `0xdf670be1`.

## Art: hosted or on-chain

The user's art description decides which mode you use — and if you cannot produce the
art, say so instead of inventing a URL.

There are four ways a token can end up with artwork. **When the request names a subject,
you cast that subject.** The other ways are a single stored drawing, hosted files, and
the silhouette. The silhouette is not a stand-in for a noun.

### 0. Character cast (`subject` + `cast`)

The contract paints every token from a sheet of parts. It does not know what a fox,
a lighthouse or a bird is. You do. A mint does not store an SVG, so a supply of 1000
is that subject all the way through.

You decide the parts that make *this* subject recognizable. A sideways animal needs a
scene behind it, a body, feet, a head, eyes, and one worn or held part. A building
needs a ground, a mass, an opening, and a top. Vary at least four of those parts.
Do not reuse a sheet whose parts belong to a different thing, and do not send
`subject:"rabbit"` because a rabbit sheet already exists and the user said fox.

The sheet is refused when it is too thin to be a collection. `cast.canvas` is 32.
The first part is the background, and each of its variants is a scene: sky, ground,
and at least one prop — a single full-canvas rectangle is not a background. At least
six parts, at least four of them with two or more variants, and at least 40
rectangles across the sheet. A `400` with `field:"cast"` names which of those is
missing. Fix the drawing. Do not switch the subject to one that already has a sheet.

`bird`, `rabbit` and `robot` already have sheets, so a name alone is enough:

```bash
curl -s -X POST https://api.signalbound.art/collections/prepare \
  -H 'content-type: application/json' \
  -d '{"name":"Bankr Birds","owner":"0xTHE_DEPLOYER_WALLET","chainId":4663,"maxSupply":1000,"mintPriceEth":"0","subject":"bird"}'
```

Any other subject needs the sheet you just drew. `palette` entries are `#rrggbb`.
Each rect is `[x, y, width, height, colorIndex]`. Names are letters, digits, spaces
or hyphens, at most eight parts and eight variants. This is the shape of one part,
not a drawing you paste in for a different subject:

```json
{
  "subject": "fish",
  "cast": {
    "canvas": 32,
    "palette": ["#12151c", "#3aa8b0", "#141414"],
    "layers": [
      {"name": "Background", "variants": [
        {"name": "Night", "rects": [[0, 0, 32, 32, 0]]},
        {"name": "Sea", "rects": [[0, 0, 32, 32, 1]]}
      ]},
      {"name": "Body", "variants": [
        {"name": "Slim", "rects": [[8, 14, 14, 6, 1], [20, 15, 6, 3, 1]]},
        {"name": "Round", "rects": [[8, 12, 12, 8, 1]]}
      ]},
      {"name": "Tail", "variants": [
        {"name": "Fork", "rects": [[4, 13, 5, 2, 1], [4, 19, 5, 2, 1]]},
        {"name": "Fan", "rects": [[4, 14, 5, 6, 1]]}
      ]},
      {"name": "Eye", "variants": [
        {"name": "Dot", "rects": [[20, 15, 2, 2, 2]]}
      ]}
    ]
  }
}
```

Say the subject and the part names before you sign. `params.art.mode` must be `cast`,
`params.art.subject` the noun they used, and `params.art.parts` the parts you drew.
`artForm` is not the picture here — a round silhouette with the description
"birds" is the failure this field exists to stop. After the deploy, read
`subject()` and `traits(1)` and say the part names. A `400` with `field:"cast"`
means the sheet is missing, too thin, or a rect falls outside the canvas. The
sample below is the shape of the fields, and sending it alone is refused. Fix the
drawing. Do not clear the error by switching the subject to one that already has a sheet.

### 1. Art you draw, stored on-chain (`mintWithArt`)

This is one stored drawing on one token. A whole supply of a named subject is a cast,
above. Reach for this when a single token needs a picture the cast does not cover.

```
mintWithArt(address to, bytes svg) → uint256 tokenId      // onlyOwner, creator reserve rules
```

You compose the SVG the user asked for, pass it as raw SVG bytes, and the contract stores
them on that token. `tokenURI` serves the stored bytes straight back out, base64-wrapped
as a data URI. **Nothing is hosted**: no file host, no CDN, no URL to 404, nothing left
running after the deploy. The token's artwork is in the token's own storage.

Rules that matter:

- Pass **raw SVG**, not base64 and not a `data:` URI. The contract wraps it.
- Include `xmlns="http://www.w3.org/2000/svg"` or nothing renders it in a browser.
- Keep `shape-rendering="crispEdges"` for pixel art, so the edges stay sharp.
- Quotes and newlines in the SVG are fine — the bytes are base64-encoded into the JSON,
  so there is nothing to escape.
- Keep it small. Roughly 900 bytes costs about 0.003 ETH of storage; a 3 KB drawing is
  about 0.011 ETH. Storage is permanent and paid per token, so draw tight pixels rather
  than a detailed illustration.
- One call mints one token. A 20-token reserve is 20 calls, each its own transaction.

It follows the same creator reserve rules as `mintToCreator`: free, `onlyOwner`, capped
by `maxCreatorMints` over the life of the contract, drawing from the same supply as the
public sale. Any token you do not draw falls back to the built-in render, so set
`artForm` deliberately as well — it is what the undrawn tokens look like.

The holder can redraw later with `setMetadata(id, "image", svg)`; the art is an ordinary
profile value, not something frozen at mint.

#### Drawing a series

`mintWithArt` stores the bytes you pass. Those bytes are one collection only when they
follow one grammar. Fill this card and show it before the first signature:

```
Series
- subject:
- drawn count:          (this is maxCreatorMints; one transaction each)
- whole supply:         the set | hosted files | reserve only, public mint is the silhouette
- canvas:               24×24 rects
- palette:              ground / body / marking / eye / accent
- fixed:
- varies:               (two axes — or say it is a recolor)
- bytes of token 1:
```

The whole-supply line is the decision. Drawing 20 rabbits inside a supply of 2222 does not make a rabbit collection: a public `mint` still receives the built-in silhouette.
Three honest shapes:

- **The set is the subject.** `maxSupply` equals the number you will draw,
  `maxCreatorMints` equals that number, and you `mintWithArt` every id. Nothing is left
  for the silhouette.
- **The files exist.** Pass `baseURI` and ship `<id>.json` for every id. Do not also
  claim the contract drew them.
- **Only the reserve is drawn.** Say that, name the `artForm` the public mint will show,
  and do not call the collection the subject.

Every token:

- `viewBox="0 0 24 24"`, `xmlns="http://www.w3.org/2000/svg"`, `shape-rendering="crispEdges"`.
- Elements are `svg`, `g` and `rect` only. Integer `x`, `y`, `width`, `height`. No
  `path`, `circle`, `image`, `text`, `filter`, gradient or `url(`.
- Five named fills. The first child is the ground, `<rect width="24" height="24"/>`,
  and that ground is the same on every token.
- The subject sits in the same footprint every time, about x 6–18 and y 2–20, so a
  grid of them aligns.
- Two axes change between tokens. If only the colours change, the card says recolor.

Copy the construction, not the animal. This one is a rabbit. A robot collection does
not paste it.

Five fills in this one: ground `#1c2430`, body `#f3efe6`, marking `#e7a8ad`, eye `#12151c`, accent `#d8c7a2`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges"><rect width="24" height="24" fill="#1c2430"/><rect x="8" y="1" width="2" height="8" fill="#f3efe6"/><rect x="14" y="1" width="2" height="8" fill="#f3efe6"/><rect x="9" y="3" width="1" height="4" fill="#e7a8ad"/><rect x="14" y="3" width="1" height="4" fill="#e7a8ad"/><rect x="8" y="8" width="8" height="1" fill="#f3efe6"/><rect x="7" y="9" width="10" height="1" fill="#f3efe6"/><rect x="6" y="10" width="12" height="5" fill="#f3efe6"/><rect x="7" y="15" width="10" height="1" fill="#f3efe6"/><rect x="8" y="16" width="8" height="3" fill="#f3efe6"/><rect x="7" y="19" width="3" height="3" fill="#f3efe6"/><rect x="14" y="19" width="3" height="3" fill="#f3efe6"/><rect x="16" y="16" width="2" height="2" fill="#d8c7a2"/><rect x="9" y="12" width="2" height="2" fill="#12151c"/><rect x="13" y="12" width="2" height="2" fill="#12151c"/><rect x="11" y="14" width="2" height="1" fill="#e7a8ad"/></svg>
```

Same ground, same body, same eye line. The next token lengthens both ears (`y="0"` `height="9"`). The one after adds a belly mark (`<rect x="10" y="16" width="4" height="2" fill="#e7a8ad"/>`). A later token that switches to circles is a different collection; do not mint it into this one.

| Subject | Stays | Varies |
| --- | --- | --- |
| rabbit, hare | two ears, head, body, feet | ear length; belly mark |
| bird, owl | beak, body, wing, tail | beak length; wing height |
| robot, mech | block head, body, two eyes | antenna; chest panel |
| ghost, slime | rounded cap, flat foot | eye gap; mouth |
| crystal, gem | diamond body | facet offset; spark |

Count the UTF-8 length of token 1. Say that length, the storage note above, and the
drawn count, before the first `mintWithArt`. If the subject cannot be drawn with rects
on this canvas, say so and use the silhouette table. Do not invent a URL to get past it.

### 2. Hosted metadata (`baseURI` given)

`tokenURI(id)` becomes `<baseURI><id>.json`, so the files must be named `1.json`, `2.json`,
… under the base URL — and each file must be the document described in *Agent NFTs*,
because that is what a marketplace or an agent fetches from that URL. Any host works:
your own storage, IPFS (`ipfs://…/` is accepted), a static site. Use this when you are
handling full-resolution images rather than inline pixel art. The base URI may be empty
at deploy and set later with `setBaseURI` — that is the reveal.

### 3. The contract's own render (no `baseURI`, no drawn art)

A 16×16 mirrored pixel image, deterministic from `artSeed` and the token id. No hosting,
no drawing, works immediately — and it is genuinely limited: six silhouettes and seven
trait rows. It cannot draw a rabbit, a bird, or anything else the user named, which is
exactly why mode 1 exists. Say so when you use it.

Two knobs, and they answer different questions:

- `artStyle` picks the **world**: `0` creature, `1` mosaic, `2` horizon (gradient sky,
  sun, stars, hills).
- `artForm` picks the **subject's silhouette** inside the creature world: `0` blob (a
  wide oval), `1` round (a circle), `2` square (a blocky head), `3` tall (a capsule),
  `4` diamond (a rhombus), `5` arch (a domed top over a flat foot). It has no effect on
  `mosaic` or `horizon`, which compose a scene rather than a body.

Use these two only for the tokens you are **not** drawing yourself. Every creature token
that falls back shares one face — same eyes, same mouth, one of four extras — so the
silhouette is the only thing that tells two such collections apart:

| The user asks for | Set |
| --- | --- |
| robot, mech, android, cube, machine | `artStyle:"creature"`, `artForm:"square"` |
| alien, orb, planet, emoji, balloon | `artStyle:"creature"`, `artForm:"round"` |
| ghost, slime, blob, goo, mascot | `artStyle:"creature"`, `artForm:"blob"` |
| crystal, gem, shard, diamond shape | `artStyle:"creature"`, `artForm:"diamond"` |
| mushroom, helmet, dome, tower, house | `artStyle:"creature"`, `artForm:"arch"` |
| totem, monolith, statue, figure, pillar | `artStyle:"creature"`, `artForm:"tall"` |
| landscape, sunset, mountains, sky, scenery | `artStyle:"horizon"` |
| abstract, pattern, geometric, texture, tiles | `artStyle:"mosaic"` |

Nothing in the request matched is a reason to choose, not a reason to skip choosing:
take its strongest noun, map it, and then **name the style and form you picked and
why** before you deploy, so the user can correct you while it is still free. Never
quietly fall back to `creature`/`blob` because it is the first row — that is exactly
how a collection comes back as a face the user never asked for.

Honesty rule: if you are deploying in on-chain mode, tell the user which of the three
modes each token uses — which you drew and which falls back to the contract's render —
and that `setBaseURI` swaps in hosted art later. A baseURI that 404s is worse than an
honest fallback.

## Agent NFTs: RESTAP endpoints, ERC-8048 profiles

Every token this contract mints is an agent identity, not only a picture. In on-chain
mode `tokenURI(id)` answers with `data:application/json;base64,<document>` — ordinary
ERC-721 metadata the contract writes itself, carrying the token's service entry:

```json
{
  "name": "Nova Nodes #7",
  "description": "Nova Nodes — agent NFT collection.",
  "attributes": [
    { "trait_type": "style", "value": "creature" },
    { "trait_type": "background", "value": "azure" },
    { "trait_type": "body", "value": "violet" },
    { "trait_type": "pattern", "value": "striped" },
    { "trait_type": "eyes", "value": "narrow" },
    { "trait_type": "mouth", "value": "small" },
    { "trait_type": "accessory", "value": "antenna" },
    { "trait_type": "form", "value": "square" }
  ],
  "image": "data:image/svg+xml;base64,…",
  "services": [
    { "name": "RESTAP", "endpoint": "https://agents.example.com/nova/7", "version": "0.1.4-beta" }
  ]
}
```

- **The document carries no ERC-8004 `type` field, on purpose.** A marketplace that sees
  `#registration-v1` treats the token as an agent registration and renders that
  document's own status flags — whether it is active, whether it takes paid requests —
  *in place of* `attributes`, so every art trait is then read but never listed. An
  ERC-8004 agent NFT with visible traits has to keep the registration out of `tokenURI`,
  which is exactly what the agent collections on marketplaces do. The agent layer is the
  ERC-8048 profile below, read straight from the contract instead of inferred from this
  document. Do not add `type` back to hosted files either: it costs the traits and buys
  nothing.
- **`attributes` is written before `image`.** The SVG data URI is the largest thing in
  the document, so a reader that caps a response still reaches the traits.
- **`agentBaseURI`** is where each token's agent is served: token `7`'s endpoint is
  `<agentBaseURI><id>`. A [RESTAP](https://github.com/nxt3d/restap) client takes it from
  there — `/.well-known/restap.json` for discovery, `POST /talk` to converse,
  `GET/POST /news` for the feed. Optional as a prepare field and constructor argument;
  prepare appends the trailing slash for you, and the owner can set or change it later
  with `setAgentBaseURI`.
- **No `agentBaseURI` ⇒ `"services": []`.** An endpoint that does not answer is worse
  than none: pass a base URL only where the user's agent is actually served.
- **`description`** is the document's `description` — optional prepare field and
  constructor argument, `setAgentDescription` later. Left empty at deploy, the contract
  writes `An AI agent in the <name> collection.`, so a collection described with a name
  alone still ships a complete document.
- The document is built from the name, the description and the base URI, so `"`, `\` and
  control characters are refused before anything is signed: prepare answers `400` naming
  the field, and the contract reverts with `InvalidMetadataString`.
- Hosted mode serves the creator's `1.json` files instead, and each file must carry this
  same document — same keys, same `services` entry, same version. RESTAP compatibility
  is the metadata format; running a live `/talk` endpoint is the agent owner's job, not
  the contract's.

### The agent profile: ERC-8048 (ERC-721T)

The metadata document is what a marketplace fetches; the agent profile is what a
contract reader sees without fetching anything — an [ERC-8048](https://eips.ethereum.org/EIPS/eip-8048)
key/value surface per token, [ERC-721T](https://github.com/nxt3d/721t)'s reserved keys and
all:

- **Reads:** `metadata(id, key)` returns the stored bytes, never reverting — an unset key
  is `0x`, a token that was never minted reads as `0x`, so a probe across a range cannot
  brick a reader. `supportsInterface` answers true for `0xdf670be1`, so a tool finds the
  surface with a plain ERC-165 call.
- **Automatic:** two keys fall back to the collection-level agent fields when nothing was
  written per token, so every minted token already carries a profile with no per-token
  write and no extra gas at mint:
  - `metadata(id, "context")` — the agent's description (`agentDescription`, or the same
    `An AI agent in the <name> collection.` the metadata document writes);
  - `metadata(id, "endpoint[restap]")` — `<agentBaseURI><id>`, empty when no base was set.
- **Writes:** `setMetadata(id, key, value)` stores raw bytes and emits `MetadataSet`.
  A written value wins over the automatic fallback, including empty bytes, so a
  holder can clear `context`. Keys are case-sensitive. The reserved ones are
  `context`, `endpoint[mcp]`, `endpoint[a2a]`, `endpoint[web]` and
  `address[<chain-id>]`. Any other `endpoint[<scheme>]` is allowed too.
  `setContext(id, text)` and `setEndpoint(id, scheme, uri)` build the canonical
  key. `setEndpoint` lowercases the scheme, so `MCP` is stored as `endpoint[mcp]`.
  `setAgentAddress(id, chainId, account)` stores the 20-byte account. `chainId`
  is the ERC-7930 chain identifier, lowercase `0x` hex with a zero address
  length — not the decimal chain id:

  | Chain | chainId | `address` key |
  | --- | --- | --- |
  | Ethereum | 1 | `address[0x00010000010100]` |
  | Base | 8453 | `address[0x0001000002210500]` |
  | Robinhood Chain | 4663 | `address[0x0001000002123700]` |

  A chain identifier that is not lowercase `0x` hex reverts `InvalidChainIdentifier`.
  A scheme that is empty or not letters, digits and hyphens reverts `InvalidEndpointScheme`.
- **Who may write:** only the token's owner or an approved operator — the same authority
  as moving the token, because the profile is the agent's identity. A stranger's write
  reverts with `ERC721InsufficientApproval`; a token that does not exist reverts with
  `ERC721NonexistentToken`.

### Traits: what the art was drawn from

Every token publishes the parameters its render actually used — as a view and as
marketplace-ready `attributes`, from the same hash, so the two cannot disagree.

- **`traits(id)`** answers `(string[] names, uint8[] values)` and reverts with
  `ERC721NonexistentToken` for a token that was never minted.
- **`attributes`** in that document spells those numbers out in words — `"azure"`,
  not `7` — with `style` first so a reader always knows which table the rest came from.
- The tables differ per style because the styles genuinely vary: **creature** has
  `background`, `body`, `pattern`, `eyes`, `mouth`, `accessory`, `form`; **mosaic** has
  `background`, `primary`, `accent`, `tile`, `density`; **horizon** has `sky`, `sun`,
  `ground`, `star`, `cloud`. Seven rows, five, five — no invented rows to fill a fixed
  shape. `form` is the one row every token in a collection shares: it mirrors the
  `artForm` the collection was deployed with, because the silhouette is a decision
  about the collection, not a roll per token.
- Colour rows are one of twelve named hue bands (`red`, `orange`, `yellow`,
  `chartreuse`, `green`, `spring`, `cyan`, `azure`, `blue`, `violet`, `magenta`,
  `rose`); each other row is its axis's own small vocabulary, and a value outside it
  reads as empty rather than as a neighbouring word it was never given.
- None of it is decoration: `tile` and `density` really coarsen the mosaic sampling,
  `star` and `cloud` really scatter the sky and lay the cloud band, `eyes` and `mouth`
  really change the creature's face, and `form` really is the outline the body test
  draws. A trait that stopped describing the pixels would fail the collection's own
  tests.
- **`Signalbound Agent`** is not a roll and not a row of `traits(id)`. Prepare assigns
  one bound Signalbound agent, and every on-chain token lists that same id. Bound
  means the token controls an ERC-8217 identity and can act. The 6,666 supply is not the pool.
  `params.deployerAgentPool` is how many bound agents were eligible when
  this response was built. Deploy the `deployData` from that same response: a later
  prepare can choose a different agent if the bound set has changed. Do not pass
  `deployerAgentId`. Hosted mode does not write attributes in the contract: put the
  same trait in each JSON file yourself. Read the id back with `deployerAgentId()`.

### OpenSea "Onchain agent binding"

The panel that shows an Agent ID and a Binding Contract is not a trait and not an
ERC-8048 key. On Ethereum and Base this artifact's `mint`, `mintToCreator` and
`mintWithArt` register the token while the collection still owns it, then
transfer it to the minter. That is the whole registration. Do not send `register` again afterwards: a second call opens a second identity for the same
token. A collection whose mint already reverted was built from the previous
bytecode; deploy it again. `binding.calls` is only for a collection deployed
from an earlier artifact, whose mint did not register. OpenSea shows the
panel after it indexes that registration:

`register(0, collection, tokenId, agentURI)`

`0` means ERC-721. `agentURI` is that collection token's own registration,
`https://api.signalbound.art/collections/<chainId>/<collection>/<tokenId>/registration.json`.
It is named `<collection> #<id>` and carries that token's description, image, and
services. The same document includes `registrations`: `agentId` is this token's
id and `agentRegistry` is `eip155:<chainId>:<collection>`. OpenSea attaches the
panel from that entry. It also includes `supportedTrust`. The Signalbound Agent trait is only the agent assigned to the collection.
Do not point `agentURI` at that agent's registration, at the HTML profile page, or
at `tokenURI`. Do not add an ERC-8004 `type` field to the metadata document —
that hides the art traits.

Prepare returns `binding`. When `binding.available` is false, this chain has no
adapter. Robinhood Chain is one of those chains, so a collection deployed there will
not show the panel. When it is true, mint is what creates the identity. The panel appears after
OpenSea indexes the registration document, not after a second `register`.
`binding.calls` is only for a collection deployed from an earlier artifact, whose
mint did not register. For that repair, call prepare again with `collection` and
`bindCount` (1 to 20). `bindFrom` defaults to 1; raise it to continue past 20.
Send each call from that token's owner, value `0`. Do not send those calls for a
collection whose mint already registered, and do not send `deployData` again.
The panel's Agent ID is the new identity the adapter creates. It is not the
`Signalbound Agent` trait. Do not invent an adapter address, and do not describe
the panel as present before the marketplace has indexed the registration.

## Deploying a collection

**Step 0 — the owner address.** Ask the wallet the deploy will be signed from (on Bankr:
the connected wallet, `GET /wallet/me`; in a terminal: the address you control). Collections
deployed through a factory **must** pass it explicitly or the factory owns the collection.
Ask at the same time where the user's agents are served, if the tokens should point
somewhere: that is `agentBaseURI`, and it can also be added later with `setAgentBaseURI`.

**Step 1 — prepare.** Describe the collection once:

```bash
curl -s -X POST https://api.signalbound.art/collections/prepare \
  -H 'content-type: application/json' \
  -d '{
    "name": "Nova Nodes",
    "owner": "0xTHE_DEPLOYER_WALLET",
    "chainId": 4663,
    "maxSupply": 2222,
    "mintPriceEth": "0.001",
    "maxMintPerWallet": 20,
    "maxCreatorMints": 20,
    "artStyle": "creature",
    "artForm": "square",
    "description": "One agent per node.",
    "agentBaseURI": "https://agents.example.com/nova/"
  }'
```

`POST` only; a missing field answers `400` naming the field. Read the reply before you
sign. A mismatch stops the deploy — do not repair a field by editing `deployData`.

| Field | Must match |
| --- | --- |
| `chainId` | the chain the user named |
| `deployData` | the creation transaction's `data`. No `to`, no value. Do not rebuild it from parts |
| `params.name`, `params.symbol` | the collection |
| `params.owner` | the user's wallet. `null` means `owner` was omitted; read `ownerNote` and stop when a factory would otherwise own it |
| `params.maxSupply`, `params.mintPrice.eth`, `params.maxMintPerWallet`, `params.maxCreatorMints` | the sale. `maxCreatorMints` is how many tokens you can still draw |
| `params.art.mode` | `onchain` or `metadata` |
| `params.art.styleName`, `params.art.formName` | the world and the silhouette you already named. `formName` is null for mosaic, horizon and hosted art |
| `params.description`, `params.agent.endpoint` | the document. `endpoint` is `<agentBaseURI><id>`, or null when no base was passed |
| `params.deployerAgentId` | the bound Signalbound agent prepare assigned. You did not choose it. It is a member of the bound set, not an arbitrary token from the 6,666 supply |
| `params.deployerAgentPool` | how many bound agents were eligible for that assignment |
| `binding.available` | true only when this chain has an ERC-8217 adapter. After the mint, `binding.calls` are the register transactions. Do not invent an adapter when it is false |
| `verify` | the explorer fields, passed on unchanged |

`creationBytecode` and `constructorArgs` are that same deploy split apart, for a tool
that asks for them separately. `params.art` is the echo of the card, not a new decision.

**Step 2 — deploy.** A creation transaction has **no `to`** and **no value** (the
constructor is not payable; gas comes from the deployer's wallet). Three ways to send it:

- **Bankr (chat):** ask it to deploy from compiled creation bytecode, passing
  `creationBytecode` and `constructorArgs`, no value attached, on `chainId`. Bankr runs
  this through its deterministic CREATE2 deployer with the constructor arguments
  ABI-encoded — which is exactly the shape prepare returned. Its raw
  `POST /wallet/submit` takes no creation transactions (it requires `to`), so deploy
  through the agent's deploy capability, not that route.
- **Your own tooling:** viem/ethers `deployContract({ abi, bytecode, args })` using the
  `abi` from the artifact endpoint, or a raw transaction with `to` omitted and
  `data = deployData`.
- **A chain CLI:** `cast create --create --data <deployData>`, or `forge create` against
  the source in the artifact.

**Step 3 — mint the creator reserve.** The deploy does not mint. A collection with
`totalSupply() == 0` has no tokens, so a marketplace grid stays empty. Prepare's
`mint.creator` is the next transaction: send `mint.creator.data` **to the deployed
address**, with `value` `0`. It calls `mintToCreator` for up to 20 of the reserve.
If `maxCreatorMints` is larger, send it again until `creatorMinted()` matches. If
`mint.creator` is null, the reserve is zero and only a public `mint` can create
tokens. A public mint sends `mint.public.data` to the same address with
`mint.public.valueWei` attached for one token — any other value reverts
`WrongPayment`. Do not attach that value to the deploy. The deploy stays valueless.

**Binding.** On Ethereum and Base the mint you just sent already registered each
token while the collection owned it, then transferred it to the minter. Do not
send `binding.calls` for that collection. If
the creator mint runs out of gas, send `mintToCreator` again with a smaller
quantity; each token still registers. On a chain where `binding.available` is
false, the panel cannot appear. `binding.calls` is the repair for a collection
deployed from an earlier artifact: call prepare again with `collection` and
`bindCount`, and send each call from the token owner. Do not redeploy.

**Step 4 — read it back.** `owner()`, `name()`, `symbol()`, `totalSupply()`,
`maxSupply()`, `mintPrice()`, `maxMintPerWallet()`, `maxCreatorMints()`, `baseURI()`,
`agentBaseURI()`, `agentDescription()`, `deployerAgentId()`, `artStyle()`, `artForm()`. Confirm the owner is the user's
wallet and the rules match the request — including the silhouette, because `artForm()`
is what decides whether the collection looks like the subject they asked for. This, plus a receipt with `status: success`, is
the only proof the deploy happened — an HTTP `200` is not. For an agent collection, also
read `metadata(1, "endpoint[restap]")`: it is the endpoint the tokens advertise, and it
is empty if no `agentBaseURI` was ever set.

**Step 5 — report.** The address, the explorer link, verification status, `totalSupply()`,
and the public mint: price per token, supply, per-wallet cap, creator reserve already
minted. If `totalSupply()` is still 0, say the mint did not happen and quote the
revert. Do not describe an empty collection as minted. If tokens point at an agent,
say where — token `1`'s endpoint, from `params.agent.endpoint`.

## Verifying the contract

Verification is part of the deploy, not an optional extra. The pack carries everything a
block explorer asks for:

| Field | Where it comes from |
| --- | --- |
| Contract name | `SignalCollection`. This is the Solidity contract. The collection title is `name()`, not this identifier. Do not verify the source under any other contract name |
| Source | `source` in `GET /collections/artifact` — the complete file, no imports to reconstruct |
| Compiler version | `verify.compiler`, e.g. `0.8.26+commit.8a97fa7a` |
| Optimization | `verify.optimizerRuns` — `1`, enabled |
| EVM version | `verify.evmVersion` — `cancun`; do not accept a tool's "default" |
| Constructor arguments | `verify.constructorArgs` — already ABI-encoded, paste as hex |

With Bankr: "Verify contract <address> on <chain> as SignalCollection with this source, compiler …, optimizer
runs 1, EVM version cancun, constructor args …". On an explorer form: single-file
Solidity, contract name `SignalCollection`, paste the artifact source, pick the version, optimization yes / runs 1, EVM version
cancun, paste the constructor arguments. Do not rename the contract in the source, and do not reuse another collection's verified source. Re-verification with different settings fails
loudly — re-read `verify`, do not guess.

If verification is refused, the deploy is still live and still owned by the user: report
the address as deployed, unverified, with what you tried. Never claim verified when it
is not.

## Minting and reading

Mint for a user (or yourself) by calling the contract — the value must match exactly:

| Call | Value to attach |
| --- | --- |
| `mint(1)` | one mint price |
| `mint(5)` | five × mint price |
| `mintToCreator(n)` | none — owner only, ≤ remaining reserve |
| `mintWithArt(to, svg)` | none — owner only, one token per call, ≤ remaining reserve |

`mintWithArt` is the one to reach for when the user named a subject: you draw the SVG and
it is stored on the token, so rabbits come back as rabbits. See *Art*. Read the artwork
back with `metadata(id, "image")`, which returns the raw stored bytes.

Reads need no transaction and any agent can phrase them: "Read `totalSupply()` on
<address>", "Read `owner()` on <address>", "Read `minted(<address>)` on <address>",
"Read `royaltyInfo(1, 1000000000000000000)`". The state worth reading back after any
owner action: `mintPrice()`, `mintPaused()`, `baseURI()`, `contractURI()`,
`agentBaseURI()`, `royaltyBps()`.

## Airdrop

A collection has no `airdrop` function. Giving its tokens to holders of another
asset is two owner-signed steps: mint them from the creator reserve, then
transfer each one. The contract cannot read who holds an ERC-20 or another NFT
collection, and this file has no airdrop endpoint to call.

Set the size before deploy. `maxCreatorMints` and `maxSupply` are fixed for the
life of the contract. `maxCreatorMints` must be at least the number of tokens
the user will give away. `maxSupply` must be at least that number plus any
public mint they still want. Read `maxCreatorMints()`, `creatorMinted()`,
`maxSupply()` and `totalSupply()` on a collection that already exists. Stop
when the remaining creator reserve, or the remaining supply, is below the
count. Public `mint` is not a way around that: `maxMintPerWallet` caps the
owner too.

Name the rule before any signature. Say how many tokens, which asset, which
chain that asset is on, and how the wallets are chosen: the N largest balances,
or one token per holder at or above a minimum balance, read at one block. When
holders outnumber the tokens, the rule decides who is in the list. Do not
promise a token to every holder of that asset when there are more holders than
tokens.

Build the list from that read. One address per token, unless the user asked for
more than one per wallet. Drop the zero address. Do not invent addresses. If
the holder set cannot be read, stop and say the list is missing. Show the rule,
the block, the count and the addresses, and wait until the user accepts the
list. The accepted count is the number of tokens you will mint.

Mint, then transfer. The owner calls `mintToCreator` with value `0`, in batches
of at most 20, until the new token ids cover the list. On Ethereum and Base
each of those mints registers the token while the collection owns it. Do not
send `register` again. The new ids run from the `totalSupply()` before the
first airdrop mint, plus one, through the `totalSupply()` after the last. The
owner then calls `safeTransferFrom(owner, recipient, tokenId)` once per id, in
list order. Read `ownerOf` on each id afterwards and report any token that is
still the owner's. A drawn series can skip the transfer and call
`mintWithArt(recipient, svg)` instead; that still spends the creator reserve,
one token per call.

The airdrop is done when `ownerOf` for every id in the accepted list is the
recipient you named. An accepted list is not a completed send.

Owner actions (signer must be the owner, else `NotOwner`): `setBaseURI`, `setContractURI`,
`setAgentBaseURI`, `setAgentDescription`, `setMintPrice`, `setMintPaused(bool)`,
`setRoyalty(receiver, bps)`, `withdraw()`, `transferOwnership(to)`. The caps never change.

## Chains

The contract deploys on any EVM chain whose hardfork includes `cancun`. The chain must still be one your wallet can sign for. Bankr's deploy surface, as
an example of a wallet that supports this flow end to end:

| Chain | chainId | | Chain | chainId |
| --- | --- | --- | --- | --- |
| Ethereum | 1 | | Arbitrum | 42161 |
| Polygon | 137 | | BNB Chain | 56 |
| Base | 8453 | | Robinhood Chain | 4663 |
| Unichain | 130 | | Arc | 5042 |
| World Chain | 480 | | | |

Pass the `chainId` to prepare so the reply is checked against where you will deploy.
Deploying on a chain the user did not name is a bug: ask, or follow what they said
("on Robinhood" → 4663).

## Limits

| Thing | Limit |
| --- | --- |
| Name / symbol | 64 characters / 1–16 letters and digits |
| `description` | 512 characters; no `"`, `\` or control characters — it is written into JSON |
| `agentBaseURI` | optional http/https/ipfs URL; trailing slash appended by prepare |
| `deployerAgentId` | assigned by prepare from the bound agents; do not send it |
| `bindCount` | 1–20, only on the second prepare, with `collection` |
| `maxSupply` | 1–1,000,000 |
| `maxMintPerWallet` | 1–`maxSupply`, cumulative |
| `maxCreatorMints` | ≤ `maxSupply` |
| Royalty | 0–10000 bps, receiver required above 0 |
| `mintPrice` | below 1,000,000 ETH (sanity check) |
| Art styles | 0 creature, 1 mosaic, 2 horizon |
| Art forms | 0 blob, 1 round, 2 square, 3 tall, 4 diamond, 5 arch — creature only, ignored otherwise |
| Deploy bytecode | under the 24 KB runtime limit; read `deployedBytecodeSize` from the artifact. The cast is constructor data, not runtime code, so a large sheet is not what hits that limit |
| Prepare | `POST`, free, no key; `400` names the offending field |

## Prompt examples

The ask this skill exists for, in one message:

> Create an NFT collection called Nova Nodes on Robinhood with the art generated on-chain
> as blocky little robots. Mint price of 0.001 ETH, max supply of 2222, max mints per wallet
> of 20, and max creator mints of 20. Each token is an agent — we serve them at
> https://agents.example.com/nova/. Use this skill for creating NFT collections
> https://signalbound.art/skill.md — Make sure to verify the contract you deploy as well

What that becomes: prepare with `{name:"Nova Nodes", chainId:4663, maxSupply:2222,
mintPriceEth:"0.001", maxMintPerWallet:20, maxCreatorMints:20, subject:"robot",
agentBaseURI:"https://agents.example.com/nova/"}` (symbol derived `NOVA`, description
defaulted to `Nova Nodes — agent NFT collection.`, owner = the signing wallet) →
**say "robots, so the robot cast" before deploying**, so the user can stop you while
prepare is still free → deploy with no value → read `subject()` back → verify with
the pack's fields → report the address, the explorer link, and that token `1`'s
document points RESTAP clients at `https://agents.example.com/nova/1`. A square
silhouette is only the fallback when they asked for the built-in renderer, and you
say that it is a silhouette.

The same request with `artForm` omitted is now refused with `400 field:"artForm"` — that is
the endpoint refusing to let a collection come back as the wide blob every other creature
collection deploys. The words "blocky little robots" are the request; `artForm:"square"`
is the part of it the contract can honour. Pick the form and send it again; the refusal
costs nothing because no gas was spent.

| What a user says | What you do |
| --- | --- |
| "Create a collection called Pixie Market on Base, free mint, 1000 supply, no creator reserve" | prepare with `mintPriceEth:"0"`, `maxSupply:1000`, `maxCreatorMints:0`, `chainId:8453`, owner = wallet → deploy → verify → report |
| "…and verify it" | verification fields from `verify`; never skip, never guess them |
| "The art should be ghosts / robots / crystals, not more faces" | **draw it**: compose the SVG and `mintWithArt(to, svg)` per token. Only for tokens you are not drawing, map the subject to `artForm` (`ghost`→`blob`, `robot`→`square`, `crystal`→`diamond`, `alien`→`round`, `totem`→`tall`, `mushroom`→`arch`); `artSeed` only recolours, it never changes the shape |
| "Deploy 20 rabbits to my wallet now" | *Drawing a series*: card first. Drawn count 20, and the whole supply is the set, so `maxSupply` and `maxCreatorMints` are 20 unless they asked for a public mint of the silhouette. Prepare → deploy → 20 × `mintWithArt`. Token 2 changes an axis; it does not restyle the canvas. Say the byte length before the first call |
| "Can I change my rabbit later?" | yes — `setMetadata(id, "image", svg)`; the holder owns that choice, no redeploy |
| "Mint 3 for me" | `mint(3)` with exactly 3 × mint price attached |
| "What has minted so far?" | read `totalSupply()` and `minted(<address>)` |
| "Art is ready now, hosted at https://cdn.example.com/nova/" | owner calls `setBaseURI("https://cdn.example.com/nova/")`; files must be `1.json`, `2.json`, … |
| "The agents are served at https://agents.example.com/nova/" | owner calls `setAgentBaseURI("https://agents.example.com/nova/")`; token `1`'s document points there |
| "Make it 0.002 ETH now" | owner calls `setMintPrice`; the supply caps cannot change |
| "Pause minting while we fix the site" | owner calls `setMintPaused(true)` |
| "Who owns it?" | read `owner()` — if it is not the user's wallet, say so plainly |
| "Airdrop 100 of these to the largest $BANKR holders" | On a new collection, set `maxCreatorMints` to at least 100 before deploy. Read the 100 largest balances at one block, show that list, and wait. Then `mintToCreator` in batches of at most 20 and `safeTransferFrom` each new id. If the remaining creator reserve is below 100, stop |
| "Airdrop these to CryptoPunks holders" | Ask how many tokens and the rule: one per holder, or the N largest. If holders outnumber the remaining creator reserve, say so and do not mint a shorter list unless the user accepts that smaller count |

## When a call fails

| Symptom | Meaning | What to do |
| --- | --- | --- |
| `400` with `field` | prepare rejected a value | the message names the field and the rule; fix that field only |
| `400` `field:"artForm"` | a `creature` collection reached prepare with no silhouette | pick from the subject table above and send the same request again; if the user's subject is a landscape use `artStyle:"horizon"` instead, and if they are hosting their own art pass `baseURI` — never send `0` just to clear the error, that is the blob |
| `405` | wrong method | prepare is `POST`; the artifact is `GET` |
| `503` "artifact not built" | our side has not published the bytecode | say so; do not substitute another contract |
| `WrongPayment` | value ≠ price × quantity | recompute from `mintPrice()` read on chain |
| `PerWalletCapExceeded` | order above the cap, or the wallet's cumulative mints hit it | read `minted(<address>)`; the cap is fixed |
| `SoldOut` | `totalSupply` + order > `maxSupply` | read `totalSupply()`; nothing to do |
| `MintingIsPaused` | owner paused minting | read `mintPaused()` and tell the user |
| `CreatorCapExceeded` | reserve spent, or caller is not the owner | read `creatorMinted()` |
| Airdrop count above the remaining creator reserve | `maxCreatorMints` is immutable | read `creatorMinted()` and `maxCreatorMints()`; do not mint a shorter list unless the user accepts a smaller count |
| `EmptyArtwork` | `mintWithArt` was given `0x` | draw the SVG first and pass its bytes; an empty value would leave the token on the built-in render anyway |
| `NotOwner` | signer is not the owner | check `owner()`; ownership is a constructor argument, not a guess |
| `InvalidMetadataString` | a name, description or agent URL carries `"`, `\` or a control character | fix that field in prepare — a JSON string cannot carry them |
| `ERC721NonexistentToken` | token id does not exist | ids start at 1 and only exist after mint |
| Explorer rejects verification | settings mismatch | re-read `verify` — version, runs 1, `cancun`, encoded args |
| Deploy succeeded, `owner()` is not the user | the factory became owner | stop, say what happened, redeploy passing `owner` |
| Out of gas / insufficient funds | deployer pays the deploy gas | the user's wallet needs the chain's native token |

## For humans

| Where | Address |
| --- | --- |
| This skill | `https://signalbound.art/skill.md` |
| Site and docs | `https://signalbound.art` · `https://signalbound.art/docs` |
| Deploy pack | `https://api.signalbound.art/collections/artifact` |
| Prepare endpoint | `https://api.signalbound.art/collections/prepare` (POST) |
| Source and references | `https://github.com/nrlartt/signalbound-skill` |

## References

- [collection.md](https://signalbound.art/references/collection.md) — constructor, functions, errors and both endpoints in full
- [deploy.md](https://signalbound.art/references/deploy.md) — the deploy recipes: Bankr, viem, cast/forge, and how to confirm one
- [verification.md](https://signalbound.art/references/verification.md) — every explorer field, plus the failure modes

## Rules

- Never send a private key, seed phrase or session token anywhere in this flow. Not to the
  endpoints, not to a deploy, not in chat. A deploy is signed by the wallet that owns it.
- The owner is the user's wallet, never yours, never a factory's. Read `owner()` after
  every deploy and say what it answers.
- Every value you sign comes from prepare's echo (`params`, `constructorArgs`). Do not
  re-derive, round or hand-carry numbers between calls.
- Show the intent before asking for a signature: name, symbol, supply, price, caps,
  royalty, chain, owner — the reply already lists them.
- A deploy is real when a receipt says success **and** the read-backs match. An HTTP `200`
  is a transaction you may send, not one that happened.
- Verify the contract you deploy. If verification fails, report the address as unverified
  with what you tried — never as verified.
- Use only the two endpoints in this file. Do not invent one, and do not quietly
  substitute a third-party deployer or collection contract when ours answers `503`.
- Art honesty: hosted art needs files that actually exist at `<baseURI><id>.json`; when
  you cannot produce the user's art, deploy on-chain and say exactly that.
- Agent honesty: never invent an agent endpoint. `agentBaseURI` goes out only where the
  user's agent is actually served; `"services": []` is the honest answer for a collection
  with nothing to serve yet.
- Nothing here is investment advice. A collection's mint, floor and royalties can go to
  zero, and every figure above is a reading, not a promise.
