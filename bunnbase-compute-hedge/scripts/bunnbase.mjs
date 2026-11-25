#!/usr/bin/env node
/**
 * bunnbase.mjs — Zero-dependency read-only CLI for BunnBase (bunnvault.xyz)
 *
 * Queries BunnBase's Base Mainnet B20 Compute-Hedge Basket, B20 Liquidity &
 * Spread Scanner, B20 Pre-Flight Oracle, Morpho VaultV2 telemetry, and KYA
 * (ERC-8004 + EAS) Agent Verifier.
 *
 * Trust boundary: advisory & read-only. Never touches private keys, never
 * signs transactions, and validates all arguments locally before network I/O.
 */

const BASE_URL = 'https://bunnvault.xyz';
const TIMEOUT_MS = 12000;

const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const TICKER_RE = /^[A-Z0-9]{1,8}$/;
const PROVIDERS = new Set(['gemini', 'openai', 'anthropic', 'llama', 'aws', 'gcp', 'google', 'azure', 'groq', 'claude', 'gpt']);

function usage() {
  console.log(`BunnBase Compute-Hedge & B20 Intelligence CLI (Base Mainnet)

Usage:
  node scripts/bunnbase.mjs console
  node scripts/bunnbase.mjs vault
  node scripts/bunnbase.mjs balance <0xAddress>
  node scripts/bunnbase.mjs preflight <TICKER> [amountUsdc] [--payment <proof>]
  node scripts/bunnbase.mjs hedge <provider> <monthlyCostUsd> [--payment <proof>]
  node scripts/bunnbase.mjs scanner [TICKERS_CSV] [amountUsdc] [--payment <proof>]
  node scripts/bunnbase.mjs lend-route <0xWallet> <amountUsdc> [deposit|withdraw] [--payment <proof>]
  node scripts/bunnbase.mjs verify <0xAddress> [agentId] [httpsEndpointUrl] [--payment <proof>]

Environment:
  BUNNBASE_X402_PAYMENT   Optional X-PAYMENT header value for paid x402 endpoints
`);
}

function parseFlags(argv) {
  const positional = [];
  let paymentProof = process.env.BUNNBASE_X402_PAYMENT || '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--payment' && argv[i + 1]) {
      paymentProof = argv[++i];
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      usage();
      process.exit(0);
    } else {
      positional.push(argv[i]);
    }
  }
  return { positional, paymentProof };
}

function validateAddress(addr, label = 'address') {
  if (!addr || !EVM_ADDR_RE.test(addr)) {
    throw new Error(`Invalid ${label}: expected 0x-prefixed 40-hex-char EVM address.`);
  }
  return addr;
}

function validateTicker(raw) {
  const t = String(raw || '').trim().toUpperCase().replace(/C$/, '');
  if (!TICKER_RE.test(t)) {
    throw new Error(`Invalid ticker "${raw}": expected 1-8 alphanumeric characters (e.g. NVDA, GOOGL, ANT).`);
  }
  return t;
}

function validatePositiveNumber(raw, min, max, label) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`Invalid ${label}: expected a number between ${min} and ${max}.`);
  }
  return n;
}

function validatePublicHttpsUrl(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error('Invalid endpointUrl: must be a valid HTTPS URL.');
  }
  if (u.protocol !== 'https:') {
    throw new Error('Invalid endpointUrl: only https:// URLs are allowed.');
  }
  const h = u.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '0.0.0.0' ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.startsWith('169.254.') ||
    h.includes(':')
  ) {
    throw new Error('Invalid endpointUrl: private or local hosts are not allowed.');
  }
  return u.origin;
}

