# Aavegotchi Data Reference

## Contract Information

**Contract Address (Base Mainnet):** `0xa99c4b08201f2913db8d28e71d020c4298f29dbf`

**Network:** Base (Chain ID: 8453)

**RPC:** `https://mainnet.base.org`

## Gotchi Traits

Each Aavegotchi has 6 numeric traits that affect its rarity and appearance:

1. **Energy (NRG)** - Affects stamina and activity
2. **Aggression (AGG)** - Affects combat behavior
3. **Spookiness (SPK)** - Affects mysterious abilities
4. **Brain Size (BRN)** - Affects intelligence
5. **Eye Shape (EYS)** - Visual trait
6. **Eye Color (EYC)** - Visual trait

Each trait has:
- **Base Value**: The original rolled trait value
- **Modified Value**: Base value + wearable modifiers

Trait values range from 0-99, with extreme values (very low or very high) being rarer.

## Rarity Score (BRS)

**Base Rarity Score (BRS)** is calculated from trait rarity:
- Common traits: 50-50 (average)
- Uncommon traits: Further from 50
- Rare traits: Very close to 0 or 99

Higher BRS = Rarer Gotchi = More valuable

**Modified Rarity Score** includes wearable bonuses added to BRS.

## Kinship

**Kinship** represents the bond between Gotchi and owner:
- Starts at 50
- Increases by petting (max once per 12 hours)
- Decreases if not interacted with regularly
- Affects rewards in some games

## Haunt

**Haunt** is the generation/season when a Gotchi was summoned:
- Haunt 1: Original generation
- Haunt 2: Second generation
- Haunt 3: Current generation on Polygon (not Base yet)

On Base, Haunt numbers may differ from Polygon mainnet.

## Wearables

Aavegotchis can equip up to 16 wearables:
- Each wearable has an ID
- Wearables modify traits
- Wearables add to rarity score
- Some wearables are very rare and valuable

The `equippedWearables` array has 16 slots:
- 0 = body
- 1 = face
- 2-4 = eyes
- 5-7 = head
- 8-11 = hands (left/right)
- 12-15 = pet

Slots with value 0 = nothing equipped.

## Status Codes

- 0: Portal (not opened)
- 1: VRF Pending (being generated)
- 2: Open Portal (ready to choose)
- 3: Aavegotchi (summoned and alive)

## Age Calculation

Age is typically measured as:
- Days since summoning
- Or: Days since last interaction (as shown in the script)

## Level & Experience

- Gotchis gain XP through various activities
- XP threshold increases for each level
- Higher level = more wearable slots and abilities

## Collateral

Each Aavegotchi is staked with an ERC20 token (collateral):
- Common collaterals: GHST, DAI, USDC, WETH
- Collateral amount affects gotchi value
- Can be increased but not withdrawn while gotchi is alive
