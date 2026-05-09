# Cat Town Boutique — contract + KIBBLE oracle reference

The boutique is a fully onchain daily shop on Base. Every day at **00:00 UTC** the contract surfaces **3 items** selected deterministically from the current season's pool. No offchain API is needed — items, prices, stock, rotation, **and the buy path** are all directly on the Boutique contract.

This doc covers the **Boutique** contract (rotation, item state, **purchase flow**) and the **KIBBLE price oracle** (for USD conversion — the in-game UI shows native-token prices only).

## ⚠️ CRITICAL: each item carries its own `paymentToken` — read it before approving

Most items are priced in **KIBBLE**, but partnership / collab items use other ERC-20s — for example today's **Rat Skull Charm** (Friends of Cat Town collab) is priced in **DOTA** ("Defense of the Agents", `0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07`). The contract pulls the price from `msg.sender` in **whichever token the item specifies**, so you must approve the **right token**.

If you reflexively `kibble.approve(boutique, …)` for a DOTA-priced item, the `purchaseItem` tx reverts on the internal `transferFrom` (insufficient DOTA allowance — KIBBLE allowance is irrelevant). The fix is to read `ShopItemView.paymentToken` per item and approve **that** token.

Tokens currently surfaced by the cat.town frontend: **KIBBLE, DOTA, USDC, BARON, cbBTC**. Any ERC-20 the team configures will work; treat the address as authoritative, not the symbol.

## Addresses (Base, chain 8453)

| Contract            | Address                                      |
|---------------------|----------------------------------------------|
| Boutique            | `0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02` |
| Kibble Price Oracle | `0xE97B7ab01837A4CbF8C332181A2048EEE4033FB7` |
| KIBBLE token        | `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb` |

## Rotation model

- Each day starts at **00:00 UTC**; `getCurrentDayNumber()` returns days since Unix epoch (`block.timestamp / 86400`).
- Rotation is deterministic from `(dayNumber, currentSeason)` — same day + same season = same 3 items.
- `itemsPerDay()` = **3** (constant).
- Season boundaries follow `GameData.getCurrentSeason()` (see [../world/contract.md](../world/contract.md)); each season has its own pool.
- The matching human-readable doc pages:
  - Top-level shop: https://docs.cat.town/shops/boutique
  - Spring: https://docs.cat.town/boutique/spring-fashion
  - Summer: https://docs.cat.town/boutique/summer-fashion
  - Autumn: https://docs.cat.town/boutique/autumn-fashion
  - Winter: https://docs.cat.town/boutique/winter-fashion

## Primary read — `getTodaysRotationDetails()`

Returns today's 3 items as `ShopItemView[]` — full details in one call. Selector: `0x36362553`, no args.

### `ShopItemView` fields

| Field              | Type        | Notes                                                                 |
|--------------------|-------------|-----------------------------------------------------------------------|
| `itemId`           | `uint256`   | Unique id for the shop item                                           |
| `traitNames`       | `string[]`  | Parallel array of trait keys, e.g. `["Name","Rarity","Image","Slot","Shiny"]` |
| `traitValues`      | `string[]`  | Parallel array of values in the same order                            |
| `paymentToken`     | `address`   | Always the KIBBLE token                                               |
| `price`            | `uint256`   | KIBBLE in **wei** (18 decimals) — divide by `10^18` for display       |
| `stockRemaining`   | `uint256`   | Units still purchasable. `0` → sold out                               |
| `totalPurchased`   | `uint256`   | Units sold so far                                                     |
| `maxSupply`        | `uint256`   | Total ever available. `type(uint256).max` → uncapped                  |
| `startTime`        | `uint64`    | Unix seconds (0 = always available)                                   |
| `endTime`          | `uint64`    | Unix seconds (0 = no end)                                             |
| `availableSeasons` | `uint8`     | Bitmask: `1=Spring`, `2=Summer`, `4=Autumn`, `8=Winter`               |
| `isActive`         | `bool`      | Enabled by admin                                                      |
| `isPurchasableNow` | `bool`      | Passes time + season gates                                            |
| `isInTodaysRotation` | `bool`    | In today's 3-item set                                                 |

