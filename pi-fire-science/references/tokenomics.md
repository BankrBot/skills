# $PiFire

| Parameter | Value |
|-----------|--------|
| Network | Base |
| Venue | Bankr / Uniswap V4 (Doppler) |
| Supply | 100,000,000,000 fixed, non-mintable |
| Launch LP | 85% |
| Creator | 15% — 1y continuous vest + 30d cliff |
| Pool swap fee | **0.7%** of volume |
| Creator / treasury share | **95% of pool fee** ≈ **0.665%** of volume |
| LP compounding (hook) | ≈ **0.285%** of volume — **separate** leg; not part of the 0.7% |
| Fee assets | Per Bankr launch settings (typically WETH on Base) |

**Fee math:** Do not add 0.665% + 0.285% and call that the 0.7% pool fee. Creator share is 95% of the **0.7% pool fee**. The ~0.285% LP figure is an additional hook/LP compounding fee on volume.

**Initial role:** creator fee share funds lab / hardware / inference R&D without equity dilution.

**Treasury intent:** hardware lab, PCB fab, parts (e.g. URS Electronics), AI inference compute, related R&D.

**Treasury wallet (Base):** `0xddd66dcb122fe2934388cc915071d545bd0c3c41` — https://basescan.org/address/0xddd66dcb122fe2934388cc915071d545bd0c3c41

Creator pool fees: also check/claim via Bankr for the token (fee beneficiary may differ from this wallet).

## Live fields

| Field | Value |
|-------|--------|
| Contract | `0x3d44e71c839da9fa7fc1d5b3c199fbcdde04fba3` |
| Network | Base |
| Explorer | https://basescan.org/address/0x3d44e71c839da9fa7fc1d5b3c199fbcdde04fba3 |
| DexScreener | https://dexscreener.com/base/0x3d44e71c839da9fa7fc1d5b3c199fbcdde04fba3 |
| Treasury wallet | `0xddd66dcb122fe2934388cc915071d545bd0c3c41` |
| Treasury explorer | https://basescan.org/address/0xddd66dcb122fe2934388cc915071d545bd0c3c41 |

Never invent a different address. Token is not equity.
