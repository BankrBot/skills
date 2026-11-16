// Revoke every Elysium permission of a user's account, on chain, with the user's own wallet.
// The smart account calls DelegationManager.disableDelegation(...) for each signed permission, in one UserOperation
// that the owner signs (EIP-712, domain "HybridDeleGator") and the owner's wallet sends itself (EntryPoint.handleOps).
// Gas fees inside the UserOperation are zero, so the (possibly empty) smart account pays nothing; the wallet pays the
// normal gas of its own transaction in HYPE. Needs the npm package viem@2.57.16.
//
//   node revoke.mjs prepare 0xOWNER delegations.json  -> prints {summary, typedData}; saves revoke-userop.json
//        (delegations.json = the reply of POST /api/live/delegations)
//   node revoke.mjs tx 0xOWNER 0xSIGNATURE            -> checks the signature, prints the transaction {to, chainId, value, data}
//   node revoke.mjs check 0xOWNER delegations.json    -> shows which permissions are revoked on chain
import fs from "fs";
import { createPublicClient, http, defineChain, encodeFunctionData, encodeAbiParameters, concat, pad, toHex,
  recoverTypedDataAddress, getAddress } from "viem";

const chain = defineChain({ id: 99901, name: "Elysium", nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.agoradex.app", "https://rpc-live.elysp.com"] } } });
const pub = createPublicClient({ chain, transport: http() });
const DM = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";            // DelegationManager (fixed)
const EP = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";            // ERC-4337 EntryPoint v0.7 (fixed)
const STATE = "revoke-userop.json";

const CAVEAT = { type: "tuple", components: [{ name: "enforcer", type: "address" }, { name: "terms", type: "bytes" }, { name: "args", type: "bytes" }] };
const DELEGATION = { type: "tuple", components: [{ name: "delegate", type: "address" }, { name: "delegator", type: "address" },
  { name: "authority", type: "bytes32" }, { name: "caveats", type: "tuple[]", components: CAVEAT.components },
  { name: "salt", type: "uint256" }, { name: "signature", type: "bytes" }] };
const DM_ABI = [
  { type: "function", name: "disableDelegation", stateMutability: "nonpayable", inputs: [{ name: "_delegation", ...DELEGATION }], outputs: [] },
  { type: "function", name: "getDelegationHash", stateMutability: "pure", inputs: [{ name: "_input", ...DELEGATION }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "disabledDelegations", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "bool" }] }];
const SA_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "execute", stateMutability: "payable", inputs: [{ name: "_mode", type: "bytes32" }, { name: "_executionCalldata", type: "bytes" }], outputs: [] }];
const EP_ABI = [
  { type: "function", name: "getNonce", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint192" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "handleOps", stateMutability: "nonpayable", outputs: [], inputs: [{ name: "ops", type: "tuple[]", components: [
    { name: "sender", type: "address" }, { name: "nonce", type: "uint256" }, { name: "initCode", type: "bytes" }, { name: "callData", type: "bytes" },
    { name: "accountGasLimits", type: "bytes32" }, { name: "preVerificationGas", type: "uint256" }, { name: "gasFees", type: "bytes32" },
    { name: "paymasterAndData", type: "bytes" }, { name: "signature", type: "bytes" }] }, { name: "beneficiary", type: "address" }] }];
const USEROP_TYPES = { PackedUserOperation: [{ name: "sender", type: "address" }, { name: "nonce", type: "uint256" }, { name: "initCode", type: "bytes" },
  { name: "callData", type: "bytes" }, { name: "accountGasLimits", type: "bytes32" }, { name: "preVerificationGas", type: "uint256" },
  { name: "gasFees", type: "bytes32" }, { name: "paymasterAndData", type: "bytes" }, { name: "entryPoint", type: "address" }] };
const BATCH_MODE = pad("0x01", { dir: "right", size: 32 });          // ERC-7579 batch call, default exec type

const die = (m) => { console.error("STOP: " + m); process.exit(1); };
const [, , cmd, ownerArg, third] = process.argv;
if (!/^0x[0-9a-fA-F]{40}$/.test(ownerArg || "")) die("usage: node revoke.mjs prepare|tx|check 0xOWNER ...");
const OWNER = getAddress(ownerArg);
const norm = (d) => ({ delegate: getAddress(d.delegate), delegator: getAddress(d.delegator), authority: d.authority,
  caveats: (d.caveats || []).map((c) => ({ enforcer: getAddress(c.enforcer), terms: c.terms || "0x", args: c.args || "0x" })),
  salt: BigInt(d.salt), signature: d.signature });

