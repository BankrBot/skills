#!/usr/bin/env node

import * as offrampSdk from "@usdctofiat/offramp";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { base } from "viem/chains";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BANKR_API = "https://api.bankr.bot";
const publicClient = createPublicClient({ chain: base, transport: http() });
const READ_RPC_METHODS = new Set([
  "eth_blockNumber", "eth_call", "eth_estimateGas", "eth_feeHistory", "eth_gasPrice",
  "eth_getBalance", "eth_getBlockByHash", "eth_getBlockByNumber", "eth_getCode",
  "eth_getTransactionByHash", "eth_getTransactionCount", "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const positionals = [];
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }

  return { command, positionals, flags };
}

function required(value, label) {
  if (value === undefined || value === true || value === "") {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

function asJson(value) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2);
}

function output(value) {
  process.stdout.write(`${asJson(value)}\n`);
}

function requireMode(value) {
  const mode = String(required(value, "--mode")).toLowerCase();
  if (mode !== "fast" && mode !== "best") {
    throw new Error('cashout requires --mode fast or --mode best');
  }
  return mode;
}

function isBestDepositId(depositId) {
  return /^\d+$/.test(depositId);
}

// Dependencies are injectable for offline adapter tests; normal CLI use always
// calls the published SDK and Bankr, never an alternate signer implementation.
export function createCommands({
  sdk = offrampSdk,
  request = globalThis.fetch,
  env = process.env,
  emit = output,
  readClient = publicClient,
} = {}) {
  const { cashout, close, createOfframp, deposits, usdc } = sdk;
  const transactionHashes = [];

  function offramp() {
    return createOfframp({ integratorId: "bankr" });
  }

  function amountUnits(value, label = "amount") {
    const amount = required(value, label);
    if (!/^\d+(?:\.\d{1,6})?$/.test(amount)) {
      throw new Error(`${label} must be a positive USDC decimal with at most six fractional digits`);
    }
    const units = usdc(amount);
    if (units <= 0n) throw new Error(`${label} must be positive`);
    return units;
  }

  async function bankrRequest(path, init = {}) {
    const apiKey = required(env.BANKR_API_KEY, "BANKR_API_KEY");
    const response = await request(`${BANKR_API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        ...init.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const detail = body.error ?? body.message ?? `${response.status} ${response.statusText}`;
      throw new Error(`Bankr ${path} failed: ${detail}`);
    }
    return body;
  }

  async function bankrAddress() {
    const wallet = await bankrRequest("/wallet/me");
    const address = wallet.address ?? wallet.wallet?.address;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
      throw new Error("Bankr /wallet/me did not return an EVM address");
    }
    return address;
  }

  async function submitViaBankr(tx, description) {
    const chainId = Number(tx.chainId ?? base.id);
    if (chainId !== base.id) {
      throw new Error(`Refusing non-Base transaction for USDCtoFiat: chain ${chainId}`);
    }
    const response = await bankrRequest("/wallet/submit", {
      method: "POST",
      body: JSON.stringify({
        transaction: {
          to: tx.to,
          data: tx.data ?? "0x",
          value: (tx.value ?? 0n).toString(),
          chainId,
        },
        description,
        waitForConfirmation: true,
      }),
    });
    const transactionHash = response.transactionHash ?? response.hash;
    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash ?? "")) {
      throw new Error("Bankr submit succeeded without a transaction hash; inspect wallet activity before retrying");
    }
    transactionHashes.push(transactionHash);
    return transactionHash;
  }

  async function bankrSigner() {
    const address = await bankrAddress();
    return createWalletClient({
      account: address,
      chain: base,
      transport: custom({
        async request({ method, params }) {
          if (method === "eth_accounts" || method === "eth_requestAccounts") {
            return [address];
          }
          if (method === "eth_chainId") {
            return `0x${base.id.toString(16)}`;
          }
          if (method === "eth_sendTransaction") {
            const tx = params?.[0] ?? {};
            if (tx.from && tx.from.toLowerCase() !== address.toLowerCase()) {
              throw new Error("Transaction sender does not match this Bankr wallet");
            }
            return submitViaBankr(
              {
                to: tx.to,
                data: tx.data,
                value: tx.value != null ? BigInt(tx.value) : 0n,
                chainId: tx.chainId ?? base.id,
              },
              "USDCtoFiat cashout",
            );
          }
          if (!READ_RPC_METHODS.has(method)) throw new Error(`Unsupported wallet RPC method: ${method}`);
          return readClient.request({ method, params });
        },
      }),
    });
  }

  async function bestDeposit(depositId, escrowInput) {
    const escrowAddress = required(escrowInput, "--escrow for a numeric Best deposit id");
    if (!/^0x[0-9a-fA-F]{40}$/.test(escrowAddress)) throw new Error("Invalid --escrow address");
    const address = await bankrAddress();
    const matches = (await deposits(address)).filter((row) =>
      row.depositId === depositId && row.escrowAddress?.toLowerCase() === escrowAddress.toLowerCase());
    if (matches.length !== 1) {
      throw new Error(matches.length
        ? "Ambiguous Best deposit snapshot; reconcile the exact escrow/id before any write"
        : `No Best deposit ${depositId} in escrow ${escrowAddress} in this wallet's bounded SDK snapshot; reconcile history before any write`);
    }
    return matches[0];
  }

  function requireConfirmation(flags, preview) {
    if (flags.confirm !== true) {
      throw new Error(`Write not confirmed. Show this preview to the user, then rerun with --confirm:\n${asJson(preview)}`);
    }
  }

  function rejectWise(platform) {
    if (String(platform).toLowerCase() === "wise") {
      throw new Error("USDCtoFiat will not create a Wise cash-out while Wise prohibits P2P crypto-sale payments.");
    }
  }

  function cashoutRoute(mode, platformInput, currency, payeeInput) {
    if (sdk.isPaymentPlatformDisabled(platformInput)) {
      throw new Error(sdk.DISABLED_PAYMENT_PLATFORM_MESSAGE);
    }
    const platform = String(platformInput).toLowerCase().replace(/[\s_-]/g, "");
    rejectWise(platform);
    const entry = Object.values(sdk.PLATFORMS).find((row) => row.id === platform);
    const catalog = mode === "fast" ? offramp().capabilities().platforms : Object.values(sdk.PLATFORMS);
    const supported = catalog.find((row) => (row.platform ?? row.id) === platform);
    if (!entry || !supported || !supported.currencies.includes(currency)) {
      throw new Error(`${platform}/${currency} is not supported in ${mode} mode; inspect capabilities first`);
    }
    const validation = entry.validate(payeeInput);
    if (!validation.valid) throw new Error(validation.error ?? "Invalid payee");
    return { platform, payee: validation.normalized ?? payeeInput };
  }

  async function runCashout(flags) {
    const mode = requireMode(flags.mode);
    const amount = required(flags.amount, "--amount");
    const platformInput = required(flags.platform, "--platform");
    const currency = required(flags.currency, "--currency").toUpperCase();
    const payeeInput = required(flags.payee, "--payee");
    const { platform, payee } = cashoutRoute(mode, platformInput, currency, payeeInput);
    const units = amountUnits(amount);
    if (units < sdk.MIN_CASHOUT_AMOUNT) throw new Error("Cash-out amount must be at least 0.01 USDC");
    if (mode === "best" && units < sdk.RECOMMENDED_MIN_CASHOUT_AMOUNT) {
      throw new Error("Best requires at least 1 USDC for its per-order minimum");
    }
    const oneUsdc = usdc("1");
    const bestCeiling = usdc("1500");
    const fillRange = mode === "fast"
      ? { min: units < oneUsdc ? units : oneUsdc, max: units }
      : { min: oneUsdc, max: units < bestCeiling ? units : bestCeiling };
    const warnings = ["The rate is an oracle estimate. The binding rate resolves when a buyer fills."];
    if (units < sdk.RECOMMENDED_MIN_CASHOUT_AMOUNT) {
      warnings.push("Below the practical 1 USDC minimum: matching may stall; prefer a larger amount.");
    }
    if (mode === "best" && units > bestCeiling) {
      warnings.push("Best caps each buyer order at 1,500 USDC; this deposit requires multiple fills.");
    }

    const estimate = await offramp().estimate({ amount: units, currency });
    const preview = {
      action: "cashout",
      product: "USDCtoFiat",
      mode,
      chain: "Base",
      asset: "USDC",
      amount,
      receive: { platform, currency, payee },
      estimate,
      perOrderUsdc: {
        min: sdk.formatUsdc(fillRange.min),
        max: sdk.formatUsdc(fillRange.max),
      },
      fee:
        mode === "fast"
          ? "0% spread. TOFIAT attribution is locked by @usdctofiat/offramp."
          : "Delegate strategy. 10 bps on fill, taken from USDC released to the taker.",
      warnings,
    };
    requireConfirmation(flags, preview);

    const signer = await bankrSigner();
    const result = await cashout({
      mode,
      signer,
      amount,
      platform,
      currency,
      payee,
    });
    emit({ ...result, transactionHashes: [...transactionHashes] });
  }

  async function runWithdraw(depositId, flags) {
    required(depositId, "deposit id");
    const client = offramp();
    const best = isBestDepositId(depositId);
    if (!best && flags.escrow !== undefined) throw new Error("Fast deposit ids already encode the escrow; omit --escrow");
    if (best && flags.amount) {
      throw new Error("Best-mode close() withdraws remaining unlocked USDC. Omit --amount or use a Fast depositId for a partial withdraw.");
    }
    const partialAmount = flags.amount ? amountUnits(flags.amount, "--amount") : undefined;
    let current;
    if (best) {
      current = await bestDeposit(depositId, flags.escrow);
    } else {
      current = await client.order(depositId);
    }
    requireConfirmation(flags, {
      action: flags.amount ? "partial-withdraw" : "close-and-withdraw",
      product: "USDCtoFiat",
      mode: best ? "best" : "fast",
      depositId,
      ...(best ? { escrowAddress: current.escrowAddress } : {}),
      amount: flags.amount ?? "all unlocked funds",
      current,
    });

    const signer = await bankrSigner();
    if (best) {
      const txHash = await close(signer, depositId, current.escrowAddress);
      emit({ depositId, escrowAddress: current.escrowAddress, mode: "best", txHash, transactionHashes: [...transactionHashes] });
      return;
    }

    const result = await client.withdraw(depositId, {
      signer,
      ...(partialAmount !== undefined ? { amount: partialAmount } : {}),
    });
    emit({ depositId, mode: "fast", ...result, transactionHashes: [...transactionHashes] });
  }

  async function runTopUp(depositId, flags) {
    required(depositId, "deposit id");
    if (isBestDepositId(depositId)) {
      throw new Error("top-up is a Fast-order action. For Best, create a new cashout --mode best.");
    }
    const amount = required(flags.amount, "--amount");
    const units = amountUnits(amount, "--amount");
    const current = await offramp().order(depositId);
    requireConfirmation(flags, {
      action: "top-up",
      product: "USDCtoFiat",
      mode: "fast",
      depositId,
      amount,
      asset: "Base USDC",
      currentState: current.state,
    });
    const result = await offramp().topUp(depositId, units, { signer: await bankrSigner() });
    emit({ depositId, mode: "fast", ...result, transactionHashes: [...transactionHashes] });
  }

  async function runStatus(depositId, flags) {
    required(depositId, "deposit id");
    if (isBestDepositId(depositId)) {
      const match = await bestDeposit(depositId, flags.escrow);
      emit({ mode: "best", ...match });
      return;
    }
    if (flags.escrow !== undefined) throw new Error("Fast deposit ids already encode the escrow; omit --escrow");
    emit({ mode: "fast", ...(await offramp().order(depositId)) });
  }

  async function runOrders(flags) {
    const address = await bankrAddress();
    const [fast, best] = await Promise.all([
      offramp().orders(address, { inFlight: flags.all !== true }),
      deposits(address),
    ]);
    emit({
      address,
      fast,
      best: flags.all === true ? best : best.filter((row) => row.status === "active"),
      coverage: { best: "SDK deposits() returns at most 100 depositor rows; this is a bounded snapshot" },
    });
  }

  function usage() {
    return [
      "Usage: usdctofiat.mjs",
      "  capabilities",
      "  estimate <amount> <currency>",
      "  cashout --mode fast|best --amount N --platform ID --currency CODE --payee HANDLE [--confirm]",
      "  status <depositId> [--escrow ADDRESS (required for Best)]",
      "  orders [--all]",
      "  withdraw <depositId> [--escrow ADDRESS (required for Best)] [--amount N] [--confirm]",
      "  top-up <depositId> --amount N [--confirm]",
    ].join("\n");
  }

  async function main(argv) {
    const { command, positionals, flags } = parseArgs(argv);
    const allowedFlags = {
      capabilities: [], estimate: [], status: ["escrow"], orders: ["all"],
      cashout: ["mode", "amount", "platform", "currency", "payee", "confirm"],
      withdraw: ["amount", "escrow", "confirm"], "top-up": ["amount", "confirm"],
    }[command];
    if (allowedFlags) {
      for (const flag of Object.keys(flags)) {
        if (!allowedFlags.includes(flag)) throw new Error(`Unsupported --${flag} for ${command}`);
      }
    }

    switch (command) {
      case "capabilities": {
        const fast = offramp().capabilities();
        emit({
          ...fast,
          modes: {
            fast: { platforms: fast.platforms },
            best: {
              platforms: Object.values(sdk.PLATFORMS)
                .filter((row) => !sdk.isPaymentPlatformDisabled(row.id))
                .map((row) => ({ platform: row.id, currencies: row.currencies })),
            },
          },
          providerPolicy: { excludedPlatforms: ["wise"], reason: "P2P crypto-sale payment prohibition" },
        });
        return;
      }
      case "estimate":
        emit(
          await offramp().estimate({
            amount: amountUnits(positionals[0]),
            currency: required(positionals[1], "currency").toUpperCase(),
          }),
        );
        return;
      case "cashout":
        await runCashout(flags);
        return;
      case "status":
        await runStatus(positionals[0], flags);
        return;
      case "orders":
        await runOrders(flags);
        return;
      case "withdraw":
        await runWithdraw(positionals[0], flags);
        return;
      case "top-up":
        await runTopUp(positionals[0], flags);
        return;
      default:
        throw new Error(usage());
    }
  }

  return async function run(argv) {
    transactionHashes.length = 0;
    try {
      await main(argv);
    } catch (error) {
      if (error && typeof error === "object" && transactionHashes.length) {
        error.transactionHashes = [...transactionHashes];
      }
      throw error;
    }
  };
}

export function errorPayload(error) {
  const evidence = Array.isArray(error?.transactionHashes)
    ? { transactionHashes: error.transactionHashes }
    : {};
  if (offrampSdk.isCashError(error)) {
    // SDK 9 owns the sanitized recovery shape and deliberately has no toJSON().
    // Never spread an Error or serialize its cause/stack/raw upstream payload.
    return {
      error: error.message,
      code: error.code,
      retryable: error.retryable,
      remediation: error.remediation,
      ...(error.recovery ? { recovery: error.recovery } : {}),
      ...evidence,
    };
  }
  if (error && typeof error === "object" && error.name === "OfframpError") {
    return {
      error: error.message,
      code: error.code,
      step: error.step,
      depositId: error.depositId,
      txHash: error.txHash,
      ...evidence,
    };
  }
  return { error: error instanceof Error ? error.message : String(error), ...evidence };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  createCommands()(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${asJson(errorPayload(error))}\n`);
    process.exitCode = 1;
  });
}
