#!/usr/bin/env npx tsx
/**
 * feed.ts - Fetch and verify signals from Bankr Signals API
 *
 * Cryptographically verifies each signal's EIP-191 signature before returning it.
 * Signals that fail verification are flagged and excluded from actionable results.
 *
 * Usage:
 *   npx tsx feed.ts [--limit 20] [--since 2026-02-25T00:00:00Z] [--provider 0x...] [--verify]
 *   npx tsx feed.ts --category leverage --min-confidence 0.8
 */

import { verifyMessage } from "viem";

const API_BASE =
  process.env.BANKR_SIGNALS_URL || "https://bankrsignals.com/api";

// ---------- types ----------

interface Signal {
  id: string;
  provider: string;
  providerName?: string;
  action: string;
  token: string;
  timestamp: string;
  entryPrice?: number;
  leverage?: number;
  confidence?: number;
  reasoning?: string;
  txHash?: string;
  collateralUsd?: number;
  status?: string;
  category?: string;
  riskLevel?: string;
  message?: string;
  signature?: string;
  pnlPct?: number;
}

interface VerifiedSignal extends Signal {
  verified: boolean;
  verificationError?: string;
}

// ---------- signature verification ----------

async function verifySignalSignature(
  signal: Signal
): Promise<{ valid: boolean; error?: string }> {
  if (!signal.message || !signal.signature) {
    return { valid: false, error: "missing message or signature" };
  }

  // Validate signature format: 0x + 65 bytes
  if (!/^0x[a-fA-F0-9]{130}$/.test(signal.signature)) {
    return { valid: false, error: "malformed signature" };
  }

  // Validate provider address format
  if (!/^0x[a-fA-F0-9]{40}$/i.test(signal.provider)) {
    return { valid: false, error: "malformed provider address" };
  }

  try {
    const valid = await verifyMessage({
      address: signal.provider as `0x${string}`,
      message: signal.message,
      signature: signal.signature as `0x${string}`,
    });

    if (!valid) {
      return { valid: false, error: "signature does not match provider" };
    }

    // Verify message contains expected provider address
    if (
      !signal.message
        .toLowerCase()
        .includes(signal.provider.toLowerCase())
    ) {
      return {
        valid: false,
        error: "message does not reference claimed provider",
      };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `verification failed: ${err.message}` };
  }
}

// ---------- anomaly detection ----------

function detectAnomalies(signals: Signal[]): Map<string, string[]> {
  const anomalies = new Map<string, string[]>();

  // Group by provider
  const byProvider = new Map<string, Signal[]>();
  for (const s of signals) {
    const list = byProvider.get(s.provider) || [];
    list.push(s);
    byProvider.set(s.provider, list);
  }

  for (const [provider, providerSignals] of byProvider) {
    const issues: string[] = [];

    // Burst detection: >5 signals within 60 seconds
    const timestamps = providerSignals
      .map((s) => new Date(s.timestamp).getTime())
      .sort();
    for (let i = 0; i < timestamps.length - 5; i++) {
      if (timestamps[i + 5] - timestamps[i] < 60_000) {
        issues.push("signal burst detected (>5 in 60s)");
        break;
      }
    }

    // Contradictory signals: LONG and SHORT on same token within 5 minutes
    for (let i = 0; i < providerSignals.length; i++) {
      for (let j = i + 1; j < providerSignals.length; j++) {
        const a = providerSignals[i];
        const b = providerSignals[j];
        if (
          a.token === b.token &&
          Math.abs(
            new Date(a.timestamp).getTime() -
              new Date(b.timestamp).getTime()
          ) < 300_000
        ) {
          const dirs = new Set([a.action, b.action]);
          if (
            (dirs.has("LONG") && dirs.has("SHORT")) ||
            (dirs.has("BUY") && dirs.has("SELL"))
          ) {
            issues.push(
              `contradictory ${a.token} signals within 5 min`
            );
          }
        }
      }
    }

    // Unrealistic confidence: always exactly 1.0
    if (
      providerSignals.length > 3 &&
      providerSignals.every((s) => s.confidence === 1)
    ) {
      issues.push("all signals at 100% confidence — suspicious");
    }

    if (issues.length > 0) {
      anomalies.set(provider, issues);
    }
  }

  return anomalies;
}

// ---------- fetch ----------

interface FetchOptions {
  limit?: number;
  since?: string;
  provider?: string;
  category?: string;
  minConfidence?: number;
  status?: string;
  verify?: boolean;
}

async function fetchSignals(
  opts: FetchOptions = {}
): Promise<{
  signals: VerifiedSignal[];
  rejected: VerifiedSignal[];
  anomalies: Map<string, string[]>;
  total: number;
  providers: number;
}> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.since) params.set("since", opts.since);
  if (opts.provider) params.set("provider", opts.provider);
  if (opts.category) params.set("category", opts.category);
  if (opts.minConfidence)
    params.set("minConfidence", String(opts.minConfidence));
  if (opts.status) params.set("status", opts.status);

  const url = `${API_BASE}/feed?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const raw: Signal[] = json.signals || json.data?.signals || [];

  const verified: VerifiedSignal[] = [];
  const rejected: VerifiedSignal[] = [];

  for (const signal of raw) {
    if (opts.verify !== false) {
      const result = await verifySignalSignature(signal);
      const vs: VerifiedSignal = {
        ...signal,
        verified: result.valid,
        verificationError: result.error,
      };
      if (result.valid) {
        verified.push(vs);
      } else {
        rejected.push(vs);
      }
    } else {
      verified.push({ ...signal, verified: false });
    }
  }

  const anomalies = detectAnomalies(verified);

  return {
    signals: verified,
    rejected,
    anomalies,
    total: json.total || raw.length,
    providers: json.providers || 0,
  };
}

// ---------- CLI ----------

async function main() {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const opts: FetchOptions = {
    limit: Number(getArg("limit")) || 20,
    since: getArg("since"),
    provider: getArg("provider"),
    category: getArg("category"),
    minConfidence: getArg("min-confidence")
      ? Number(getArg("min-confidence"))
      : undefined,
    status: getArg("status"),
    verify: !args.includes("--no-verify"),
  };

  const result = await fetchSignals(opts);

  // Output
  console.log(
    JSON.stringify(
      {
        signals: result.signals,
        rejected: result.rejected.length,
        rejectedDetails: result.rejected.map((r) => ({
          id: r.id,
          provider: r.provider,
          error: r.verificationError,
        })),
        anomalies: Object.fromEntries(result.anomalies),
        total: result.total,
        providers: result.providers,
      },
      null,
      2
    )
  );

  // Warn on stderr
  if (result.rejected.length > 0) {
    console.error(
      `⚠️  ${result.rejected.length} signal(s) failed signature verification`
    );
  }
  if (result.anomalies.size > 0) {
    console.error(
      `⚠️  Anomalies detected from ${result.anomalies.size} provider(s)`
    );
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

export { fetchSignals, verifySignalSignature, detectAnomalies };
export type { Signal, VerifiedSignal, FetchOptions };
