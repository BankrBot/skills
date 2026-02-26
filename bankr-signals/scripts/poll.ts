#!/usr/bin/env npx tsx
/**
 * poll.ts - Poll Bankr Signals with exponential backoff and rate limit awareness
 *
 * Respects server-side rate limits (429 + Retry-After), implements exponential
 * backoff on errors, and caps polling frequency to prevent service degradation.
 *
 * Usage:
 *   npx tsx poll.ts [--interval 30] [--max-interval 300] [--category leverage]
 *   npx tsx poll.ts --min-confidence 0.8 --callback ./on-signal.sh
 *
 * Environment:
 *   BANKR_SIGNALS_URL   - API base (default: https://bankrsignals.com/api)
 *   POLL_INTERVAL        - Base interval in seconds (default: 30)
 *   POLL_MAX_INTERVAL    - Max backoff interval in seconds (default: 300)
 */

import { fetchSignals, type VerifiedSignal, type FetchOptions } from "./feed";
import { execSync } from "child_process";

const API_BASE =
  process.env.BANKR_SIGNALS_URL || "https://bankrsignals.com/api";

// ---------- rate limit state ----------

interface RateLimitState {
  baseIntervalMs: number;
  maxIntervalMs: number;
  currentIntervalMs: number;
  consecutiveErrors: number;
  retryAfterMs: number | null;
  lastPollAt: number;
  totalPolls: number;
  totalErrors: number;
}

function createRateLimitState(
  baseIntervalSec: number,
  maxIntervalSec: number
): RateLimitState {
  return {
    baseIntervalMs: baseIntervalSec * 1000,
    maxIntervalMs: maxIntervalSec * 1000,
    currentIntervalMs: baseIntervalSec * 1000,
    consecutiveErrors: 0,
    retryAfterMs: null,
    lastPollAt: 0,
    totalPolls: 0,
    totalErrors: 0,
  };
}

function getNextInterval(state: RateLimitState): number {
  // Server told us to wait — respect Retry-After
  if (state.retryAfterMs && state.retryAfterMs > state.currentIntervalMs) {
    return state.retryAfterMs;
  }

  // Exponential backoff on consecutive errors
  if (state.consecutiveErrors > 0) {
    const backoff =
      state.baseIntervalMs * Math.pow(2, state.consecutiveErrors);
    // Add jitter (±20%) to prevent thundering herd
    const jitter = backoff * 0.2 * (Math.random() * 2 - 1);
    return Math.min(backoff + jitter, state.maxIntervalMs);
  }

  return state.baseIntervalMs;
}

function onSuccess(state: RateLimitState): void {
  state.consecutiveErrors = 0;
  state.retryAfterMs = null;
  state.currentIntervalMs = state.baseIntervalMs;
  state.totalPolls++;
  state.lastPollAt = Date.now();
}

function onError(state: RateLimitState, retryAfterSec?: number): void {
  state.consecutiveErrors++;
  state.totalErrors++;
  state.totalPolls++;
  state.lastPollAt = Date.now();

  if (retryAfterSec) {
    state.retryAfterMs = retryAfterSec * 1000;
  }

  state.currentIntervalMs = getNextInterval(state);
}

// ---------- server rate limit check ----------

async function checkRateLimit(): Promise<{
  ok: boolean;
  retryAfterSec?: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      return {
        ok: false,
        retryAfterSec: retryAfter ? Number(retryAfter) : 60,
      };
    }
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// ---------- signal handler ----------

type SignalCallback = (signals: VerifiedSignal[]) => void | Promise<void>;

function defaultCallback(signals: VerifiedSignal[]): void {
  for (const s of signals) {
    const emoji = s.verified ? "✅" : "⚠️";
    console.log(
      `${emoji} [${s.timestamp}] ${s.providerName || s.provider.slice(0, 10)}: ${s.action} ${s.token}` +
        (s.entryPrice ? ` @ $${s.entryPrice}` : "") +
        (s.leverage ? ` ${s.leverage}x` : "") +
        (s.confidence ? ` (${(s.confidence * 100).toFixed(0)}%)` : "")
    );
  }
}

