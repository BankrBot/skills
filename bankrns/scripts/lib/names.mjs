// Name validation and transaction builders — mirror the on-chain contracts exactly.
import { encodeFunctionData, getAddress, isAddress, labelhash, namehash, stringToHex, toHex } from "viem";
import {
  COIN_TYPE_DEFAULT,
  CONTRACTS,
  CHAIN_ID,
  TWITTER_KEY,
  YEAR,
  controllerAbi,
  resolverAbi,
} from "./contracts.mjs";

export const REFERRER = stringToHex("bankrns-skill", { size: 32 });

/** Mirrors src/utils/LabelValidator.sol. Returns null if valid, else a human-readable reason. */
export function labelError(label) {
  if (!label) return "Enter a name";
  if (label.length < 3) return "Names need at least 3 characters";
  if (label.length > 63) return "Names can be at most 63 characters";
  if (!/^[a-z0-9-]+$/.test(label)) return "Only lowercase letters a–z, digits 0–9 and hyphens are allowed";
  if (label.startsWith("-") || label.endsWith("-")) return "Names can't start or end with a hyphen";
  if (label.length >= 4 && label[2] === "-" && label[3] === "-") return "Hyphens in positions 3 and 4 aren't allowed";
  return null;
}

/** "Alice.bankr" / "alice" -> "alice". Lowercases, strips the .bankr suffix. */
export function toLabel(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\.bankr$/, "");
}

export const fullName = (label) => `${label}.bankr`;
export const nodeOf = (label) => namehash(fullName(label));
export const idOf = (label) => BigInt(labelhash(label));

/** USD/year by length as configured in the deployed oracle (display only; ETH price comes from chain). */
export const usdPerYear = (label) => (label.length >= 5 ? 5 : label.length === 4 ? 80 : 320);

export function randomSecret() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * The exact struct that is committed to in step 1 and revealed in step 2.
 * @param p {label, owner, resolveTo, years, secret, primary, twitter?}
 */
export function buildRegistration(p) {
  const node = nodeOf(p.label);
  const data = [
    encodeFunctionData({ abi: resolverAbi, functionName: "setAddr", args: [node, p.resolveTo] }),
    encodeFunctionData({ abi: resolverAbi, functionName: "setAddr", args: [node, COIN_TYPE_DEFAULT, p.resolveTo] }),
  ];
  if (p.twitter) {
    data.push(encodeFunctionData({ abi: resolverAbi, functionName: "setText", args: [node, TWITTER_KEY, p.twitter] }));
  }
  return {
    label: p.label,
    owner: p.owner,
    duration: BigInt(p.years) * BigInt(YEAR),
    secret: p.secret,
    resolver: CONTRACTS.resolver,
    data,
    reverseRecord: !!p.primary,
    referrer: REFERRER,
  };
}

const tx = (data, value = 0n) => ({ to: CONTRACTS.controller, data, value, chainId: CHAIN_ID });

export const commitTx = (commitment) => tx(encodeFunctionData({ abi: controllerAbi, functionName: "commit", args: [commitment] }));
export const registerTx = (registration, value) =>
  tx(encodeFunctionData({ abi: controllerAbi, functionName: "register", args: [registration] }), value);
export const renewTx = (label, years, value) =>
  tx(encodeFunctionData({ abi: controllerAbi, functionName: "renew", args: [label, BigInt(years) * BigInt(YEAR), REFERRER] }), value);

/** Adds a buffer for ETH/USD moves between quote and inclusion; the contract refunds the excess. */
export const withBuffer = (wei, bps = 300n) => wei + (wei * bps) / 10_000n + 1n;

/** JSON-safe tx (bigint value -> decimal string), the shape Bankr's "Submit this transaction" expects. */
export const txJson = (t) => ({ to: t.to, data: t.data, value: t.value.toString(), chainId: t.chainId });

// ---- step-2 state for --build-only mode (the secret must survive between the two steps) ----

export function encodeState(p) {
  return Buffer.from(JSON.stringify(p)).toString("base64url");
}

export function decodeState(token) {
  const p = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  if (!p.label || !isAddress(p.owner, { strict: false }) || !isAddress(p.resolveTo, { strict: false }) || !/^0x[0-9a-f]{64}$/i.test(p.secret)) {
    throw new Error("Invalid --state token");
  }
  return { ...p, owner: getAddress(p.owner.toLowerCase()), resolveTo: getAddress(p.resolveTo.toLowerCase()) };
}

export const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
