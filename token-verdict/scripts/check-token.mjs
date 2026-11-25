// Token Verdict — plain x402 client (framework-agnostic)
// ======================================================
// POST a Base token address, get a verdict card back:
//   { verdict: "clean" | "caution" | "rug_risk" | "exit_trap",
//     score: 0-100, reasons: [...], facts: { liquidity, holders, honeypot/mint flags, ... } }
//
// Price: $0.02/call, USDC on Base, paid via x402. No API key.
// Endpoint: https://crypto-intel-agent.vercel.app/api/token-verdict
//
// Install:  npm i @x402/fetch @x402/evm viem
// Run:      EVM_PRIVATE_KEY=0x... node token-verdict.mjs 0x<token-address>
// No key?   It runs a free dry-run: sends the unpaid request, prints the
//           402 payment challenge (price / network / payTo), pays nothing.
//
// This exact client pattern (@x402/fetch + registerExactEvmScheme) is the
// one used for Token Verdict's own settled bootstrap calls on Base.

import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

export const TOKEN_VERDICT_URL =
  "https://crypto-intel-agent.vercel.app/api/token-verdict";
export const TOKEN_VERDICT_PRICE_USD = 0.02;

/**
 * Get a Token Verdict for a Base token.
 * @param {string} address  Token contract address on Base (0x…)
 * @param {import("viem").Account} signer  viem account holding USDC on Base
 * @returns {Promise<object>} the verdict card JSON
 */
export async function getTokenVerdict(address, signer) {
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(TOKEN_VERDICT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, chain: "base" }),
  });
  if (!res.ok) {
    // 502 = data sources could not produce a verdict. x402 does not
    // settle on a failed response — you are never charged for it.
    throw new Error(`Token Verdict failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * The pre-trade gate: only proceed when the verdict allows it.
 * rug_risk / exit_trap => do not trade. caution => trade small or skip.
 */
export function isTradeAllowed(verdictCard) {
  return verdictCard.verdict === "clean" || verdictCard.verdict === "caution";
}

// --- CLI / dry-run ---------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const address = process.argv[2] || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
  const key = process.env.EVM_PRIVATE_KEY;

  if (!key) {
    console.log("No EVM_PRIVATE_KEY set — dry run only, nothing will be paid.");
    const res = await fetch(TOKEN_VERDICT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, chain: "base" }),
    });
    console.log("HTTP status:", res.status, "(402 = payment challenge, as expected)");
    const challenge = res.headers.get("payment-required");
    if (challenge) {
      const decoded = JSON.parse(Buffer.from(challenge, "base64").toString("utf8"));
      const option = decoded.accepts?.[0] ?? {};
      console.log("Price:", option.amount, "atomic USDC =", `$${Number(option.amount) / 1e6}`);
      console.log("Network:", option.network, "| Pay to:", option.payTo);
    }
    process.exit(0);
  }

  const signer = privateKeyToAccount(key);
  const card = await getTokenVerdict(address, signer);
  console.log(JSON.stringify(card, null, 2));
  console.log("Trade allowed:", isTradeAllowed(card));
}
