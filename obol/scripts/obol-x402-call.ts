#!/usr/bin/env bun
// @ts-nocheck — runs under bun; IDE doesn't have @types/node loaded.
/**
 * obol-x402-call.ts — call an x402-protected URL, signing the payment via the Bankr Wallet API.
 *
 * Handles x402 v1 AND v2 wire formats:
 *   - v1: `maxAmountRequired`, plain network names ("ethereum"), `X-PAYMENT` header
 *   - v2: `amount`, CAIP-2 networks ("eip155:1"), `PAYMENT-SIGNATURE` header,
 *         `extra.assetTransferMethod`, top-level `extensions` (incl. `eip2612GasSponsoring`)
 *
 * Settlement schemes:
 *   - EIP-3009 `TransferWithAuthorization` for the standard `exact` scheme (USDC etc.).
 *   - EIP-2612 `Permit` when the seller signals gas-sponsored permit batching
 *     (`extensions.eip2612GasSponsoring` present, or `extra.permit: true`, or
 *     `extra.assetTransferMethod === "permit2"` on a token that supports EIP-2612).
 *
 * The script reads the asset's decimals from a built-in registry (USDC, OBOL, USDT, DAI)
 * and falls back to an on-chain `decimals()` read for unknown tokens. The probe prints a
 * human-readable price ("1.0 OBOL" / "0.01 USDC") alongside the raw base units so an
 * agent doesn't misread the amount as an unrelated token's units.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const USAGE = `obol-x402-call.ts — call an x402-protected URL, paying via the Bankr Wallet API.

Usage:
  bun obol-x402-call.ts [options] URL

Options:
  -X, --method METHOD   HTTP method (default GET)
  -d, --data BODY       Request body (sent on both the initial and retry request)
  -H, --header H        Extra header, e.g. -H "Accept: application/json" (repeatable)
      --probe           Probe only — show the 402 challenge, do not pay
      --max-amount N    Refuse to sign if the asking price exceeds N base units
      --from 0xADDRESS  Override the buyer address (default: from /wallet/me)
      --rpc-url URL     RPC for on-chain reads (EIP-2612 nonce, decimals). Default: mainnet publicnode
      --force-permit    Force EIP-2612 path even if the server didn't explicitly request it
  -v, --verbose         Print intermediate state to stderr
  -h, --help            This message
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Args = {
  url: string;
  method: string;
  body?: string;
  headers: Record<string, string>;
  probe: boolean;
  maxAmount?: bigint;
  from?: string;
  rpcUrl: string;
  forcePermit: boolean;
  verbose: boolean;
};

type Accept = {
  scheme: string;
  network: string; // CAIP-2 ("eip155:1") or v1 ("ethereum")
  asset: string;
  payTo: string;
  /** v2 field */
  amount?: string;
  /** v1 field (legacy) */
  maxAmountRequired?: string;
  maxTimeoutSeconds?: number;
  extra?: {
    name?: string;
    version?: string;
    permit?: boolean; // v1 hint
    assetTransferMethod?: string; // v2: "permit2" | "transferWithAuthorization" | ...
    spender?: string;
  };
};

