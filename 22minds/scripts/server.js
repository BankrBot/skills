import express from "express";
import cors from "cors";
import { ethers } from "ethers";

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// x402 PAYMENT CONFIG
// ============================================
const PAYMENT_WALLET = "0xd16f8c10e7a696a3e46093c60ede43d5594d2bad";
const PRICE_ETH = "0.00005"; // ~$0.12 per query
const CHAIN_ID = 8453; // Base
const FREE_TIER_LIMIT = 3; // 3 free per day per IP
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const verifiedPayments = new Map();
const freeTierUsage = new Map(); // IP -> { count, resetTime }

// ============================================
// BANKR LLM GATEWAY CONFIG
// ============================================
const BANKR_API = process.env.BANKR_API_KEY;
if (!BANKR_API) {
  console.error("ERROR: Set BANKR_API_KEY environment variable");
  process.exit(1);
}

const LLM_BASE = "https://llm.bankr.bot/v1";
const LLM_ENDPOINT = LLM_BASE + "/chat/completions";

// Fallback model list — used only if gateway discovery fails
const FALLBACK_MODELS = [
  { id: "claude-opus-4.6", name: "Opus 4.6", family: "Claude", weight: 1.5 },
  { id: "claude-opus-4.5", name: "Opus 4.5", family: "Claude", weight: 1.4 },
  { id: "claude-sonnet-4.6", name: "Sonnet 4.6", family: "Claude", weight: 1.3 },
  { id: "claude-sonnet-4.5", name: "Sonnet 4.5", family: "Claude", weight: 1.2 },
  { id: "claude-haiku-4.5", name: "Haiku 4.5", family: "Claude", weight: 0.8 },
  { id: "gemini-3-pro", name: "3 Pro", family: "Gemini", weight: 1.3 },
  { id: "gemini-3-flash", name: "3 Flash", family: "Gemini", weight: 0.9 },
  { id: "gemini-2.5-pro", name: "2.5 Pro", family: "Gemini", weight: 1.1 },
  { id: "gemini-2.5-flash", name: "2.5 Flash", family: "Gemini", weight: 0.8 },
  { id: "gpt-5.2", name: "5.2", family: "OpenAI", weight: 1.3 },
  { id: "gpt-5.2-codex", name: "5.2 Codex", family: "OpenAI", weight: 1.0 },
  { id: "gpt-5-mini", name: "5 Mini", family: "OpenAI", weight: 0.8 },
  { id: "gpt-5-nano", name: "5 Nano", family: "OpenAI", weight: 0.6 },
  { id: "kimi-k2.5", name: "K2.5", family: "Moonshot", weight: 1.0 },
  { id: "qwen3-coder", name: "Coder", family: "Qwen", weight: 0.9 },
];

let MODELS = [...FALLBACK_MODELS];

// ============================================
// MODEL AUTO-DISCOVERY
// ============================================
function classifyModel(id) {
  // Derive family, display name, and weight from model ID
  const weights = {
    "opus-4.6": 1.5, "opus-4.5": 1.4, "sonnet-4.6": 1.3, "sonnet-4.5": 1.2, "haiku-4.5": 0.8,
    "3-pro": 1.3, "3-flash": 0.9, "2.5-pro": 1.1, "2.5-flash": 0.8,
    "5.2": 1.3, "5.2-codex": 1.0, "5-mini": 0.8, "5-nano": 0.6,
    "k2.5": 1.0, "coder": 0.9,
  };

  let family = "Unknown";
  if (id.startsWith("claude-")) family = "Claude";
  else if (id.startsWith("gemini-")) family = "Gemini";
  else if (id.startsWith("gpt-")) family = "OpenAI";
  else if (id.startsWith("kimi-")) family = "Moonshot";
  else if (id.startsWith("qwen")) family = "Qwen";

  // Strip family prefix for display name
  const name = id
    .replace(/^claude-/, "").replace(/^gemini-/, "").replace(/^gpt-/, "")
    .replace(/^kimi-/, "").replace(/^qwen\d*-/, "")
    .split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

  // Find weight: check known suffixes, default by tier
  let weight = 1.0;
  for (const [suffix, w] of Object.entries(weights)) {
    if (id.includes(suffix)) { weight = w; break; }
  }
  // Heuristic defaults for unknown models
  if (weight === 1.0 && family === "Unknown") {
    if (id.includes("mini") || id.includes("flash") || id.includes("nano")) weight = 0.7;
    else if (id.includes("pro") || id.includes("opus")) weight = 1.3;
  }

  return { id, name, family, weight };
}

