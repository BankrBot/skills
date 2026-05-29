#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const BANKR_API_BASE_URL = process.env.BANKR_API_BASE_URL || "https://api.bankr.bot";

async function main() {
  const input = JSON.parse(await readStdin());
  const message = input.message;
  if (!message || typeof message !== "string") {
    throw new Error('Expected signer input JSON with a string "message" field');
  }
  if (!message.startsWith("Katch External Mission Request\n")) {
    throw new Error("Refusing to sign non-Katch message");
  }

  const apiKey = await getBankrApiKey();
  const response = await fetch(`${BANKR_API_BASE_URL.replace(/\/+$/, "")}/wallet/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      signatureType: "personal_sign",
      message,
    }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success || !body?.signature) {
    throw new Error(`Bankr signing failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const expectedSigner = process.env.KATCH_SIGNER_ADDRESS;
  if (expectedSigner && body.signer && body.signer.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error(`Bankr signer ${body.signer} did not match KATCH_SIGNER_ADDRESS ${expectedSigner}`);
  }

  process.stdout.write(`${JSON.stringify({ signature: body.signature })}\n`);
}

async function getBankrApiKey() {
  if (process.env.BANKR_API_KEY) return process.env.BANKR_API_KEY;

  const configPath = process.env.BANKR_CONFIG || join(homedir(), ".bankr", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const apiKey = config.apiKey || config.api_key || config.BANKR_API_KEY;
  if (!apiKey) throw new Error(`No BANKR_API_KEY env var or apiKey in ${configPath}`);
  return apiKey;
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
