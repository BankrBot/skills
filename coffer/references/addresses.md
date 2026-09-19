# Coffer — addresses and pair catalog

Chain: **Robinhood** `4663`. Native ETH. User-facing wrapped ETH = **WETH** (on-chain token aeWETH).

There is **no factory**. One vault, several strategies. Enumerate live legs with `vault.strategyCount()` / `vault.strategies(i)` — do not assume the ABI’s single `CofferStrategy` address is the only one.

---

## Infra (live)

| Name | Address | Say to user |
|------|---------|-------------|
| CofferVault | `0x948c683a5885D49383C8d94Fc1827a036543E803` | vault |
| CofferLiquidShares | `0xF2736eE8361241B283c1e579B5173eb9aB54EBD1` | liquid shares |
| CofferKeeper | `0xAf132C43E60c09b657267ebce75a1a34e8DBE9a0` | (don’t mention unless asked) |
| CofferOperatorRegistry | `0x932faEB584254e776Dc39B8A5FF55ec6319bBf82` | (don’t mention unless asked) |
| CofferSwapRouter | `0x62B49Ea133C32D91b255043e87DDD0667B784d6a` | (don’t mention unless asked) |
| WETH (aeWETH) | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | **WETH** |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | **USDG** |
| WETH/USDG 0.01% pool | `0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca` | WETH/USDG pool |

Confirm LS: `vault.liquidShares()` should equal the LS row.

---

## Deployed legs (rotating-token catalog)

Target weights at deploy were ~1/3 each (`3334` / `3333` / `3333`). Live `ASSET()` can differ after rotation. The catalog is the **rotating tokens**; on-chain `ASSET()` is the **current** pair.

### Volatile — quote WETH, fee `10000` (1%)

| Role | Token | Address |
|------|-------|---------|
| Deploy pair | CASHCAT | `0x020bfC650A365f8BB26819deAAbF3E21291018b4` |
| Rotating | PONS | `0x39dBED3a2bd333467115dE45665cC57F813C4571` |
| Rotating | PIPEDOG | `0x5Cb6F181081301b44905F3ae15419112ecaBd8A6` |
| Rotating | TENDIES | `0x45242320DBB855EeA8Fd36804C6487E10E97FCF9` |
| Rotating | JUGGERNAUT | `0xD7321801CAae694090694Ff55A9323139F043B88` |

Reserve is held in WETH.

### Stock — quote USDG, fee `3000` (0.30%)

| Role | Token | Address |
|------|-------|---------|
| Deploy pair | AMZN | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` |
| Rotating | MSFT | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` |

### Stock — quote USDG, fee `3000` (0.30%)

| Role | Token | Address |
|------|-------|---------|
| Deploy pair | GLD | `0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e` |
| Rotating | SGOV | `0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5` |

Stock legs convert USDG ↔ WETH through the WETH/USDG pool on deposit/withdraw.

---

## How to list live pairs

```text
n = vault.strategyCount()
for i in 0 .. n-1:
  (strat, targetWeightBps, retired) = vault.strategies(i)
  asset = strat.ASSET()
  quote = strat.quoteToken()
  fee   = strat.poolFee()
  mode  = strat.mode()   // 0 ACTIVE, 1 IDLE
```

Show quote as **WETH** if `quoteToken` is aeWETH, **USDG** if USDG. Name `asset` from the tables above when it matches; otherwise show the address. Confirm a rotating token with `strat.isAllowedToken(token)`.

`isAllowedToken` is not enumerable. If the catalog might be stale, also scan `AllowedTokenSet` logs on that strategy.
