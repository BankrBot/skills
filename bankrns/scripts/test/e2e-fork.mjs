// End-to-end test of the skill against a Base mainnet fork with a mock Bankr Wallet API.
//
//   anvil --fork-url https://mainnet.base.org --port 8545 --block-time 1
//   npm test
//
// The mock implements /wallet/me and /wallet/submit by sending transactions from an impersonated
// wallet on the fork, and proxies /addresses/resolve to the REAL Bankr API, so X-handle
// verification is real. The skill itself runs unmodified as a child process.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createPublicClient, createTestClient, createWalletClient, getAddress, http, parseEther } from "viem";
import { base } from "viem/chains";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RPC = "http://127.0.0.1:8545";
const SKILL = join(dirname(fileURLToPath(import.meta.url)), "..", "bankrns.mjs");
const pub = createPublicClient({ chain: base, transport: http(RPC) });
const anvil = createTestClient({ chain: base, transport: http(RPC), mode: "anvil" });

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ✓", msg);
}

// ---------------------------------------------------------------- mock Bankr API

let me = null; // { address, twitter }
async function sendFrom(address, tx) {
  await anvil.impersonateAccount({ address });
  const wallet = createWalletClient({ chain: base, transport: http(RPC), account: address });
  const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value ?? 0) });
  const r = await pub.waitForTransactionReceipt({ hash });
  return { success: r.status === "success", transactionHash: hash, status: r.status, blockNumber: r.blockNumber.toString(), signer: address, chainId: 8453 };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const reply = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  try {
    if (url.pathname === "/addresses/resolve") {
      const real = await fetch(`https://api.bankr.bot${url.pathname}${url.search}`);
      return reply(real.status, await real.json());
    }
    if (req.headers["x-api-key"] !== "bk_test") return reply(401, { error: "Authentication required" });
    if (url.pathname === "/wallet/me") {
      return reply(200, {
        wallets: [{ chain: "evm", address: me.address }],
        socialAccounts: me.twitter ? [{ platform: "twitter", username: me.twitter }] : [],
      });
    }
    if (url.pathname === "/wallet/submit" && req.method === "POST") {
      let raw = "";
      for await (const c of req) raw += c;
      const { transaction } = JSON.parse(raw);
      return reply(200, await sendFrom(me.address, transaction));
    }
    reply(404, { error: "not found" });
  } catch (e) {
    reply(400, { error: String(e.shortMessage || e.message) });
  }
});
await new Promise((r) => server.listen(0, r));
const API = `http://127.0.0.1:${server.address().port}`;

function run(args, { key = true } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, BASE_RPC_URL: RPC, BANKR_API_URL: API };
    if (key) env.BANKR_API_KEY = "bk_test";
    else delete env.BANKR_API_KEY;
    const child = spawn(process.execPath, [SKILL, ...args], { env });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}
const json = (r) => JSON.parse(r.out.split("\n").filter(Boolean).at(-1));
const read = (fn, args) =>
  pub.readContract({
    address: "0xc21096Ce632428BB6d028fb8512583eB52f46301",
    abi: [
      { type: "function", name: "resolve", stateMutability: "view", inputs: [{ type: "string" }], outputs: [{ type: "address" }] },
      { type: "function", name: "reverse", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "string" }] },
      { type: "function", name: "text", stateMutability: "view", inputs: [{ type: "string" }, { type: "string" }], outputs: [{ type: "string" }] },
    ],
    functionName: fn,
    args,
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- scenarios

