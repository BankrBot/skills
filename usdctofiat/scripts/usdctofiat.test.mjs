import assert from "node:assert/strict";
import test from "node:test";
import * as sdk from "@usdctofiat/offramp";
import { base } from "viem/chains";
import { createCommands, errorPayload } from "./usdctofiat.mjs";

const address = "0x1111111111111111111111111111111111111111";
const to = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const secondHash = `0x${"b".repeat(64)}`;
const depositId = `${to}_7`;

function fixture({ overrides = {}, bankrResponse } = {}) {
  const calls = { wallet: [], cashout: [], withdraw: [], topUp: [], close: [], estimate: [], deposits: [] };
  const results = [];
  const client = {
    capabilities: () => sdk.createOfframp({ telemetry: false }).capabilities(),
    estimate: async (input) => { calls.estimate.push(input); return { approximate: true }; },
    order: async (id) => ({ depositId: id, state: "awaiting-buyer" }),
    orders: async () => [{ depositId, state: "awaiting-buyer" }],
    withdraw: async (id, input) => { calls.withdraw.push({ id, input }); return { withdrawTxHash: hash }; },
    topUp: async (id, amount, input) => { calls.topUp.push({ id, amount, input }); return { txHash: hash }; },
    ...overrides.client,
  };
  const dependencies = {
    ...sdk,
    createOfframp: () => client,
    cashout: async (input) => { calls.cashout.push(input); return { mode: input.mode, depositId, txHash: hash }; },
    deposits: async (wallet) => {
      calls.deposits.push(wallet);
      return [{ depositId: "7", escrowAddress: to, status: "active" }, { depositId: "8", escrowAddress: to, status: "closed" }];
    },
    close: async (signer, id, escrowAddress) => { calls.close.push({ signer, id, escrowAddress }); return hash; },
    ...overrides.sdk,
  };
  const run = createCommands({
    sdk: dependencies,
    env: { BANKR_API_KEY: "offline-test-key" },
    emit: (value) => results.push(value),
    readClient: { request: async () => { throw new Error("Unexpected RPC in offline test"); } },
    request: async (url, init) => {
      calls.wallet.push({ url, init });
      if (url.endsWith("/wallet/me")) {
        return { ok: true, json: async () => ({ address }) };
      }
      if (url.endsWith("/wallet/submit")) {
        return { ok: true, json: async () => bankrResponse?.() ?? ({ success: true, transactionHash: hash }) };
      }
      throw new Error("Unexpected network request in offline test");
    },
  });
  return { run, calls, results };
}

function cashoutArgs(mode = "fast", extra = []) {
  return ["cashout", "--mode", mode, "--amount", "100", "--platform", "revolut", "--currency", "EUR", "--payee", "alice", ...extra];
}

async function preview(run, args) {
  let caught;
  try { await run(args); } catch (error) { caught = error; }
  assert.match(caught?.message ?? "", /Write not confirmed/);
  return JSON.parse(caught.message.slice(caught.message.indexOf("\n") + 1));
}

test("SDK 9 capability discovery is wallet-free and excludes every Cash App alias", async () => {
  const { run, calls, results } = fixture();
  await run(["capabilities"]);
  assert.equal(calls.wallet.length, 0);
  assert.equal(results[0].amount.min, 10000n);
  assert.equal(results[0].amount.recommendedMin, 1000000n);
  for (const mode of ["fast", "best"]) {
    assert.ok(results[0].modes[mode].platforms.every((row) => row.platform !== "cashapp"));
  }
  for (const platform of ["cashapp", "Cash App", "cash-app", "cash_app"]) {
    assert.equal(sdk.isPaymentPlatformDisabled(platform), true);
    for (const mode of ["fast", "best"]) {
      const args = cashoutArgs(mode, ["--confirm"]);
      args[args.indexOf("--platform") + 1] = platform;
      await assert.rejects(run(args), { message: sdk.DISABLED_PAYMENT_PLATFORM_MESSAGE });
    }
  }
  assert.equal(calls.wallet.length, 0);
  assert.equal(calls.estimate.length, 0);
  assert.equal(calls.cashout.length, 0);
});