async function discoverModels() {
  try {
    const res = await fetch(LLM_BASE + "/models", {
      headers: { "Authorization": "Bearer " + BANKR_API }
    });
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      MODELS = data.data.map(m => classifyModel(m.id));
      console.log(`Discovered ${MODELS.length} models from gateway`);
      return;
    }
  } catch (e) {
    console.warn("Model discovery failed, using fallback list:", e.message);
  }
  MODELS = [...FALLBACK_MODELS];
  console.log(`Using ${MODELS.length} fallback models`);
}

// ============================================
// x402 PAYMENT VERIFICATION
// ============================================
async function verifyPayment(txHash, requiredAmount) {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return { success: false, reason: "Transaction not found" };

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { success: false, reason: "Transaction failed or pending" };
    }

    if (tx.to?.toLowerCase() !== PAYMENT_WALLET.toLowerCase()) {
      return { success: false, reason: "Wrong recipient" };
    }

    const requiredWei = ethers.parseEther(requiredAmount);
    if (tx.value < requiredWei) {
      return { success: false, reason: `Insufficient: got ${ethers.formatEther(tx.value)}, need ${requiredAmount}` };
    }

    return { success: true, amount: ethers.formatEther(tx.value), from: tx.from };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

function x402WithFreeTier(freeLimit, priceEth) {
  return async (req, res, next) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "unknown";
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Check/reset free tier
    let usage = freeTierUsage.get(ip);
    if (!usage || now > usage.resetTime) {
      usage = { count: 0, resetTime: now + dayMs };
      freeTierUsage.set(ip, usage);
    }

    // Free tier available?
    if (usage.count < freeLimit) {
      usage.count++;
      req.freeTier = true;
      req.freeRemaining = freeLimit - usage.count;
      return next();
    }

    // Check for payment
    const paymentHeader = req.headers["x-payment"];
    if (!paymentHeader) {
      return res.status(402).json({
        error: "Payment Required",
        protocol: "x402",
        free_tier_exhausted: true,
        payment: {
          wallet: PAYMENT_WALLET,
          amount: priceEth,
          currency: "ETH",
          chain: "base",
          chain_id: CHAIN_ID,
          instructions: "Send ETH to wallet, include tx hash in X-Payment header"
        }
      });
    }

    // Verify payment
    const txHash = paymentHeader.trim();
    if (verifiedPayments.has(txHash)) {
      return res.status(402).json({ error: "Payment already used", tx_hash: txHash });
    }

    const verified = await verifyPayment(txHash, priceEth);
    if (!verified.success) {
      return res.status(402).json({
        error: "Payment verification failed",
        reason: verified.reason,
        tx_hash: txHash
      });
    }

    verifiedPayments.set(txHash, { verified: true, ...verified, usedAt: now });
    req.freeTier = false;
    req.payment = verified;
    next();
  };
}

// ============================================
// TOKEN DATA
// ============================================
async function fetchToken(ca) {
  try {
    const res = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + ca);
    const data = await res.json();
    if (data.pairs && data.pairs[0]) {
      const p = data.pairs[0];
      return {
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        price: p.priceUsd,
        change: p.priceChange?.h24 || 0,
        volume: p.volume?.h24 || 0,
        liquidity: p.liquidity?.usd || 0,
        buys: p.txns?.h24?.buys || 0,
        sells: p.txns?.h24?.sells || 0
      };
    }
  } catch (e) {}
  return { symbol: "???", price: "?", change: "?" };
}

// ============================================
// LLM QUERIES
// ============================================
async function queryModel(modelId, prompt) {
  try {
    const res = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + BANKR_API,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    return null;
  }
}