type Challenge = {
  x402Version: number;
  accepts: Accept[];
  extensions?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Known-token registry — keeps the agent from confusing OBOL (18 dec) with USDC (6 dec).
// Add tokens here as needed. Address keys are lowercase + chainId-scoped.
// ---------------------------------------------------------------------------

type TokenInfo = { symbol: string; decimals: number; supportsEip2612?: boolean };

const KNOWN_TOKENS: Record<string, TokenInfo> = {
  // OBOL — Ethereum mainnet
  "1:0x0b010000b7624eb9b3dfbc279673c76e9d29d5f7": { symbol: "OBOL", decimals: 18, supportsEip2612: true },
  // USDC — Ethereum mainnet (legacy/bridged 6-dec)
  "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDC — Base (native CCTP)
  "8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDC — Base Sepolia
  "84532:0x036cbd53842c5426634e7929541ec2318f3dcf7e": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDC — Polygon (native)
  "137:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDC — Arbitrum One (native)
  "42161:0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDC — Avalanche C-Chain
  "43114:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDC — Optimism (native)
  "10:0x0b2c639c533813f4aa9d7837caf62653d097ff85": { symbol: "USDC", decimals: 6, supportsEip2612: false },
  // USDT — Ethereum mainnet
  "1:0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6, supportsEip2612: false },
  // DAI — Ethereum mainnet (DAI has its own permit, not strictly EIP-2612)
  "1:0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18, supportsEip2612: true },
};

function tokenInfo(chainId: number, asset: string): TokenInfo | undefined {
  return KNOWN_TOKENS[`${chainId}:${asset.toLowerCase()}`];
}

function formatAmount(raw: bigint, decimals: number, symbol: string): string {
  if (decimals === 0) return `${raw} ${symbol}`;
  const div = 10n ** BigInt(decimals);
  const whole = raw / div;
  const frac = raw % div;
  if (frac === 0n) return `${whole} ${symbol}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} ${symbol}`;
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    url: "",
    method: "GET",
    headers: {},
    probe: false,
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    forcePermit: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    switch (t) {
      case "-X": case "--method": a.method = argv[++i]; break;
      case "-d": case "--data": a.body = argv[++i]; break;
      case "-H": case "--header": {
        const h = argv[++i];
        const idx = h.indexOf(":");
        if (idx < 0) die(`bad header (need 'Key: value'): ${h}`);
        a.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        break;
      }
      case "--probe": a.probe = true; break;
      case "--max-amount": a.maxAmount = BigInt(argv[++i]); break;
      case "--from": a.from = argv[++i]; break;
      case "--rpc-url": a.rpcUrl = argv[++i]; break;
      case "--force-permit": a.forcePermit = true; break;
      case "-v": case "--verbose": a.verbose = true; break;
      case "-h": case "--help": process.stdout.write(USAGE); process.exit(0);
      default:
        if (t.startsWith("-")) die(`unknown flag: ${t}`);
        a.url = t;
    }
  }
  if (!a.url) die("URL is required (use -h for usage).");
  return a;
}

// ---------------------------------------------------------------------------
// Bankr config
// ---------------------------------------------------------------------------

function loadBankrConfig(): { apiKey: string; apiUrl: string } {
  const home = process.env.CLAWDBOT_HOME ?? join(homedir(), ".clawdbot");
  const path = join(home, "skills", "bankr", "config.json");
  if (!existsSync(path)) die(`missing ${path} — set up the bankr skill first.`);
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  if (!cfg.apiKey) die(`apiKey missing in ${path}`);
  return { apiKey: cfg.apiKey, apiUrl: cfg.apiUrl ?? "https://api.bankr.bot" };
}

// ---------------------------------------------------------------------------
// Network parsing — v2 CAIP-2 (`eip155:<chainId>`) and v1 plain names
// ---------------------------------------------------------------------------

const V1_NETWORK_TO_CHAIN: Record<string, number> = {
  ethereum: 1, mainnet: 1,
  base: 8453, "base-sepolia": 84532,
  polygon: 137, "polygon-amoy": 80002,
  avalanche: 43114, "avalanche-fuji": 43113,
  "arbitrum-one": 42161, arbitrum: 42161, "arbitrum-sepolia": 421614,
  optimism: 10, "optimism-sepolia": 11155420,
};

function networkToChainId(network: string): number {
  // CAIP-2: namespace:reference (e.g., eip155:1)
  if (network.startsWith("eip155:")) {
    const id = Number(network.slice("eip155:".length));
    if (Number.isFinite(id) && id > 0) return id;
    die(`malformed CAIP-2 network: ${network}`);
  }
  const id = V1_NETWORK_TO_CHAIN[network];
  if (!id) die(`unknown x402 network: ${network}`);
  return id;
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function randomBytes32Hex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

// ---------------------------------------------------------------------------
// Bankr API calls
// ---------------------------------------------------------------------------

async function fetchWalletAddress(cfg: { apiKey: string; apiUrl: string }, override?: string): Promise<string> {
  if (override) return override;
  const r = await fetch(`${cfg.apiUrl}/wallet/me`, { headers: { "X-API-Key": cfg.apiKey } });
  const text = await r.text();
  if (!r.ok) die(`/wallet/me returned ${r.status}: ${text}`);
  let body: any;
  try { body = JSON.parse(text); } catch { die(`/wallet/me returned non-JSON: ${text}`); }
  const candidates: unknown[] = [
    body?.address,
    body?.wallet?.address,
    body?.evmAddress,
    ...(Array.isArray(body?.addresses) ? body.addresses : []),
    ...(Array.isArray(body?.wallets) ? body.wallets.map((w: any) => w?.address) : []),
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^0x[0-9a-fA-F]{40}$/.test(c)) return c;
  }
  die(`could not extract EVM address from /wallet/me — pass --from 0x... explicitly. Body was: ${text}`);
}

