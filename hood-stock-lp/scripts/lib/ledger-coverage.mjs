// Which of this skill's markets the DeltaDesk ledger covers today.
// Keys are DeltaDesk's tearsheet pool keys; `pool` must equal the pool in
// markets.mjs (selftest.mjs checks it). Markets not listed here are reported
// as "not in the ledger yet", never silently dropped.

export const CHAIN = "robinhood";
export const VENUE = "Robinhood Chain (Uniswap)";
export const COVERED = {
  "NVDA/USDG": { market: "NVDA", pool: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3" },
  "SPY/USDG": { market: "SPY", pool: "0xe5923c8a8be481ec89a2ca784a2bbfa4235de6d88f92260fd66b660c4babf907" },
  "TSLA/USDG": { market: "TSLA", pool: "0x8517f8071ae5b831b738052f12125e8e3d6c158b78728aa44ce3b25e5104d32e" },
};
