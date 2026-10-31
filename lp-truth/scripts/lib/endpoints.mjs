// DeltaDesk x402 base URL: the Bankr wallet that deployed the endpoints (bankr x402 deploy, 2026-09-19).
export const DELTADESK_WALLET = "0xd8d5b9389721258bcdfa7ac1306af6330e5634cd";
export const BASE = `https://x402.bankr.bot/${DELTADESK_WALLET}/`;
export const POOLS = ["NVDA", "SPY", "TSLA", "QQQ-SPY"];
// Price per call in USD (USDC on Base), as deployed in bankr.x402.json.
export const PRICES = { "safe-to-lp": 0.005, "fair-value": 0.002, "pool-toxicity": 0.01, tearsheet: 0.05, "lp-league": 0.02 };
export const url = (service, params = {}) => `${BASE}${service}?${new URLSearchParams(params)}`;