async function signTypedData(
  cfg: { apiKey: string; apiUrl: string },
  typedData: unknown,
  verbose: boolean,
): Promise<string> {
  if (verbose) console.error(`» POST ${cfg.apiUrl}/wallet/sign`);
  const r = await fetch(`${cfg.apiUrl}/wallet/sign`, {
    method: "POST",
    headers: { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ signatureType: "eth_signTypedData_v4", typedData }),
  });
  const text = await r.text();
  if (!r.ok) die(`/wallet/sign returned ${r.status}: ${text}`);
  let body: any;
  try { body = JSON.parse(text); } catch { die(`/wallet/sign returned non-JSON: ${text}`); }
  if (typeof body?.signature !== "string") {
    die(`no signature in /wallet/sign response — key may be read-only or missing Wallet API access. Body: ${text}`);
  }
  return body.signature;
}

// ---------------------------------------------------------------------------
// On-chain reads (RPC)
// ---------------------------------------------------------------------------

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const j: any = await r.json();
  if (!j?.result) die(`eth_call to ${to} failed: ${JSON.stringify(j)}`);
  return j.result as string;
}

// function selector for nonces(address): 0x7ecebe00
async function readPermitNonce(rpcUrl: string, token: string, owner: string): Promise<string> {
  const padded = owner.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  return BigInt(await ethCall(rpcUrl, token, `0x7ecebe00${padded}`)).toString();
}

// function selector for decimals(): 0x313ce567
async function readDecimals(rpcUrl: string, token: string): Promise<number> {
  const hex = await ethCall(rpcUrl, token, "0x313ce567");
  return Number(BigInt(hex));
}

// ---------------------------------------------------------------------------
// EIP-712 typed data builders
// ---------------------------------------------------------------------------

function buildEip3009(args: {
  from: string; to: string; value: string; chainId: number; asset: string;
  name: string; version: string; validBefore: number; nonce: string;
}) {
  return {
    domain: { name: args.name, version: args.version, chainId: args.chainId, verifyingContract: args.asset },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: args.from, to: args.to, value: args.value,
      validAfter: "0", validBefore: String(args.validBefore), nonce: args.nonce,
    },
  };
}