### Parsing the trait arrays

`traitNames` and `traitValues` are parallel. Real trait keys on a live boutique item:

| Trait key     | Example value                                        | Notes                                                      |
|---------------|------------------------------------------------------|------------------------------------------------------------|
| `Item Name`   | `"White Longsleeve"`                                 | Display name                                               |
| `Rarity`      | `"Rare"`                                             | `Common` / `Uncommon` / `Rare` / `Epic` / `Legendary`      |
| `Item Type`   | `"Cosmetic"`                                         | Almost always `Cosmetic` for boutique                      |
| `Source`      | `"Boutique"`                                         | Distinguishes from `Fishing`/`Gacha` in a joined view      |
| `Slot`        | `"Body"`                                             | `Hat` / `Body` / `Eyewear` / `Companion` / etc.            |
| `Sprite`      | `"white-longsleeve"`                                 | Internal asset id                                          |
| `imageUrl`    | `https://cdn.cat.town/nft/equipment/body/...`        | Display image                                              |
| **`Collection`** | `"Spring Fashion"`                                | **Collection label** — use this to tell the user which collection is currently rotating |
| `Flavor Text` | `"Clean and crisp like fresh spring linens."`        | Optional color                                             |
| `Sell Value`  | `"0"`                                                | Usually 0 for boutique (these aren't meant to be resold)   |
| `coreId`      | `"cmlz9n8f30008kz04flhruq6t"`                        | Internal database id                                       |

Boutique metadata is **onchain via the trait arrays** — don't cross-reference `/v2/items/master`. The `ShopItemView.traitNames`/`traitValues` are the source of truth.

## Other useful reads

| Function                              | Returns                       | Notes                                          |
|---------------------------------------|-------------------------------|------------------------------------------------|
| `getTodaysRotation()`                 | `uint256[]`                   | Just today's 3 item ids (cheaper)              |
| `getCurrentDayNumber()`               | `uint256`                     | Days since Unix epoch                          |
| `getCurrentSeason()`                  | `uint8`                       | `0=Spring, 1=Summer, 2=Autumn, 3=Winter`       |
| `getShopItem(itemId)`                 | `ShopItemView`                | One item by id                                 |
| `getAllShopItems()`                   | `ShopItemView[]`              | Full catalog, active + inactive                |
| `getItemsBySeason(season)`            | `ShopItemView[]`              | Season-specific pool                           |
| `previewRotationForDay(day, season)`  | `uint256[]`                   | Future rotation preview (deterministic)        |
| `getItemStock(itemId)`                | `(max, purchased, remaining)` | Stock only                                     |
| `dailyRotationEnabled()`              | `bool`                        | Is daily rotation on (expected: true)          |
| `itemsPerDay()`                       | `uint8`                       | Currently 3                                    |
| `defaultPaymentToken()`               | `address`                     | KIBBLE                                         |

## KIBBLE → USD conversion

### Oracle reads

| Function              | Selector     | Returns                        | Scale       |
|-----------------------|--------------|--------------------------------|-------------|
| `getKibbleUsdPrice()` | `0x00cbfbce` | `uint256` USD per 1 KIBBLE     | **× 10^18** |
| `getEthUsdPrice()`    | `0xa0a8045e` | `uint256` USD per 1 ETH        | × 10^8 (Chainlink) |
| `getKibbleEthPrice()` | `0x47bb71e5` | `uint256` ETH per 1 KIBBLE     | × 10^18     |

**Watch the scale mismatch:** `getKibbleUsdPrice()` is `10^18`, but `getEthUsdPrice()` is `10^8`. Easy to mix up — use the right divisor per call.

### Formula

Boutique `price` is in KIBBLE wei (18 decimals). Oracle returns USD × `10^18` per 1 KIBBLE:

```
kibble_human    = price / 10^18                           # KIBBLE count
usd_per_kibble  = rawKibbleUsdPrice / 10^18               # USD per 1 KIBBLE
usd_value       = kibble_human * usd_per_kibble
                = (price * rawKibbleUsdPrice) / 10^36     # BigInt-safe form
```

For integer cents: `usd_cents = (price * rawKibbleUsdPrice) / 10^34`.

### Live example (captured during writing)

- `getKibbleUsdPrice()` = `948,723,424,083,878` → **$0.0009487 per KIBBLE**
- 1,000 KIBBLE ≈ $0.95
- 10,000 KIBBLE ≈ $9.49
- 100,000 KIBBLE ≈ $94.87

The oracle tracks KIBBLE's real market price; re-read at least every few minutes if you care about accuracy.

## Response pattern — "what's in the boutique today?"

1. Read in parallel: `getTodaysRotationDetails()` (single call, 3 items) and `getKibbleUsdPrice()`.
2. For each `ShopItemView`:
   - Parse `traitNames`/`traitValues` into a dict → pull `Name`, `Rarity`, `Slot`.
   - `kibble_price = price / 10^18`
   - `usd_price = (price * rawKibbleUsdPrice) / 10^36`
   - Stock: if `stockRemaining == 0` → **"Sold Out"**; otherwise format as **`"{stockRemaining} of {maxSupply} remaining"`** — stockRemaining first, maxSupply second. The order matters: `stockRemaining` ≤ `maxSupply` always, so if the first number ever exceeds the second you've swapped them. Reread the struct fields if unsure.
3. Sort with the big-ticket order: **rarity DESC** (Legendary → Common), then **KIBBLE price DESC**, then name ASC.
4. Open the reply with the current season, and end with a link to the matching `docs.cat.town/boutique/...-fashion` page.

### Example response (real data from today's rotation)

> **Boutique today — Spring Fashion collection (Day 20566):**
>
> 1. **White Longsleeve** — Rare Body — **12,500 KIBBLE (~$11.86)** — 1 of 1 remaining
> 2. **Royal Blue Varsity** — Uncommon Body — **6,000 KIBBLE (~$5.69)** — 2 of 2 remaining
> 3. **Classic Academic Blouse** — Uncommon Body — **6,000 KIBBLE (~$5.69)** — 1 of 2 remaining
>
> Browse the other seasonal collections:
> - Spring: https://docs.cat.town/boutique/spring-fashion
> - Summer: https://docs.cat.town/boutique/summer-fashion
> - Autumn: https://docs.cat.town/boutique/autumn-fashion
> - Winter: https://docs.cat.town/boutique/winter-fashion
> - Overview: https://docs.cat.town/shops/boutique

## Buying an item

Single-item purchase per tx — no batch/multi-buy on the contract.

### Write path

```
Boutique.purchaseItem(uint256 itemId) returns (uint256 mintedTokenId)
```

- Selector: `0xd38ea5bf`
- `itemId` is the **plain rotation id** from `getTodaysRotation()` (208, 173, 196, …) — **not** scaled, **not** wei. Pass the integer as-is.
- State mutability: `nonpayable` — do **not** send `msg.value`.
- On success, mints the item NFT to `msg.sender` (via the configured V2 minter) and emits `ItemPurchased`.

### Preconditions (run all three before submitting)

1. `paymentToken.allowance(user, boutique) >= price` — note `price` is in **`paymentToken` wei** at that token's decimals. KIBBLE and DOTA are 18 decimals; USDC is 6. Don't reflexively use 18.
2. `paymentToken.balanceOf(user) >= price`.
3. `canPurchaseItem(itemId)` → `(bool canPurchase, string reason)`. If `canPurchase == false`, surface `reason` verbatim — it's human-readable ("Item is sold out", "Item is not active", "Item not in today's rotation", season-gate misses, etc.). Cheaper and more informative than letting the tx revert.

### `ItemPurchased` event

```
event ItemPurchased(
    address indexed buyer,
    uint256 indexed itemId,
    uint256 indexed mintedTokenId,
    address paymentToken,
    uint256 price
)
```

`mintedTokenId` is the V2-minter token id the user now owns — useful if you immediately want to surface a sell quote (see [../sell-items/contract.md](../sell-items/contract.md)) or render the item.

### Recipe — KIBBLE-priced item (the common case)

Today's example: **Striking Baseball Cap** (`itemId = 173`, Legendary, 800,000 KIBBLE).

```
1. canPurchaseItem(173) → must be (true, "")
2. KIBBLE.allowance(user, boutique) ≥ 800_000 * 10^18 ?
     - if not: KIBBLE.approve(boutique, 800_000 * 10^18)        # standard ERC-20 wei
3. Boutique.purchaseItem(173)                                    # plain integer, no scaling
```

### Recipe — DOTA-priced item (collab / partnership)

Today's example: **Rat Skull Charm** (`itemId = 208`, Rare, 93,750 DOTA, "Friends of Cat Town" collection).

```
1. canPurchaseItem(208) → must be (true, "")
2. DOTA.allowance(user, boutique) ≥ 93_750 * 10^18 ?
     - if not: DOTA.approve(boutique, 93_750 * 10^18)            # DOTA = 0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07, 18 decimals
3. Boutique.purchaseItem(208)
```

If the user doesn't hold any DOTA, the cat.town UI sends them to Uniswap to swap in:

```
https://app.uniswap.org/swap?chain=mainnet&outputChain=base&inputCurrency=NATIVE&outputCurrency=0x5f09821cbb61e09d2a83124ae0b56aaa3ae85b07
```

For collab tokens generally, prefer to swap *into* the required token from KIBBLE / ETH / USDC rather than asking users to source it themselves. Bankr's swap surface (via the `trails` or `symbiosis` skill) handles this.

### Per-wallet purchase counts

`getUserPurchaseCount(itemId, user)` returns how many times a wallet has bought a specific item. The contract enforces stock via `stockRemaining` globally (not per-user), but check this read if you want to tell a user "you've already bought this one" before another attempt.

### Common revert reasons

- **`ERC20: transfer amount exceeds allowance`** — wrong token approved, or allowance too low. Reread `paymentToken` from `ShopItemView` and approve that exact address.
- **`ERC20: transfer amount exceeds balance`** — user doesn't hold enough of `paymentToken`. Offer a swap.
- **`canPurchaseItem` reason strings** (preflight catches these without burning gas):
  - "Item is sold out" → `stockRemaining == 0`
  - "Item is not active" → admin disabled it
  - "Item not in today's rotation" → out of the daily 3
  - season / time-window misses

### Bankr execution

Natural-language prompt (handles approval + buy in one shot):

```bash
bankr agent prompt "Buy the Rat Skull Charm from the Cat Town boutique"
```

Or encode calldata directly:

```bash
# 1) approve DOTA → boutique for 93,750 DOTA
bankr wallet submit \
  --to 0x5F09821CBb61e09D2a83124Ae0B56aaa3ae85B07 \
  --data 0x095ea7b3000000000000000000000000f9843bf01ae7ef5203fc49c39e4868c7d0ca7a020000000000000000000000000000000000000000000013da329b633647000000 \
  --chain base

# 2) purchaseItem(208)
bankr wallet submit \
  --to 0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02 \
  --data 0xd38ea5bf00000000000000000000000000000000000000000000000000000000000000d0 \
  --chain base
```

(For a KIBBLE-priced item, swap the approve target to the KIBBLE token `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb` and recompute the amount.)

## Notes

- **Caching:** `getTodaysRotationDetails()` is stable within a UTC day — cache freely. The oracle moves with market — 1–5 min cache is reasonable.
- **Future rotations:** `previewRotationForDay(day, season)` supports "what's in the boutique tomorrow?" queries without waiting.
- **Season mismatch:** if `GameData.getCurrentSeason()` disagrees with `Boutique.getCurrentSeason()`, trust Boutique's for rotation questions (they should match, but boutique may lag a block).
- **No batch buy.** Two purchases = two `purchaseItem` calls. Approve the cumulative amount once if both items share the same `paymentToken`.