test("the installed SDK rejects disabled creation before touching a signer", async () => {
  let walletTouches = 0;
  const signer = new Proxy({}, { get() { walletTouches += 1; throw new Error("Forbidden wallet access"); } });
  const client = sdk.createOfframp({ telemetry: false });
  await assert.rejects(client.cashout({ amount: sdk.usdc("100"), receive: { platform: "cashapp", currency: "USD", payee: "alice" } }, { signer }), /temporarily unavailable/);
  await assert.rejects(sdk.cashout({ mode: "best", amount: "100", platform: "cashapp", currency: "USD", payee: "alice", signer }), /temporarily unavailable/);
  assert.equal(walletTouches, 0);
});

test("missing required cashout input and unsupported currency fail before wallet or estimate", async () => {
  const { run, calls } = fixture();
  await assert.rejects(run(["cashout", "--amount", "100", "--confirm"]), /Missing --mode/);
  await assert.rejects(run(["cashout", "--mode", "fast", "--confirm"]), /Missing --amount/);
  await assert.rejects(run(cashoutArgs("fast", ["--otc-taker", address, "--confirm"])), /Unsupported --otc-taker/);
  const args = cashoutArgs("fast", ["--confirm"]);
  args[args.indexOf("--currency") + 1] = "ARS";
  await assert.rejects(run(args), /not supported in fast mode/);
  assert.equal(calls.wallet.length, 0);
  assert.equal(calls.estimate.length, 0);
  assert.equal(calls.cashout.length, 0);
});

test("Fast and Best previews cannot submit and include their actual per-order ranges", async () => {
  for (const mode of ["fast", "best"]) {
    const { run, calls } = fixture();
    const args = cashoutArgs(mode);
    args[args.indexOf("--amount") + 1] = "2000";
    const planned = await preview(run, args);
    assert.equal(planned.mode, mode);
    assert.equal(planned.perOrderUsdc.min, "1");
    assert.equal(planned.perOrderUsdc.max, mode === "fast" ? "2000" : "1500");
    assert.equal(planned.warnings.some((warning) => warning.includes("multiple fills")), mode === "best");
    assert.equal(calls.estimate[0].amount, 2000000000n);
    assert.equal(calls.wallet.length, 0);
    assert.equal(calls.cashout.length, 0);
  }
});

test("dust stops before estimate; sub-1 Fast warns; sub-1 Best cannot meet its fill minimum", async () => {
  const { run, calls } = fixture();
  const args = cashoutArgs("fast");
  args[args.indexOf("--amount") + 1] = "0.001";
  await assert.rejects(run(args), /at least 0.01/);
  assert.equal(calls.estimate.length, 0);
  args[args.indexOf("--amount") + 1] = "0.5";
  const planned = await preview(run, args);
  assert.deepEqual(planned.perOrderUsdc, { min: "0.5", max: "0.5" });
  assert.ok(planned.warnings.some((warning) => warning.includes("matching may stall")));
  args[args.indexOf("--mode") + 1] = "best";
  await assert.rejects(run(args), /Best requires at least 1/);
  assert.equal(calls.wallet.length, 0);
});

test("invalid amount precision never silently rounds on cashout, top-up or withdrawal", async () => {
  const { run, calls } = fixture();
  for (const amount of ["0", "-1", "1e2", "1.0000001"]) {
    const args = cashoutArgs("fast", ["--confirm"]);
    args[args.indexOf("--amount") + 1] = amount;
    await assert.rejects(run(args), /positive|six fractional digits/);
    await assert.rejects(run(["top-up", depositId, "--amount", amount, "--confirm"]), /positive|six fractional digits/);
    await assert.rejects(run(["withdraw", depositId, "--amount", amount, "--confirm"]), /positive|six fractional digits/);
  }
  assert.equal(calls.wallet.length, 0);
  assert.equal(calls.estimate.length, 0);
  assert.equal(calls.cashout.length, 0);
  assert.equal(calls.topUp.length, 0);
  assert.equal(calls.withdraw.length, 0);
});