function shellCallback(scriptPath: string): SignalCallback {
  return (signals: VerifiedSignal[]) => {
    for (const s of signals) {
      if (!s.verified) continue; // Only pass verified signals to external scripts
      try {
        const json = JSON.stringify(s);
        execSync(`${scriptPath} '${json.replace(/'/g, "'\\''")}'`, {
          stdio: "inherit",
          timeout: 30_000,
        });
      } catch (err: any) {
        console.error(`Callback error for ${s.id}: ${err.message}`);
      }
    }
  };
}

// ---------- poll loop ----------

async function pollLoop(
  fetchOpts: FetchOptions,
  callback: SignalCallback,
  state: RateLimitState
): Promise<never> {
  let lastSince: string | undefined = fetchOpts.since;
  const seenIds = new Set<string>();

  console.error(
    `📡 Polling bankrsignals.com every ${state.baseIntervalMs / 1000}s` +
      ` (max backoff: ${state.maxIntervalMs / 1000}s)`
  );

  while (true) {
    const waitMs = getNextInterval(state);

    // Enforce minimum 10s between polls regardless of config
    const timeSinceLastPoll = Date.now() - state.lastPollAt;
    const effectiveWait = Math.max(waitMs, 10_000 - timeSinceLastPoll);

    if (effectiveWait > 0) {
      await new Promise((r) => setTimeout(r, effectiveWait));
    }

    try {
      // Pre-check rate limit
      const rl = await checkRateLimit();
      if (!rl.ok) {
        console.error(
          `⏳ Rate limited, waiting ${rl.retryAfterSec || 60}s`
        );
        onError(state, rl.retryAfterSec);
        continue;
      }

      const opts: FetchOptions = {
        ...fetchOpts,
        since: lastSince,
      };

      const result = await fetchSignals(opts);

      // Deduplicate
      const newSignals = result.signals.filter((s) => !seenIds.has(s.id));
      for (const s of newSignals) {
        seenIds.add(s.id);
      }

      // Cap seen set size (keep last 10k)
      if (seenIds.size > 10_000) {
        const arr = Array.from(seenIds);
        for (let i = 0; i < arr.length - 5_000; i++) {
          seenIds.delete(arr[i]);
        }
      }

      if (newSignals.length > 0) {
        await callback(newSignals);

        // Advance cursor
        const latest = newSignals
          .map((s) => s.timestamp)
          .sort()
          .pop();
        if (latest) lastSince = latest;
      }

      onSuccess(state);

      // Status every 50 polls
      if (state.totalPolls % 50 === 0) {
        console.error(
          `📊 Polls: ${state.totalPolls}, Errors: ${state.totalErrors}, ` +
            `Seen: ${seenIds.size}, Interval: ${(getNextInterval(state) / 1000).toFixed(0)}s`
        );
      }
    } catch (err: any) {
      console.error(`❌ Poll error: ${err.message}`);
      onError(state);
      console.error(
        `⏳ Backing off to ${(state.currentIntervalMs / 1000).toFixed(0)}s ` +
          `(${state.consecutiveErrors} consecutive errors)`
      );
    }
  }
}

// ---------- CLI ----------

async function main() {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  const baseInterval = Number(
    getArg("interval") || process.env.POLL_INTERVAL || "30"
  );
  const maxInterval = Number(
    getArg("max-interval") || process.env.POLL_MAX_INTERVAL || "300"
  );

  const fetchOpts: FetchOptions = {
    limit: Number(getArg("limit")) || 20,
    since: getArg("since"),
    provider: getArg("provider"),
    category: getArg("category"),
    minConfidence: getArg("min-confidence")
      ? Number(getArg("min-confidence"))
      : undefined,
    status: getArg("status") || "open",
    verify: !args.includes("--no-verify"),
  };

  const callbackPath = getArg("callback");
  const callback: SignalCallback = callbackPath
    ? shellCallback(callbackPath)
    : defaultCallback;

  const state = createRateLimitState(baseInterval, maxInterval);

  await pollLoop(fetchOpts, callback, state);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

export { pollLoop, createRateLimitState, checkRateLimit };
