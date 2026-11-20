#!/usr/bin/env node
// Node 18+. Public, read-only checks only; no credentials, approvals or signing.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve, sep } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const catalog = JSON.parse(read('catalog.json'));
const skill = read('SKILL.md');
const protocol = read('references/protocol.md');
const slug = basename(root);
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
assert.ok(frontmatter, 'SKILL.md requires YAML frontmatter');
assert.match(frontmatter[1], new RegExp(`^name: ${slug}$`, 'm'));
assert.match(frontmatter[1], /^description: .+/m);
assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.slug, slug);
assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
assert.equal(catalog.provider, 'EARN');
assert.equal(catalog.providerUrl, 'https://earnonhood.com');
assert.equal(catalog.install.type, 'bankr');
assert.equal(catalog.install.repoPath, slug);
assert.equal(catalog.install.command, `install the ${slug} skill from https://github.com/BankrBot/skills/tree/main/${slug}`);
for (const key of ['title', 'language', 'code']) assert.ok(typeof catalog.demo[key] === 'string' && catalog.demo[key].trim());
assert.ok(Array.isArray(catalog.setup) && catalog.setup.length > 0);
for (const step of catalog.setup) assert.ok(typeof step === 'string' && step.trim());
const logo = readFileSync(resolve(root, catalog.logo));
assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(logo.readUInt32BE(16), logo.readUInt32BE(20), 'Logo must be square');
for (const file of ['SKILL.md', 'references/protocol.md', 'references/bankr-execution.md']) {
  const body = read(file);
  for (const [, target] of body.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https:\/\//.test(target) || target.startsWith('#')) continue;
    const path = resolve(root, dirname(file), target.split('#')[0]);
    assert.ok(path.startsWith(root + sep) && existsSync(path), `Broken/local-escape link in ${file}: ${target}`);
  }
  assert.ok(!/\/Users\/|localhost|127\.0\.0\.1|\/private\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/.test(body), `Private/local content in ${file}`);
  assert.ok(!/\bbk_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/.test(body), `Possible secret in ${file}`);
}
const vaults = [...protocol.matchAll(/^\| ([a-z0-9_]+) \| [^|]+ \| `(0x[0-9a-fA-F]{40})` \| `(0x[0-9a-fA-F]{40})` \((\d+)\) \| `(0x[0-9a-fA-F]{40})` \((\d+)\) \| (\d+) \|$/gm)]
  .map(([, id, vault, token0, decimals0, token1, decimals1]) => ({ id, vault, token0, decimals0: Number(decimals0), token1, decimals1: Number(decimals1) }));
assert.ok(vaults.length > 0, 'No Auto vault catalog parsed');
assert.equal(new Set(vaults.map(v => v.id)).size, vaults.length);
assert.equal(new Set(vaults.map(v => v.vault.toLowerCase())).size, vaults.length);
for (const vault of vaults) {
  for (const key of ['vault', 'token0', 'token1']) assert.ok(address(vault[key]));
  for (const key of ['decimals0', 'decimals1']) assert.ok(Number.isInteger(vault[key]) && vault[key] >= 0 && vault[key] <= 18);
}
console.log(`PASS: catalog, frontmatter, logo, relative links, secret-pattern checks and ${vaults.length} vault records.`);
const args = process.argv.slice(2);
assert.ok(args.every(arg => arg === '--live'), 'Usage: node scripts/check.mjs [--live]');
if (!args.includes('--live')) process.exit(0);