test("confirmed SDK input stays human-readable while Bankr forwards exact Base transactions and every hash", async () => {
  let submitted = 0;
  const { run, calls, results } = fixture({
    bankrResponse: () => ({ success: true, transactionHash: ++submitted === 1 ? hash : secondHash }),
    overrides: { sdk: { cashout: async (input) => {
      assert.equal(input.amount, "100");
      assert.equal(input.mode, "fast");
      await input.signer.sendTransaction({ chain: base, to, data: "0x1234", value: 2n });
      await input.signer.sendTransaction({ chain: base, to, data: "0xabcd", value: 0n });
      return { depositId, txHash: secondHash, mode: "fast" };
    } } },
  });
  await run(cashoutArgs("fast", ["--confirm"]));
  const requests = calls.wallet.filter((row) => row.url.endsWith("/wallet/submit"));
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    transaction: { to, data: "0x1234", value: "2", chainId: 8453 },
    description: "USDCtoFiat cashout",
    waitForConfirmation: true,
  });
  assert.deepEqual(results[0].transactionHashes, [hash, secondHash]);
});

test("Bankr success without a hash stops without retrying or reporting settlement", async () => {
  const { run, calls, results } = fixture({
    bankrResponse: () => ({ success: true }),
    overrides: { sdk: { cashout: async ({ signer }) => signer.sendTransaction({ chain: base, to, value: 0n }) } },
  });
  await assert.rejects(run(cashoutArgs("fast", ["--confirm"])), /without a transaction hash/);
  assert.equal(calls.wallet.filter((row) => row.url.endsWith("/wallet/submit")).length, 1);
  assert.equal(results.length, 0);
});

test("Bankr adapter rejects another chain before submission", async () => {
  const { run, calls } = fixture({ overrides: { sdk: { cashout: async ({ signer }) => {
    await signer.request({ method: "eth_sendTransaction", params: [{ to, chainId: "0x1", value: "0x0" }] });
  } } } });
  await assert.rejects(run(cashoutArgs("fast", ["--confirm"])), /Refusing non-Base transaction/);
  assert.equal(calls.wallet.filter((row) => row.url.endsWith("/wallet/submit")).length, 0);
});

test("Bankr signer cannot route raw sends or arbitrary signing through public RPC", async () => {
  for (const method of ["eth_sendRawTransaction", "eth_signTypedData_v4"]) {
    const { run, calls } = fixture({ overrides: { sdk: { cashout: async ({ signer }) => {
      await signer.request({ method, params: [] });
    } } } });
    await assert.rejects(run(cashoutArgs("fast", ["--confirm"])), /Unsupported wallet RPC method/);
    assert.equal(calls.wallet.filter((row) => row.url.endsWith("/wallet/submit")).length, 0);
  }
});

test("Fast top-up and withdrawals preserve SDK 9 units and require confirmation", async () => {
  const { run, calls } = fixture();
  await preview(run, ["top-up", depositId, "--amount", "25"]);
  await preview(run, ["withdraw", depositId, "--amount", "5"]);
  assert.equal(calls.wallet.length, 0);
  assert.equal(calls.topUp.length, 0);
  assert.equal(calls.withdraw.length, 0);
  await run(["top-up", depositId, "--amount", "25", "--confirm"]);
  await run(["withdraw", depositId, "--amount", "5", "--confirm"]);
  await run(["withdraw", depositId, "--confirm"]);
  assert.equal(calls.topUp[0].amount, 25000000n);
  assert.equal(calls.withdraw[0].input.amount, 5000000n);
  assert.equal("amount" in calls.withdraw[1].input, false);
});

