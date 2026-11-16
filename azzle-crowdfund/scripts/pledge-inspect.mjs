#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, selector } from "./lib/keccak256.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZERO = `0x${"0".repeat(40)}`;
const RPC_URL = process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";
const API_URL = (process.env.AZZLE_API_URL || "https://azzle.org").replace(/\/$/, "");
const CAMPAIGN_EVENT = "CampaignCreated(address,address,address,address,uint256,uint256,uint256)";

function fail(message) {
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function parseCampaignId(raw) {
  const text = String(raw ?? "").trim();
  const fromUrl = text.match(/[?&]crowd=([A-Za-z0-9_-]{8,32})/);
  const id = fromUrl ? fromUrl[1] : text;
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) {
    fail("Campaign id must be the crowd id from /crowdfund?crowd=.");
  }
  return id;
}

export function parseAzl(raw) {
  const text = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text) || /^0+(\.0+)?$/.test(text)) {
    fail("Pledge must be a positive AZL amount with up to 6 decimal places.");
  }
  const [whole, frac = ""] = text.split(".");
  const amountAzlWei = BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, "0"));
  const trimmed = frac.replace(/0+$/, "");
  return {
    amountAzl: trimmed ? `${whole}.${trimmed}` : whole,
    amountAzlWei,
  };
}

function loadPin(market) {
  if (market !== "standard" && market !== "micro") fail("Market must be standard or micro.");
  const pin = readJson(join(ROOT, "references", `base-8453-${market}-crowdfund.json`));
  if (pin.market !== market || String(pin.chainId) !== "8453") fail(`${market} crowdfund pin is not Base.`);
  if (!pin.crowdfundFactory || !pin.azl || !pin.taskRegistry || !pin.deploymentBlock) {
    fail(`${market} crowdfund pin is incomplete.`);
  }
  return pin;
}

function loadAllowlist() {
  const allowlist = readJson(join(ROOT, "references", "signing-allowlist.json"));
  if (allowlist.version !== "2.0.0" || String(allowlist.chainId) !== "8453") {
    fail("Pledge allowlist must target Base.");
  }
  if (allowlist.pledge?.spender !== "module") fail("Pledge AZL spender must be the campaign module.");
  if (allowlist.pledge?.approval !== "approve(address,uint256)") fail("Pledge approval selector changed.");
  const calls = new Set(allowlist.pledge?.calls || []);
  if (!calls.has("join(uint256)") || !calls.has("contribute(uint256)")) {
    fail("Pledge allowlist must allow join and contribute only.");
  }
  return allowlist;
}

function eq(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function asAddr(value, label) {
  const hex = String(value || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(hex) || hex === ZERO) fail(`${label} is not a contract address.`);
  return hex;
}

function word(data, index) {
  return String(data).slice(2 + index * 64, 2 + (index + 1) * 64);
}

function wordAddr(data, index) {
  return `0x${word(data, index).slice(24)}`;
}

function wordUint(data, index) {
  return BigInt(`0x${word(data, index) || "0"}`);
}

async function rpc(method, params = []) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    let response;
    try {
      response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`Base RPC HTTP ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      continue;
    }
    if (!response.ok) fail(`Base RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) fail(`Base RPC ${method}: ${body.error.message || JSON.stringify(body.error)}`);
    return body.result;
  }
  fail(lastError?.message || "Base RPC unavailable");
}

async function ethCall(to, signature, args = []) {
  const data = `${selector(signature)}${args.join("")}`;
  const result = await rpc("eth_call", [{ to, data }, "latest"]);
  if (!result || result === "0x") fail(`${signature} returned empty data.`);
  return result;
}

function encodeAddress(address) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function readAddress(to, signature) {
  return asAddr(wordAddr(await ethCall(to, signature), 0), signature);
}

async function readUint(to, signature, args = []) {
  return wordUint(await ethCall(to, signature, args), 0);
}

async function readBool(to, signature, args = []) {
  return wordUint(await ethCall(to, signature, args), 0) === 1n;
}

function readOwners(data) {
  const length = Number(wordUint(data, 1));
  if (!Number.isInteger(length) || length < 1 || length > 200) fail("Safe owner list is not usable.");
  const owners = [];
  for (let i = 0; i < length; i++) owners.push(wordAddr(data, 2 + i));
  return owners;
}

