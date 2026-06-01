#!/usr/bin/env bun
/**
 * obol-x402-call.ts — call an x402-protected URL, signing the payment via the Bankr Wallet API.
 *
 * Flow:
 *   1. Issue the request to the target URL without payment.
 *   2. On 200, print the body and exit.
 *   3. On 402, parse the `accepts` array and pick the first acceptable entry.
 *   4. Build an EIP-712 typed-data structure that matches the server's payment requirements:
 *        - EIP-3009 `TransferWithAuthorization` for the standard `exact` scheme (USDC etc.).
 *        - EIP-2612 `Permit` if the accept entry sets `extra.permit: true` (e.g. $OBOL on mainnet).
 *   5. Sign via POST /wallet/sign on api.bankr.bot (signatureType: eth_signTypedData_v4).
 *   6. Wrap the signature + authorization in JSON, base64-encode, send as X-PAYMENT header.
 *   7. Print the paid response body.
 *
 * Usage:
 *   bun obol-x402-call.ts [options] URL
 *
 * Options:
 *   -X, --method METHOD     HTTP method (default GET)
 *   -d, --data BODY         Request body (sent on the initial AND retry request)
 *   -H, --header H          Extra request header, e.g. -H "Accept: application/json" (repeatable)
 *       --probe             Probe only — show the 402 challenge, do not sign or pay
 *       --max-amount N      Refuse to sign if maxAmountRequired exceeds N (token base units)
 *       --from 0xADDRESS    Override the buyer address (default: from /wallet/me)
 *       --rpc-url URL       RPC for on-chain nonce read (EIP-2612 only). Default: ethereum-rpc.publicnode.com
 *   -v, --verbose           Print intermediate state to stderr
 *   -h, --help              This message
 *
 * Requires:
 *   - bun (v1+)
 *   - ~/.clawdbot/skills/bankr/config.json with { apiKey, apiUrl? }
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
      --max-amount N    Refuse to sign if maxAmountRequired exceeds N (token base units)
      --from 0xADDRESS  Override the buyer address (default: from /wallet/me)
      --rpc-url URL     RPC for EIP-2612 nonce reads. Default: ethereum-rpc.publicnode.com
  -v, --verbose         Print intermediate state to stderr
  -h, --help            This message
`;

type Args = {
  url: string;
  method: string;
  body?: string;
  headers: Record<string, string>;
  probe: boolean;
  maxAmount?: bigint;
  from?: string;
  rpcUrl: string;
  verbose: boolean;
};

const DEFAULT_RPC = "https://ethereum-rpc.publicnode.com";

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
    rpcUrl: DEFAULT_RPC,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    switch (t) {
      case "-X":
      case "--method":
        a.method = argv[++i];
        break;
      case "-d":
      case "--data":
        a.body = argv[++i];
        break;
      case "-H":
      case "--header": {
        const h = argv[++i];
        const idx = h.indexOf(":");
        if (idx < 0) die(`bad header (need 'Key: value'): ${h}`);
        a.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        break;
      }
      case "--probe":
        a.probe = true;
        break;
      case "--max-amount":
        a.maxAmount = BigInt(argv[++i]);
        break;
      case "--from":
        a.from = argv[++i];
        break;
      case "--rpc-url":
        a.rpcUrl = argv[++i];
        break;
      case "-v":
      case "--verbose":
        a.verbose = true;
        break;
      case "-h":
      case "--help":
        process.stdout.write(USAGE);
        process.exit(0);
      default:
        if (t.startsWith("-")) die(`unknown flag: ${t}`);
        a.url = t;
    }
  }
  if (!a.url) die("URL is required (use -h for usage).");
  return a;
}

function loadBankrConfig(): { apiKey: string; apiUrl: string } {
  const home = process.env.CLAWDBOT_HOME ?? join(homedir(), ".clawdbot");
  const path = join(home, "skills", "bankr", "config.json");
  if (!existsSync(path)) die(`missing ${path} — set up the bankr skill first.`);
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  if (!cfg.apiKey) die(`apiKey missing in ${path}`);
  return { apiKey: cfg.apiKey, apiUrl: cfg.apiUrl ?? "https://api.bankr.bot" };
}

function networkToChainId(network: string): number {
  const map: Record<string, number> = {
    base: 8453,
    "base-sepolia": 84532,
    ethereum: 1,
    mainnet: 1,
    polygon: 137,
    "polygon-amoy": 80002,
    avalanche: 43114,
    "avalanche-fuji": 43113,
    "arbitrum-one": 42161,
    arbitrum: 42161,
    "arbitrum-sepolia": 421614,
    optimism: 10,
    "optimism-sepolia": 11155420,
  };
  const id = map[network];
  if (!id) die(`unknown x402 network: ${network}`);
  return id;
}

function randomBytes32Hex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

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

async function readPermitNonce(token: string, owner: string, rpcUrl: string): Promise<string> {
  // function selector for nonces(address): 0x7ecebe00
  const padded = owner.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const data = `0x7ecebe00${padded}`;
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: token, data }, "latest"] }),
  });
  const j: any = await r.json();
  if (!j?.result) die(`eth_call(nonces) failed: ${JSON.stringify(j)}`);
  return BigInt(j.result).toString();
}

function buildEip3009(args: {
  from: string; to: string; value: string; chainId: number; asset: string;
  name: string; version: string; validBefore: number; nonce: string;
}) {
  return {
    domain: {
      name: args.name,
      version: args.version,
      chainId: args.chainId,
      verifyingContract: args.asset,
    },
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
      from: args.from,
      to: args.to,
      value: args.value,
      validAfter: "0",
      validBefore: String(args.validBefore),
      nonce: args.nonce,
    },
  };
}

function buildEip2612(args: {
  owner: string; spender: string; value: string; chainId: number; asset: string;
  name: string; version: string; deadline: number; nonce: string;
}) {
  return {
    domain: {
      name: args.name,
      version: args.version,
      chainId: args.chainId,
      verifyingContract: args.asset,
    },
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
      owner: args.owner,
      spender: args.spender,
      value: args.value,
      nonce: args.nonce,
      deadline: String(args.deadline),
    },
  };
}

async function doRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  xPayment: string | undefined,
): Promise<{ status: number; text: string }> {
  const h: Record<string, string> = { ...headers };
  if (xPayment) h["X-PAYMENT"] = xPayment;
  if (body && !h["Content-Type"] && !h["content-type"]) h["Content-Type"] = "application/json";
  const r = await fetch(url, { method, headers: h, body });
  return { status: r.status, text: await r.text() };
}

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

  // step 2: parse 402
  let challenge: any;
  try { challenge = JSON.parse(first.text); } catch { die(`402 body is not JSON:\n${first.text}`); }
  const accept = challenge?.accepts?.[0];
  if (!accept) die(`402 body has no accepts[0]:\n${first.text}`);

  const {
    scheme, network, asset, payTo,
    maxAmountRequired: maxAmt,
    maxTimeoutSeconds: timeoutS = 60,
    extra = {},
  } = accept;
  const name = extra.name ?? "";
  const version = extra.version ?? "1";
  const usePermit = extra.permit === true;

  console.error("x402 challenge:");
  console.error(`  scheme:  ${scheme}`);
  console.error(`  network: ${network}`);
  console.error(`  asset:   ${asset}`);
  console.error(`  payTo:   ${payTo}`);
  console.error(`  amount:  ${maxAmt} (base units, ${name} v${version})`);
  console.error(`  expires: ${timeoutS}s after sig${usePermit ? "  [EIP-2612 permit path]" : ""}`);

  if (args.probe) return;

  const cfg = loadBankrConfig();

  if (args.maxAmount !== undefined && BigInt(maxAmt) > args.maxAmount) {
    die(`seller asks ${maxAmt} but --max-amount cap is ${args.maxAmount} — refusing.`);
  }
  if (scheme !== "exact") die(`unsupported x402 scheme: ${scheme} (only 'exact' handled here)`);

  const chainId = networkToChainId(network);
  const from = await fetchWalletAddress(cfg, args.from);
  log(`buyer wallet: ${from}`);
  log(`chainId:      ${chainId}`);

  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + Number(timeoutS);

  // step 3: typed-data + sign
  let payload: any;
  if (usePermit) {
    const spender = extra.spender ?? payTo;
    const nonce = await readPermitNonce(asset, from, args.rpcUrl);
    log(`permit spender: ${spender}`);
    log(`permit nonce (on-chain): ${nonce}`);
    const typed = buildEip2612({
      owner: from, spender, value: String(maxAmt), chainId, asset, name, version,
      deadline: validBefore, nonce,
    });
    const sig = await signTypedData(cfg, typed, args.verbose);
    payload = {
      signature: sig,
      permit: {
        owner: from, spender, value: String(maxAmt),
        nonce, deadline: String(validBefore),
      },
      payTo,
    };
  } else {
    const nonceHex = randomBytes32Hex();
    const typed = buildEip3009({
      from, to: payTo, value: String(maxAmt), chainId, asset, name, version,
      validBefore, nonce: nonceHex,
    });
    const sig = await signTypedData(cfg, typed, args.verbose);
    payload = {
      signature: sig,
      authorization: {
        from, to: payTo, value: String(maxAmt),
        validAfter: "0", validBefore: String(validBefore), nonce: nonceHex,
      },
    };
  }

  // step 4: X-PAYMENT
  const xPaymentJson = JSON.stringify({ x402Version: 1, scheme, network, payload });
  const xPaymentB64 = base64(xPaymentJson);
  log(`X-PAYMENT (json): ${xPaymentJson}`);

  // step 5: paid retry
  log(`retrying ${args.method} ${args.url} with X-PAYMENT header`);
  const second = await doRequest(args.url, args.method, args.headers, args.body, xPaymentB64);

  if (second.status !== 200) {
    process.stderr.write(second.text + "\n");
    die(
      `paid request returned ${second.status}. Verify network/asset/chainId and ` +
      `that the buyer wallet (${from}) holds enough ${name || "of the asset"}.`,
    );
  }
  process.stdout.write(second.text);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