const site = 'https://earnonhood.com';
const rpcUrl = 'https://rpc.mainnet.chain.robinhood.com';
async function getJson(path) {
  const response = await fetch(new URL(path, site), { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { accept: 'application/json' } });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  const value = JSON.parse(await response.text());
  assert.ok(value && typeof value === 'object' && value.ready !== false, `${path}: not ready`);
  return value;
}
let rpcId = 0;
async function rpc(method, params, attempt = 0) {
  assert.ok(['eth_chainId', 'eth_getCode', 'eth_call'].includes(method), 'Only read-only RPC is allowed');
  const response = await fetch(rpcUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) });
  if (response.status === 429 && attempt < 2) {
    await pause(1000 * (attempt + 1));
    return rpc(method, params, attempt + 1);
  }
  assert.ok(response.ok, `RPC HTTP ${response.status}`);
  const data = await response.json();
  if (data.error && /rate|too many|limit|busy/i.test(data.error.message ?? '') && attempt < 2) {
    await pause(1000 * (attempt + 1));
    return rpc(method, params, attempt + 1);
  }
  assert.ok(!data.error && data.result !== undefined, `RPC failed: ${method} ${params[0]?.to ?? ''}: ${data.error?.code ?? ''} ${String(data.error?.message ?? '').slice(0,160)}`);
  return data.result;
}
const [metrics, apr] = await Promise.all([getJson('/api/steer/metrics'), getJson('/api/steer-apr')]);
assert.ok(Array.isArray(metrics.vaults) && metrics.vaults.length > 0);
assert.ok(apr.vaults && typeof apr.vaults === 'object');
for (const vault of vaults) {
  const live = metrics.vaults.find(v => v.id === vault.id);
  assert.equal(live?.vault?.toLowerCase(), vault.vault.toLowerCase(), `Catalog drift: ${vault.id}`);
}
console.log(`PASS: ${vaults.length} pinned vaults match live metrics; APR endpoint responds. Missing APR components still need runtime handling.`);
const extra = metrics.vaults.filter(v => !vaults.some(known => known.id === v.id));
if (extra.length) console.warn(`REVIEW: ${extra.length} new live vaults need catalog verification.`);
const [pools, rewards] = await Promise.all([getJson('/api/omni/pools'), getJson('/api/omni/rewards')]);
assert.ok(Array.isArray(pools.pools) && pools.pools.length > 0);
assert.ok(Array.isArray(rewards.pools));
for (const pool of pools.pools) {
  assert.ok(address(pool.address));
  assert.ok(Array.isArray(pool.tokens) && pool.tokens.length >= 2);
  for (const token of pool.tokens) assert.ok(address(token.address) && Number.isInteger(token.decimals));
}
console.log(`PASS: ${pools.pools.length} registered Omnipools; rewards endpoint responds. No claim of universal zap routing.`);
const [autoZap, omniZap] = await Promise.all([getJson('/api/steer/rialto'), getJson('/api/omni/rialto')]);
for (const zap of [autoZap, omniZap]) assert.ok(zap.configured === true && address(zap.router));
assert.equal(BigInt(await rpc('eth_chainId', [])), 4663n);
for (const contract of [autoZap.router, omniZap.router, '0x28082618Ba2073E602230188E4F4C46e9b2169EB', '0xFCcDd6Df64de63b609042c55C629F223321340e1']) {
  const code = await rpc('eth_getCode', [contract, 'latest']);
  assert.ok(/^0x[0-9a-f]+$/i.test(code) && code.length > 2, `No contract code: ${contract}`);
}
// EARN's common executor registry works across Steer vault implementations;
// not all vaults themselves expose token0()/token1().
for (const vault of vaults) {
  const arg = vault.vault.slice(2).toLowerCase().padStart(64, '0');
  const supported = await rpc('eth_call', [{ to: autoZap.router, data: '0x240825cb' + arg }, 'latest']); // isVaultSupported(address)
  assert.equal(BigInt(supported), 1n, `${vault.id}: not registered in the current executor`);
  const t0 = await rpc('eth_call', [{ to: autoZap.router, data: '0xb687c0a3' + arg }, 'latest']); // vaultToken0(address)
  const t1 = await rpc('eth_call', [{ to: autoZap.router, data: '0x31406709' + arg }, 'latest']); // vaultToken1(address)
  assert.equal('0x' + t0.slice(-40).toLowerCase(), vault.token0.toLowerCase(), `${vault.id}: token0 drift`);
  assert.equal('0x' + t1.slice(-40).toLowerCase(), vault.token1.toLowerCase(), `${vault.id}: token1 drift`);
  console.log(`PASS: ${vault.id} token0/token1 match the catalog.`);
  await pause(150);
}
for (const [selector, expected] of [
  ['0xfbfa77cf', '0x28082618Ba2073E602230188E4F4C46e9b2169EB'], // vault()
  ['0x49ec8b38', '0xFCcDd6Df64de63b609042c55C629F223321340e1'], // balancerRouter()
  ['0x12261ee7', '0x000000000022D473030F116dDEE9F6B43aC78BA3'], // permit2()
]) {
  const result = await rpc('eth_call', [{ to: omniZap.router, data: selector }, 'latest']);
  assert.equal('0x' + result.slice(-40).toLowerCase(), expected.toLowerCase(), 'Omni executor wiring mismatch');
}
console.log(`PASS: chain 4663, executor/core bytecode, Omni wiring, and onchain registered token identities for ${vaults.length} vaults.`);
console.log('Read-only checks complete. No quotes executed, no credentials used, no Bankr submissions or funded-wallet end-to-end test.');
