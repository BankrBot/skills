// Which of this skill's markets the DeltaDesk ledger covers today.
// Keys are DeltaDesk's tearsheet pool keys; `pool` must equal the pool in
// markets.mjs (selftest.mjs checks it). Markets not listed here are reported
// as "not in the ledger yet", never silently dropped.

export const CHAIN = "base";
export const VENUE = "Aerodrome (Base)";
export const COVERED = {
  "NVDAc/USDC": { market: "NVDA", pool: "0x853f5f1b92b16714fe6cda67caad0856b83c7ab9" },
};