async function requestJson(method, path, body, paymentProof) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (paymentProof) headers['X-PAYMENT'] = paymentProof;

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 500) };
    }

    if (res.status === 402) {
      const headerChallenge = res.headers.get('payment-required') || res.headers.get('x-payment-required');
      let decodedChallenge = null;
      if (headerChallenge) {
        try {
          decodedChallenge = JSON.parse(Buffer.from(headerChallenge, 'base64').toString('utf8'));
        } catch {
          decodedChallenge = headerChallenge;
        }
      }
      console.log(JSON.stringify({
        status: 402,
        paymentRequired: true,
        endpoint: `${BASE_URL}${path}`,
        method,
        challenge: decodedChallenge || json,
        hint: 'Settle this x402 v2 challenge on Base Mainnet (eip155:8453) and retry with --payment <X-PAYMENT> or BUNNBASE_X402_PAYMENT.'
      }, null, 2));
      process.exit(2);
    }

    if (!res.ok) {
      console.error(JSON.stringify({ status: res.status, error: json }, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify(json, null, 2));
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const { positional, paymentProof } = parseFlags(process.argv.slice(2));
  const [cmd, ...args] = positional;

  if (!cmd) {
    usage();
    process.exit(1);
  }

  switch (cmd) {
    case 'console':
      return requestJson('GET', '/api/stocks/live-console', undefined, '');

    case 'vault':
      return requestJson('GET', '/api/lend/vault', undefined, '');

    case 'balance': {
      const addr = validateAddress(args[0], 'wallet address');
      return requestJson('GET', `/api/vault/balance/${encodeURIComponent(addr)}`, undefined, '');
    }

    case 'preflight': {
      const ticker = validateTicker(args[0]);
      const amountUsdc = args[1] !== undefined ? validatePositiveNumber(args[1], 0.5, 100000, 'amountUsdc') : 1;
      return requestJson('GET', `/api/stocks/b20-preflight/${encodeURIComponent(ticker)}?amountUsdc=${amountUsdc}`, undefined, paymentProof);
    }

    case 'hedge': {
      const provider = String(args[0] || 'gemini').trim().toLowerCase();
      if (!PROVIDERS.has(provider)) {
        throw new Error(`Unsupported provider "${provider}". Choose one of: ${[...PROVIDERS].join(', ')}`);
      }
      const monthlyCostUsd = validatePositiveNumber(args[1] ?? 25, 1, 100000, 'monthlyCostUsd');
      return requestJson('POST', '/api/stocks/compute-hedge', { provider, monthlyCostUsd }, paymentProof);
    }

    case 'scanner': {
      const tickersCsv = args[0] || 'NVDA,GOOGL,ANT,MSFT,AAPL,META';
      const cleaned = tickersCsv.split(',').map((t) => validateTicker(t)).slice(0, 10).join(',');
      const amountUsdc = args[1] !== undefined ? validatePositiveNumber(args[1], 0.5, 100000, 'amountUsdc') : 10;
      return requestJson('GET', `/api/stocks/b20-scanner?tickers=${encodeURIComponent(cleaned)}&amountUsdc=${amountUsdc}`, undefined, paymentProof);
    }

    case 'lend-route': {
      const wallet = validateAddress(args[0], 'wallet');
      const amountUsdc = validatePositiveNumber(args[1], 0.01, 10000000, 'amountUsdc');
      const action = String(args[2] || 'deposit').toLowerCase();
      if (action !== 'deposit' && action !== 'withdraw') {
        throw new Error('Invalid action: expected "deposit" or "withdraw".');
      }
      return requestJson('POST', '/api/lend/route', { wallet, amountUsdc, action }, paymentProof);
    }

    case 'verify': {
      const address = validateAddress(args[0], 'agent address');
      const body = { address };
      if (args[1] !== undefined && args[1] !== '') {
        if (!/^\d+$/.test(args[1])) throw new Error('Invalid agentId: expected non-negative integer.');
        body.agentId = Number(args[1]);
      }
      if (args[2] !== undefined && args[2] !== '') {
        body.endpointUrl = validatePublicHttpsUrl(args[2]);
      }
      return requestJson('POST', '/api/agents/verify', body, paymentProof);
    }

    default:
      throw new Error(`Unknown command "${cmd}". Run with --help to see available commands.`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
