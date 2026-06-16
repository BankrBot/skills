#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const APPROVE_SELECTOR = "095ea7b3";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.file ? await readFile(args.file, "utf8") : await readStdin();
  const launch = JSON.parse(source);
  const quote = launch.draft?.fundingQuote || launch.fundingQuote;
  const funding = launch.funding || {};
  const fundingTransaction = launch.fundingTransaction || withChain(launch.next?.sendTransaction, funding.chainId);

  if (!fundingTransaction?.to || !fundingTransaction?.data) {
    throw new Error("Could not find fundingTransaction or next.sendTransaction in Katch launch JSON");
  }

  const chainId = Number(fundingTransaction.chainId || funding.chainId || quote?.chainId);
  const tokenAddress = funding.tokenAddress || quote?.tokenAddress;
  const spender = funding.factoryAddress || quote?.factoryAddress || fundingTransaction.to;
  const totalBudgetBaseUnits = funding.totalBudgetBaseUnits || quote?.totalBudgetBaseUnits;
  if (!chainId || !tokenAddress || !spender || !totalBudgetBaseUnits) {
    throw new Error("Launch JSON is missing chainId, tokenAddress, spender/factoryAddress, or totalBudgetBaseUnits");
  }

  const allowance = args.allowance;
  const approvalRequired = allowance === undefined ? "unknown" : BigInt(allowance) < BigInt(totalBudgetBaseUnits);
  const approvalSubmit = {
    transaction: {
      to: tokenAddress,
      chainId,
      value: "0",
      data: encodeApprove(spender, totalBudgetBaseUnits),
    },
    description: `Approve Katch mission budget (${totalBudgetBaseUnits} base units)`,
    waitForConfirmation: args.wait,
  };
  const fundingSubmit = {
    transaction: {
      to: fundingTransaction.to,
      chainId,
      value: fundingTransaction.value || "0",
      data: fundingTransaction.data,
    },
    description: "Fund Katch mission with exact authorized calldata",
    waitForConfirmation: args.wait,
  };

  const warnings = [];
  const expiresAt = funding.authorization?.expiresAt || quote?.authorization?.expiresAt || launch.next?.expiresAt;
  if (expiresAt) {
    const expiresInSeconds = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
    if (expiresInSeconds <= 0) warnings.push("Katch authorization is expired. Do not submit funding; rerun launch.");
    else if (expiresInSeconds < 120) warnings.push(`Katch authorization expires in ${expiresInSeconds}s. Refetch unless submitting immediately.`);
  }
  if (approvalRequired === "unknown") {
    warnings.push("Allowance was not provided. Check allowance or submit the approval before funding.");
  }

  process.stdout.write(`${JSON.stringify({
    approval: { required: approvalRequired, submit: approvalSubmit },
    funding: { submit: fundingSubmit },
    confirmCommand: launch.next?.commandAfterFunding || launch.nextCommand || (launch.draft?.draftId ? `katch mission confirm ${launch.draft.draftId}` : null),
    warnings,
  }, null, 2)}\n`);
}

function parseArgs(args) {
  const parsed = { file: null, allowance: undefined, wait: true };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file") parsed.file = args[++index];
    else if (arg === "--allowance") parsed.allowance = args[++index];
    else if (arg === "--no-wait") parsed.wait = false;
    else if (!parsed.file) parsed.file = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function withChain(transaction, chainId) {
  if (!transaction) return null;
  return { ...transaction, chainId };
}

function encodeApprove(spender, amount) {
  return `0x${APPROVE_SELECTOR}${encodeAddress(spender)}${encodeUint(amount)}`;
}

function encodeAddress(address) {
  const clean = String(address).toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(clean)) throw new Error(`Invalid address: ${address}`);
  return clean.padStart(64, "0");
}

function encodeUint(value) {
  const hex = BigInt(value).toString(16);
  return hex.padStart(64, "0");
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