function buildEip2612(args: {
  owner: string; spender: string; value: string; chainId: number; asset: string;
  name: string; version: string; deadline: number; nonce: string;
}) {
  return {
    domain: { name: args.name, version: args.version, chainId: args.chainId, verifyingContract: args.asset },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: {
      owner: args.owner, spender: args.spender, value: args.value,
      nonce: args.nonce, deadline: String(args.deadline),
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP wrapper
// ---------------------------------------------------------------------------

async function doRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  paymentHeaders: Record<string, string> | undefined,
): Promise<{ status: number; text: string; headers: Headers }> {
  const h: Record<string, string> = { ...headers, ...(paymentHeaders ?? {}) };
  if (body && !h["Content-Type"] && !h["content-type"]) h["Content-Type"] = "application/json";
  const r = await fetch(url, { method, headers: h, body });
  return { status: r.status, text: await r.text(), headers: r.headers };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (msg: string) => args.verbose && console.error(`» ${msg}`);

  // step 1: unpaid request
  log(`${args.method} ${args.url} (no payment)`);
  const first = await doRequest(args.url, args.method, args.headers, args.body, undefined);

  if (first.status === 200) {
    process.stdout.write(first.text);
    return;
  }
  if (first.status !== 402) {
    process.stderr.write(first.text + "\n");
    die(`expected 200 or 402, got ${first.status}`);
  }

  // step 2: parse 402 (v2 may use PAYMENT-REQUIRED header; v1 uses body)
  let challenge: Challenge | undefined;
  const headerChallenge = first.headers.get("payment-required") ?? first.headers.get("PAYMENT-REQUIRED");
  if (headerChallenge) {
    try { challenge = JSON.parse(Buffer.from(headerChallenge, "base64").toString("utf8")); }
    catch { die(`could not decode PAYMENT-REQUIRED header: ${headerChallenge}`); }
  } else if (first.text) {
    try { challenge = JSON.parse(first.text); }
    catch { die(`402 body is not JSON:\n${first.text}`); }
  }
  if (!challenge?.accepts?.[0]) die(`no payment challenge found in 402 response`);

  const x402Version = challenge.x402Version ?? 1;
  const extensions = challenge.extensions ?? {};
  const accept = challenge.accepts[0];

  const scheme = accept.scheme;
  const network = accept.network;
  const asset = accept.asset;
  const payTo = accept.payTo;
  const amountRaw = accept.amount ?? accept.maxAmountRequired;
  if (!amountRaw) die(`accept entry has no amount/maxAmountRequired field`);
  const timeoutS = accept.maxTimeoutSeconds ?? 60;
  const extra = accept.extra ?? {};
  const xferMethod = extra.assetTransferMethod;
  const eip2612Sponsored = "eip2612GasSponsoring" in extensions;

  const chainId = networkToChainId(network);

  // Asset metadata: prefer known registry, fall back to on-chain decimals()
  const known = tokenInfo(chainId, asset);
  let symbol = known?.symbol ?? extra.name ?? "TOKEN";
  let decimals = known?.decimals;
  if (decimals === undefined) {
    log(`unknown token ${asset} on chain ${chainId} — reading decimals() on-chain`);
    try { decimals = await readDecimals(args.rpcUrl, asset); }
    catch (e) {
      console.error(`(warning: could not read decimals from chain — falling back to 18. Use known-token registry to fix.)`);
      decimals = 18;
    }
  }

  const amountBI = BigInt(amountRaw);
  const human = formatAmount(amountBI, decimals, symbol);

  // Pick signing path
  let usePermit = false;
  let permitReason = "";
  if (args.forcePermit) {
    usePermit = true; permitReason = "--force-permit";
  } else if (extra.permit === true) {
    usePermit = true; permitReason = "extra.permit:true (v1)";
  } else if (xferMethod === "permit2") {
    // Server signals permit2/permit-style transfer. For tokens that natively support EIP-2612
    // (e.g., OBOL, DAI), the Obol facilitator with `eip2612GasSponsoring` batches the
    // native permit + transferFrom in one settlement tx. We sign EIP-2612.
    if (known?.supportsEip2612 || eip2612Sponsored) {
      usePermit = true;
      permitReason = `extra.assetTransferMethod=permit2 + ${known?.supportsEip2612 ? "known EIP-2612 token" : "extensions.eip2612GasSponsoring"}`;
    } else {
      die(`seller asks for assetTransferMethod=permit2 but token ${symbol} (${asset}) isn't known to support EIP-2612 native permit. Add it to KNOWN_TOKENS with supportsEip2612:true or use --force-permit if you're sure.`);
    }
  } else if (eip2612Sponsored && known?.supportsEip2612) {
    usePermit = true;
    permitReason = "extensions.eip2612GasSponsoring + known EIP-2612 token";
  }

  // Print the challenge — agent reads THIS, not just raw base units
  console.error("x402 challenge:");
  console.error(`  x402 version: ${x402Version}`);
  console.error(`  scheme:       ${scheme}`);
  console.error(`  network:      ${network} (chainId ${chainId})`);
  console.error(`  asset:        ${asset} (${symbol}, ${decimals} decimals)`);
  console.error(`  payTo:        ${payTo}`);
  console.error(`  price:        ${human}  (= ${amountRaw} base units)`);
  console.error(`  expires:      ${timeoutS}s after sig`);
  console.error(`  path:         ${usePermit ? `EIP-2612 Permit (${permitReason})` : "EIP-3009 TransferWithAuthorization"}`);
  if (Object.keys(extensions).length) {
    console.error(`  extensions:   ${Object.keys(extensions).join(", ")}`);
  }

  if (args.probe) return;

  if (args.maxAmount !== undefined && amountBI > args.maxAmount) {
    die(`seller asks ${amountRaw} base units (${human}) but --max-amount cap is ${args.maxAmount} — refusing.`);
  }

  if (scheme !== "exact") die(`unsupported x402 scheme: ${scheme} (only 'exact' handled)`);

  const cfg = loadBankrConfig();
  const from = await fetchWalletAddress(cfg, args.from);
  log(`buyer wallet: ${from}`);

  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + Number(timeoutS);

  // step 3: build typed data + sign
  const tokenName = extra.name ?? symbol;
  const tokenVersion = extra.version ?? "1";

  let payload: Record<string, unknown>;
  if (usePermit) {
    const spender = extra.spender ?? payTo;
    const nonce = await readPermitNonce(args.rpcUrl, asset, from);
    log(`permit spender: ${spender}`);
    log(`permit nonce:   ${nonce}`);
    const typed = buildEip2612({
      owner: from, spender, value: String(amountBI), chainId, asset,
      name: tokenName, version: tokenVersion, deadline: validBefore, nonce,
    });
    const sig = await signTypedData(cfg, typed, args.verbose);
    payload = {
      signature: sig,
      permit: {
        owner: from, spender, value: String(amountBI),
        nonce, deadline: String(validBefore),
      },
      payTo,
    };
  } else {
    const nonceHex = randomBytes32Hex();
    const typed = buildEip3009({
      from, to: payTo, value: String(amountBI), chainId, asset,
      name: tokenName, version: tokenVersion, validBefore, nonce: nonceHex,
    });
    const sig = await signTypedData(cfg, typed, args.verbose);
    payload = {
      signature: sig,
      authorization: {
        from, to: payTo, value: String(amountBI),
        validAfter: "0", validBefore: String(validBefore), nonce: nonceHex,
      },
    };
  }

  // step 4: build the PaymentPayload envelope
  // v2 echoes `accepted` (the chosen accept entry) + `extensions`; v1 doesn't.
  const envelope: Record<string, unknown> =
    x402Version >= 2
      ? {
          x402Version,
          scheme, network,
          accepted: accept,
          extensions,
          payload,
        }
      : { x402Version, scheme, network, payload };

  const envelopeJson = JSON.stringify(envelope);
  const envelopeB64 = base64(envelopeJson);
  log(`payment envelope: ${envelopeJson}`);

  // step 5: retry with payment header. v2 uses PAYMENT-SIGNATURE; v1 uses X-PAYMENT.
  // Send both to be safe with sellers in transition.
  const paymentHeaders = x402Version >= 2
    ? { "PAYMENT-SIGNATURE": envelopeB64, "X-PAYMENT": envelopeB64 }
    : { "X-PAYMENT": envelopeB64 };

  log(`retrying ${args.method} ${args.url} with ${Object.keys(paymentHeaders).join(", ")}`);
  const second = await doRequest(args.url, args.method, args.headers, args.body, paymentHeaders);

  // Settlement response (if present) — both v1 and v2 surface this via response header.
  const respHeader =
    second.headers.get("payment-response") ?? second.headers.get("PAYMENT-RESPONSE") ??
    second.headers.get("x-payment-response") ?? second.headers.get("X-PAYMENT-RESPONSE");
  if (respHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(respHeader, "base64").toString("utf8"));
      console.error(`payment receipt: ${JSON.stringify(decoded)}`);
    } catch { /* not base64 JSON — ignore */ }
  }

  if (second.status !== 200) {
    process.stderr.write(second.text + "\n");
    die(`paid request returned ${second.status}. Verify network/asset/chainId and that buyer wallet ${from} holds enough ${symbol}.`);
  }
  process.stdout.write(second.text);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