async function load(file) {
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  if (getAddress(r.delegation_manager || DM) !== getAddress(DM)) die("unexpected delegation manager");
  const SA = getAddress(r.account);
  const owner = await pub.readContract({ address: SA, abi: SA_ABI, functionName: "owner" });
  if (getAddress(owner) !== OWNER) die(`account ${SA} is owned by ${owner}, not by ${OWNER}`);
  const list = [];
  for (const [kind, d] of Object.entries(r.delegations || {})) {
    const del = norm(d);
    if (del.delegator !== SA) die(`permission ${kind}: delegator is not the account`);
    const hash = await pub.readContract({ address: DM, abi: DM_ABI, functionName: "getDelegationHash", args: [del] });
    const off = await pub.readContract({ address: DM, abi: DM_ABI, functionName: "disabledDelegations", args: [hash] });
    list.push({ kind, del, hash, revoked: off });
  }
  return { SA, list };
}
const ser = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

if (cmd === "check") {
  const { SA, list } = await load(third);
  console.log(JSON.stringify({ account: SA, permissions: list.map((x) => ({ kind: x.kind, revoked: x.revoked })) }, null, 1));
} else if (cmd === "prepare") {
  const { SA, list } = await load(third);
  const todo = list.filter((x) => !x.revoked);
  if (!todo.length) { console.log(JSON.stringify({ summary: { account: SA, to_revoke: [], note: "everything is already revoked" } })); process.exit(0); }
  const execs = todo.map((x) => ({ target: DM, value: 0n, callData: encodeFunctionData({ abi: DM_ABI, functionName: "disableDelegation", args: [x.del] }) }));
  const execCalldata = encodeAbiParameters([{ type: "tuple[]", components: [{ name: "target", type: "address" }, { name: "value", type: "uint256" }, { name: "callData", type: "bytes" }] }], [execs]);
  const callData = encodeFunctionData({ abi: SA_ABI, functionName: "execute", args: [BATCH_MODE, execCalldata] });
  // dry run of the account's call as the EntryPoint makes it (execute is EntryPoint-only): must succeed, gives the gas it needs
  let callGas;
  try { callGas = await pub.estimateGas({ account: EP, to: SA, data: callData }); }
  catch (e) { die("the revoke call fails in simulation: " + (e.shortMessage || e.message)); }
  const callGasLimit = callGas * 3n / 2n + 50_000n, verificationGasLimit = 250_000n, preVerificationGas = 60_000n;
  const nonce = await pub.readContract({ address: EP, abi: EP_ABI, functionName: "getNonce", args: [SA, 0n] });
  const op = { sender: SA, nonce, initCode: "0x", callData,
    accountGasLimits: concat([pad(toHex(verificationGasLimit), { size: 16 }), pad(toHex(callGasLimit), { size: 16 })]),
    preVerificationGas, gasFees: pad("0x", { size: 32 }), paymasterAndData: "0x" };          // zero fees: nothing taken from the account
  const typedData = { domain: { name: "HybridDeleGator", version: "1", chainId: 99901, verifyingContract: SA },
    types: USEROP_TYPES, primaryType: "PackedUserOperation", message: { ...op, entryPoint: EP } };
  fs.writeFileSync(STATE, JSON.stringify(ser({ owner: OWNER, op, typedData })));
  console.log(JSON.stringify(ser({ summary: { account: SA, to_revoke: todo.map((x) => x.kind), already_revoked: list.filter((x) => x.revoked).map((x) => x.kind),
    calls: "DelegationManager.disableDelegation x" + todo.length, gas_paid_by_account: "0" }, typedData }), null, 1));
} else if (cmd === "tx") {
  if (!/^0x[0-9a-fA-F]{130}$/.test(third || "")) die("signature must be 65 bytes hex");
  const s = JSON.parse(fs.readFileSync(STATE, "utf8"));
  if (getAddress(s.owner) !== OWNER) die("revoke-userop.json was prepared for another owner");
  const td = s.typedData, m = td.message;
  const msg = { ...m, nonce: BigInt(m.nonce), preVerificationGas: BigInt(m.preVerificationGas) };
  const signer = await recoverTypedDataAddress({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: msg, signature: third });
  if (getAddress(signer) !== OWNER) die(`signature is from ${signer}, not from ${OWNER}`);
  const op = { ...s.op, nonce: BigInt(s.op.nonce), preVerificationGas: BigInt(s.op.preVerificationGas), signature: third };
  const data = encodeFunctionData({ abi: EP_ABI, functionName: "handleOps", args: [[op], OWNER] });
  let gas;
  try { gas = await pub.estimateGas({ account: OWNER, to: EP, data }); }
  catch (e) { die("the transaction fails in simulation: " + (e.shortMessage || e.message)); }
  console.log(JSON.stringify({ transaction: { to: EP, chainId: 99901, value: "0", data }, estimated_gas: gas.toString() }, null, 1));
} else die("unknown command " + cmd);