test("Best recovery requires an owned numeric deposit and cannot top-up or partially withdraw", async () => {
  const { run, calls, results } = fixture();
  await assert.rejects(run(["top-up", "7", "--amount", "25", "--confirm"]), /Fast-order action/);
  await assert.rejects(run(["withdraw", "7", "--amount", "5", "--confirm"]), /Best-mode close/);
  assert.equal(calls.wallet.length, 0);
  await assert.rejects(run(["withdraw", "7", "--confirm"]), /Missing --escrow/);
  await assert.rejects(run(["status", "7"]), /Missing --escrow/);
  await assert.rejects(run(["withdraw", "99", "--escrow", to, "--confirm"]), /No Best deposit 99/);
  assert.equal(calls.close.length, 0);
  const planned = await preview(run, ["withdraw", "7", "--escrow", to]);
  assert.equal(planned.escrowAddress, to);
  assert.equal(calls.close.length, 0);
  await run(["withdraw", "7", "--escrow", to, "--confirm"]);
  assert.equal(calls.close[0].id, "7");
  assert.equal(calls.close[0].escrowAddress, to);
  await run(["orders"]);
  assert.deepEqual(results.at(-1).best.map((row) => row.depositId), ["7"]);
});

test("numeric Best ids bind to an explicit owned escrow even when another escrow uses the same id", async () => {
  const { run, calls, results } = fixture({ overrides: { sdk: { deposits: async () => [
    { depositId: "7", escrowAddress: address, status: "active" },
    { depositId: "7", escrowAddress: to, status: "active" },
  ] } } });
  await run(["status", "7", "--escrow", to]);
  assert.equal(results[0].escrowAddress, to);
  await run(["withdraw", "7", "--escrow", to, "--confirm"]);
  assert.equal(calls.close[0].escrowAddress, to);
  assert.notEqual(calls.close[0].escrowAddress, sdk.ESCROW_ADDRESS);
  await assert.rejects(run(["withdraw", "7", "--escrow", "bad", "--confirm"]), /Invalid --escrow/);
  await assert.rejects(run(["withdraw", depositId, "--escrow", to, "--confirm"]), /Fast deposit ids already encode/);
});

test("duplicated exact Best rows remain blocked instead of selecting the first", async () => {
  const { run, calls } = fixture({ overrides: { sdk: { deposits: async () => [
    { depositId: "7", escrowAddress: to, status: "active" },
    { depositId: "7", escrowAddress: to, status: "active" },
  ] } } });
  await assert.rejects(run(["withdraw", "7", "--escrow", to, "--confirm"]), /Ambiguous Best deposit/);
  assert.equal(calls.close.length, 0);
});

test("SDK 9 sanitized CashError emits recovery without removed toJSON or raw exception fields", () => {
  const error = new sdk.CashError({
    code: "CASHOUT_FINALIZATION_FAILED",
    message: "Deposit needs reconciliation",
    retryable: false,
    remediation: "Inspect the existing deposit; never create a duplicate",
    recovery: { kind: "inspect-created-cashout", depositId, transactionHash: hash },
  });
  error.cause = { secret: "DO_NOT_ECHO_PRIVATE_CAUSE" };
  error.raw = { upstream: "DO_NOT_ECHO_PRIVATE_PAYLOAD" };
  error.transactionHashes = [hash];
  assert.equal(typeof error.toJSON, "undefined");
  const payload = errorPayload(error);
  assert.equal(payload.code, "CASHOUT_FINALIZATION_FAILED");
  assert.equal(payload.retryable, false);
  assert.deepEqual(payload.recovery, { kind: "inspect-created-cashout", depositId, transactionHash: hash });
  assert.deepEqual(payload.transactionHashes, [hash]);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /DO_NOT_ECHO|stack|cause|upstream/);
});

test("a later SDK failure preserves earlier accepted transaction hashes", async () => {
  const { run } = fixture({ overrides: { sdk: { cashout: async ({ signer }) => {
    await signer.sendTransaction({ chain: base, to, value: 0n });
    throw new sdk.CashError({ code: "TRANSACTION_STATUS_UNKNOWN", message: "Check receipt", retryable: false, remediation: "Inspect hash" });
  } } } });
  let caught;
  try { await run(cashoutArgs("fast", ["--confirm"])); } catch (error) { caught = error; }
  assert.deepEqual(errorPayload(caught).transactionHashes, [hash]);
});