async function main() {
  const bankrbot = getAddress((await (await fetch("https://api.bankr.bot/addresses/resolve?value=bankrbot&type=twitter")).json()).address);
  const tag = Date.now().toString(36);

  console.log("\n# Full mode: “@bankrbot, buy me a .bankr name” (real Bankr wallet, EIP-7702)");
  me = { address: bankrbot, twitter: "bankrbot" };
  await anvil.setBalance({ address: bankrbot, value: parseEther("1") });
  const label1 = `skill${tag}`;
  let r = await run(["register", label1]);
  console.log(r.out.split("\n").map((l) => "    | " + l).join("\n"));
  assert(r.code === 0, "register exits successfully");
  assert(/Registered/.test(r.out), "prints success");
  assert((await read("resolve", [`${label1}.bankr`])) === bankrbot, "name resolves to the Bankr wallet");
  assert((await read("reverse", [bankrbot])) === `${label1}.bankr`, "primary name set");
  assert((await read("text", [`${label1}.bankr`, "com.twitter"])) === "bankrbot", "verified X handle stored automatically from /wallet/me");

  r = await run(["check", label1]);
  assert(/taken/.test(r.out) && /@bankrbot/.test(r.out), "check shows it as taken, with the owner's handle");

  r = await run(["renew", label1, "--years", "2"]);
  assert(r.code === 0 && /Renewed until/.test(r.out), "full-mode renew works");

  console.log("\n# Build-only mode (inside bankrbot's sandbox): gift a name that resolves elsewhere");
  const friend = "0x000000000000000000000000000000000000bEEF";
  const label2 = `gift${tag}`;
  r = await run(["register", label2, "--build-only", "--wallet-address", bankrbot, "--resolve-to", friend, "--no-twitter"], { key: false });
  const s1 = json(r);
  assert(r.code === 0 && s1.step === 1 && s1.transaction && s1.state, "step 1 prints a transaction + state token, no API key needed");
  assert(s1.transaction.value === "0" && s1.transaction.chainId === 8453, "step 1 tx is a 0-ETH Base transaction");
  await sendFrom(bankrbot, s1.transaction); // bankrbot submits it with its own tools

  r = await run(["register", "--build-only", "--state", s1.state], { key: false });
  const early = json(r);
  assert(early.ready === false && early.waitSeconds > 0, `step 2 run too early says to wait (${early.waitSeconds}s)`);
  await sleep((early.waitSeconds + 2) * 1000);

  r = await run(["register", "--build-only", "--state", s1.state], { key: false });
  const s2 = json(r);
  assert(s2.ready === true && BigInt(s2.transaction.value) > 0n, "step 2 prints the register transaction with payment");
  const receipt = await sendFrom(bankrbot, s2.transaction);
  assert(receipt.success, "bankrbot submits step 2 successfully");
  assert((await read("resolve", [`${label2}.bankr`])) === getAddress(friend), "gifted name resolves to the chosen address");
  assert((await read("reverse", [bankrbot])) === `${label1}.bankr`, "primary name NOT changed when resolving elsewhere");

  r = await run(["register", "--build-only", "--state", s1.state], { key: false });
  assert(json(r).done === true, "re-running step 2 afterwards reports it's done (no double submit)");

  r = await run(["renew", label2, "--build-only"], { key: false });
  const rn = json(r);
  assert(rn.transaction && (await sendFrom(bankrbot, rn.transaction)).success, "build-only renew tx works");

  console.log("\n# Guard rails");
  r = await run(["register", label1, "--build-only", "--wallet-address", bankrbot], { key: false });
  assert(/already taken/.test(json(r).error), "refuses to register a taken name");
  r = await run(["register", "bankr", "--build-only", "--wallet-address", bankrbot], { key: false });
  assert(/reserved/.test(json(r).error), "refuses a reserved name");
  const broke = "0x00000000000000000000000000000000000D0d0D";
  r = await run(["register", `broke${tag}`, "--build-only", "--wallet-address", broke], { key: false });
  assert(/Not enough ETH/.test(json(r).error), "refuses up front when the wallet can't afford it (no wasted gas)");
  r = await run(["register", `spoof${tag}`, "--build-only", "--wallet-address", bankrbot, "--twitter", "jessepollak"], { key: false });
  assert(/not storing @jessepollak/.test(r.err), "won't store someone else's X handle");
  r = await run(["register", "Bad_Name", "--build-only", "--wallet-address", bankrbot], { key: false });
  assert(/isn't a valid/.test(json(r).error), "rejects invalid names with a clear reason");

  console.log("\nALL SKILL E2E CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => server.close());