function extractVerdict(response) {
  if (!response) return { action: "HOLD", score: 5 };
  const upper = response.toUpperCase();
  let action = "HOLD";
  if (upper.includes("BUY")) action = "BUY";
  else if (upper.includes("SELL")) action = "SELL";
  const scoreMatch = response.match(/(\d+)\s*\/\s*10|[Ss]core[:\s]+(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : (action === "BUY" ? 7 : action === "SELL" ? 3 : 5);
  return { action, score };
}

// ============================================
// ROUTES
// ============================================

// Info endpoint (free)
app.get("/", (req, res) => {
  res.json({
    service: "15minds",
    version: "3.0.0",
    description: "Multi-model consensus engine — every frontier AI model analyzes any Base token",
    models: MODELS.length,
    families: [...new Set(MODELS.map(m => m.family))],
    pricing: {
      amount: PRICE_ETH + " ETH",
      usd_approx: "$0.12",
      free_tier: FREE_TIER_LIMIT + " requests/day"
    },
    payment: {
      protocol: "x402",
      wallet: PAYMENT_WALLET,
      chain: "Base (8453)",
      header: "X-Payment: <tx_hash>"
    },
    endpoint: "GET /read/:contractAddress",
    operator: "Lexispawn"
  });
});

// Health check (free)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    models: MODELS.length,
    timestamp: new Date().toISOString()
  });
});

// x402 pricing info (free)
app.get("/x402", (req, res) => {
  res.json({
    protocol: "x402",
    description: "15minds — multi-model consensus engine for token analysis",
    wallet: PAYMENT_WALLET,
    price: PRICE_ETH + " ETH",
    free_tier: FREE_TIER_LIMIT + " requests/day per IP",
    chain: "Base (8453)",
    usage: "Include tx hash in X-Payment header after free tier"
  });
});

// Model list (free)
app.get("/models", (req, res) => {
  res.json({
    count: MODELS.length,
    models: MODELS.map(m => ({ id: m.id, name: m.name, family: m.family, weight: m.weight }))
  });
});

// Main endpoint — x402 protected
app.get("/read/:ca", x402WithFreeTier(FREE_TIER_LIMIT, PRICE_ETH), async (req, res) => {
  const ca = req.params.ca;
  const token = await fetchToken(ca);

  const prompt = `Evaluate this Base token for a speculative trade:
${token.symbol} (${token.name})
Price: ${token.price}
24h Change: ${token.change}%
24h Volume: ${Number(token.volume).toLocaleString()}
Liquidity: ${Number(token.liquidity).toLocaleString()}
Buy/Sell 24h: ${token.buys}/${token.sells}
Reply with: BUY, SELL, or HOLD. Then score 1-10 and max 10 words why.
Example: "BUY 8/10 - Strong accumulation, volume exceeding liquidity"`;

  const results = await Promise.all(
    MODELS.map(async (model) => {
      const response = await queryModel(model.id, prompt);
      const verdict = extractVerdict(response);
      return { model, response, verdict };
    })
  );

  const whispers = [];
  let weightedSum = 0;
  let totalWeight = 0;
  let buyCount = 0, sellCount = 0, holdCount = 0;

  for (const { model, response, verdict } of results) {
    whispers.push({
      model: model.name,
      family: model.family,
      says: response ? response.split("\n")[0].slice(0, 80) : "...",
      action: verdict.action,
      score: verdict.score
    });

    weightedSum += verdict.score * model.weight;
    totalWeight += model.weight;

    if (verdict.action === "BUY") buyCount++;
    else if (verdict.action === "SELL") sellCount++;
    else holdCount++;
  }

  const consensusScore = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(1) : "?";
  const consensusAction = buyCount > sellCount && buyCount > holdCount ? "BUY" :
                         sellCount > buyCount && sellCount > holdCount ? "SELL" : "HOLD";

  res.json({
    token: {
      contract: ca,
      symbol: token.symbol,
      name: token.name,
      price: token.price,
      change24h: token.change,
      volume24h: token.volume,
      liquidity: token.liquidity,
      buySell: `${token.buys}/${token.sells}`
    },
    consensus: {
      action: consensusAction,
      score: consensusScore,
      distribution: { buy: buyCount, sell: sellCount, hold: holdCount }
    },
    whispers,
    ritual: "complete",
    models_queried: MODELS.length,
    timestamp: new Date().toISOString(),
    x402: {
      paid: !req.freeTier,
      free_remaining: req.freeRemaining ?? 0,
      payment: req.payment || null
    }
  });
});

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 4021;

await discoverModels();

app.listen(PORT, () => {
  console.log(`15minds running on port ${PORT}`);
  console.log(`Models: ${MODELS.length} (${[...new Set(MODELS.map(m => m.family))].join(", ")})`);
  console.log(`Price: ${PRICE_ETH} ETH | Free tier: ${FREE_TIER_LIMIT}/day`);
  console.log(`Payments to: ${PAYMENT_WALLET}`);
});