async function fetchCampaign(market, id) {
  const url = `${API_URL}/api/crowdfund-campaigns?market=${market}&id=${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) fail(`Crowdfund board HTTP ${response.status}.`);
  const body = await response.json();
  if (!body?.campaign) fail("Crowdfund board returned no campaign.");
  return body.campaign;
}

async function resolveCampaign(id, market) {
  if (market) {
    const campaign = await fetchCampaign(market, id);
    if (!campaign) fail(`No ${market} bounty has id ${id}.`);
    return campaign;
  }
  const standard = await fetchCampaign("standard", id);
  const micro = await fetchCampaign("micro", id);
  if (standard && micro) fail("That bounty id is listed on both markets. Name standard or micro.");
  if (standard) return standard;
  if (micro) return micro;
  fail(`No bounty has id ${id}.`);
}

async function proveModule(pin, campaign) {
  const module = asAddr(campaign.module, "module");
  const safe = asAddr(campaign.safe, "safe");
  if (campaign.market !== pin.market) fail("Board market does not match the selected pin.");
  const [factory, azl, registry, boundSafe, opener, totalAmount, minJoin, locked] = await Promise.all([
    readAddress(module, "factory()"),
    readAddress(module, "azl()"),
    readAddress(module, "registry()"),
    readAddress(module, "safe()"),
    readAddress(module, "opener()"),
    readUint(module, "totalAmount()"),
    readUint(module, "minJoin()"),
    readBool(module, "locked()"),
  ]);
  if (!eq(factory, pin.crowdfundFactory)) fail("Module factory is not the pinned crowdfund factory.");
  if (!eq(azl, pin.azl)) fail("Module AZL token is not the pinned market AZL.");
  if (!eq(registry, pin.taskRegistry)) fail("Module registry is not the pinned task registry.");
  if (!eq(boundSafe, safe)) fail("Module Safe does not match the bounty Safe.");
  const code = await rpc("eth_getCode", [safe, "latest"]);
  if (!code || code === "0x") fail("Bounty Safe has no code.");
  const enabled = await readBool(safe, "isModuleEnabled(address)", [encodeAddress(module)]);
  if (!enabled) fail("Safe has not enabled this module.");

  if (!/^0x[0-9a-fA-F]{64}$/.test(String(campaign.createTx || ""))) {
    fail("Bounty is missing its create transaction.");
  }
  const receipt = await rpc("eth_getTransactionReceipt", [campaign.createTx]);
  if (!receipt || BigInt(receipt.status || "0x0") !== 1n) fail("Create transaction did not succeed.");
  if (!eq(receipt.to, pin.crowdfundFactory)) fail("Create transaction was not sent to the pinned factory.");
  const topic = keccak256(new TextEncoder().encode(CAMPAIGN_EVENT));
  const logs = (receipt.logs || []).filter((entry) =>
    eq(entry.address, pin.crowdfundFactory)
    && eq(entry.topics?.[0], topic)
    && eq(`0x${String(entry.topics?.[2] || "").slice(-40)}`, module));
  if (logs.length !== 1) fail("Create transaction has no CampaignCreated log for this module.");
  const log = logs[0];
  const topicAddress = (value) => `0x${String(value || "").slice(-40)}`;
  if (!eq(topicAddress(log.topics?.[1]), safe)) fail("CampaignCreated Safe does not match the module.");
  if (!eq(topicAddress(log.topics?.[2]), module)) fail("CampaignCreated module does not match.");
  if (!eq(topicAddress(log.topics?.[3]), opener)) fail("CampaignCreated opener does not match the module.");
  if (wordUint(log.data, 1) !== totalAmount || wordUint(log.data, 2) !== minJoin) {
    fail("CampaignCreated amount does not match the module.");
  }
  if (campaign.createTx && !eq(log.transactionHash, campaign.createTx)) {
    fail("Board create transaction does not match CampaignCreated.");
  }
  return { module, safe, azl, opener, totalAmount, minJoin, locked };
}

async function inspect(id, market) {
  const campaign = await resolveCampaign(id, market);
  const pin = loadPin(campaign.market);
  const proved = await proveModule(pin, campaign);
  const owners = readOwners(await ethCall(proved.safe, "getOwners()"));
  const totalContribution = await readUint(proved.module, "totalContribution()");
  return {
    ok: true,
    id,
    market: pin.market,
    chainId: "8453",
    title: campaign.title || "",
    titleUntrusted: true,
    module: campaign.module,
    safe: campaign.safe,
    opener: proved.opener,
    locked: proved.locked,
    owners: owners.length,
    signaturesRequired: Math.floor((3 * owners.length + 4) / 5),
    totalAmountAzlWei: proved.totalAmount.toString(),
    minJoinAzlWei: proved.minJoin.toString(),
    totalContributionAzlWei: totalContribution.toString(),
    remainingAzlWei: (proved.totalAmount - totalContribution).toString(),
  };
}

async function prepare(id, wallet, amountRaw, market) {
  const allowlist = loadAllowlist();
  const payer = asAddr(wallet, "wallet");
  const amount = parseAzl(amountRaw);
  const view = await inspect(id, market);
  if (view.locked) fail("This bounty is locked. A pledge cannot be added.");
  const module = asAddr(view.module, "module");
  const alreadyOwner = await readBool(view.safe, "isOwner(address)", [encodeAddress(payer)]);
  const contributed = await readUint(module, "contribution(address)", [encodeAddress(payer)]);
  const action = alreadyOwner ? "contribute" : "join";
  const signature = action === "join" ? "join(uint256)" : "contribute(uint256)";
  if (!allowlist.pledge.calls.includes(signature)) fail(`Selector ${signature} is not allowed.`);
  if (!alreadyOwner && view.owners >= 200) fail("This bounty is full at 200 wallets.");
  if (contributed === 0n && amount.amountAzlWei < BigInt(view.minJoinAzlWei)) {
    fail("The first pledge from this wallet is below minJoin.");
  }
  if (amount.amountAzlWei > BigInt(view.remainingAzlWei)) fail("That pledge would pass the goal.");
  const nextOwners = alreadyOwner ? view.owners : view.owners + 1;
  return {
    ok: true,
    action,
    chainId: "8453",
    market: view.market,
    campaignId: id,
    wallet: payer,
    module: view.module,
    safe: view.safe,
    azl: loadPin(view.market).azl,
    amountAzl: amount.amountAzl,
    amountAzlWei: amount.amountAzlWei.toString(),
    alreadyOwner,
    locked: false,
    ownersBefore: view.owners,
    ownersAfter: nextOwners,
    signaturesAfter: Math.floor((3 * nextOwners + 4) / 5),
    calls: [
      {
        chainId: "8453",
        to: loadPin(view.market).azl,
        signature: allowlist.pledge.approval,
        args: [view.module, amount.amountAzlWei.toString()],
        value: "0",
      },
      {
        chainId: "8453",
        to: view.module,
        signature,
        args: [amount.amountAzlWei.toString()],
        value: "0",
      },
    ],
    board: {
      method: "POST",
      path: "/api/crowdfund-campaigns",
      body: {
        action,
        id,
        wallet: payer,
        amountAzl: amount.amountAzl,
        name: null,
      },
      when: "after both receipts succeed and contribution(wallet) has increased by amountAzlWei",
    },
  };
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  console.error("usage: pledge-inspect.mjs inspect <campaignId> [standard|micro] | prepare <campaignId> <wallet> <amountAzl> [standard|micro] | self-check");
  process.exit(2);
}

const command = process.argv[2] || "";

try {
  if (command === "self-check") {
    if (parseCampaignId("https://azzle.org/crowdfund?crowd=m3Xy7C3WEIdG") !== "m3Xy7C3WEIdG") {
      fail("campaign url parser failed");
    }
    const parsed = parseAzl("10.5");
    if (parsed.amountAzlWei !== 10500000000000000000n) fail("AZL decimal parser failed");
    if (selector("approve(address,uint256)") !== "0x095ea7b3") fail("selector helper failed");
    if (selector("join(uint256)") === selector("contribute(uint256)")) fail("pledge selectors collided");
    loadAllowlist();
    loadPin("standard");
    loadPin("micro");
    print({ ok: true });
  } else if (command === "inspect") {
    const id = parseCampaignId(process.argv[3] || "");
    const market = process.argv[4] || "";
    if (market && market !== "standard" && market !== "micro") usage();
    print(await inspect(id, market || null));
  } else if (command === "prepare") {
    const id = parseCampaignId(process.argv[3] || "");
    const wallet = process.argv[4] || "";
    const amount = process.argv[5] || "";
    const market = process.argv[6] || "";
    if (!wallet || !amount || (market && market !== "standard" && market !== "micro")) usage();
    print(await prepare(id, wallet, amount, market || null));
  } else {
    usage();
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
