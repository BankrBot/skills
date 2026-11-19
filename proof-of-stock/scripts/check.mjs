#!/usr/bin/env node
// proof-of-stock/scripts/check.mjs: is this tokenized-stock contract the issuer's own? A Bankr skill helper.
//
//   node scripts/check.mjs 0x<40 hex> [--chain base|robinhood]   check one contract (both chains if none is named)
//   node scripts/check.mjs NVDA [--chain base|robinhood]         the issuer's own contracts for a ticker or company
//
// It calls the public read-only Proof of Stock API (https://proofofstock.xyz, no key) and prints a short verdict in
// fixed words. It never prints the raw JSON: a token that is not on the issuer's list has a symbol and a name its
// creator chose, and they are not allowed into the agent's context. What it prints about such a token comes from
// the issuer's list (the symbol it imitates, the issuer's own address), never from the token itself.
// Node 18 or newer, no dependencies. Exit 0 listed / found, 1 not listed or look-alike, 2 bad input, 3 unavailable.

import { pathToFileURL } from 'node:url'

const API = 'https://proofofstock.xyz'
const CHAINS = ['base', 'robinhood']
const ISSUER = { base: 'Coinbase', robinhood: 'Robinhood' }
const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const TICKER = /^[A-Za-z0-9.\- ]{1,40}$/
const STRONG = new Set(['registry_symbol', 'issuer_name_suffix', 'registry_name'])
// Text from the issuer's list (symbols, names, ISINs) is still printed through this: short, one line, no markup.
const safe = (s, n = 40) => String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, '').replace(/[<>`]/g, '').slice(0, n)
const short = (a) => (ADDRESS.test(a || '') ? a.toLowerCase() : '?')

function parse (argv) {
  const args = argv.slice()
  let chain = null
  const i = args.indexOf('--chain')
  if (i >= 0) { chain = String(args[i + 1] || '').toLowerCase(); args.splice(i, 2) }
  const q = args.join(' ').trim()
  if (chain !== null && !CHAINS.includes(chain)) return { error: 'chain must be base or robinhood' }
  if (ADDRESS.test(q)) return { kind: 'address', q: q.toLowerCase(), chains: chain ? [chain] : CHAINS }
  if (TICKER.test(q) && !q.startsWith('0x')) return { kind: 'ticker', q, chain }
  return { error: q.startsWith('0x') ? 'address must be 0x followed by 40 hex characters' : 'give a contract address (0x + 40 hex) or a ticker' }
}

async function getJson (fetchImpl, path, timeoutMs) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchImpl(API + path, { headers: { accept: 'application/json', 'user-agent': 'bankr-skill-proof-of-stock/1' }, signal: ctl.signal })
    let body = null
    try { body = await r.json() } catch (_) { /* not JSON */ }
    return { status: r.status, body }
  } catch (_) {
    return { status: 0, body: null }
  } finally { clearTimeout(t) }
}

/** One chain's /verify answer as fixed words. */
function verdictOf (chain, v) {
  if (!v || v.status !== 200 || !v.body || typeof v.body.listed !== 'boolean') {
    const why = v && v.status === 429 ? 'rate limited, try again in a minute' : v && v.status === 503 ? 'the issuer registry could not be read just now' : 'the check could not be made'
    return { state: 'unavailable', lines: [`${chain}: UNAVAILABLE (${why}). Do not treat this as listed.`] }
  }
  const b = v.body
  if (b.listed) {
    const lines = [`${chain}: ISSUER-LISTED. ${ISSUER[chain]} lists this exact contract as ${safe(b.symbol, 16)} (${safe(b.name, 48)}${b.isin ? ', ISIN ' + safe(b.isin, 12) : ''}).`]
    if (b.delisted_at) lines.push(`  note: the issuer marks it delisted since ${safe(b.delisted_at, 30)}.`)
    if (b.issuer_factory && b.issuer_factory.created === true) lines.push(`  second source: the issuer's own factory created it (block ${Number(b.issuer_factory.block) || '?'}).`)
    return { state: 'listed', lines }
  }
  const imp = b.impostor
  if (imp && Array.isArray(imp.kinds) && imp.kinds.some((k) => STRONG.has(k))) {
    const lines = [`${chain}: LOOK-ALIKE. Not on ${ISSUER[chain]}'s list, and it imitates ${imp.imitates_symbol ? safe(imp.imitates_symbol, 16) : "the issuer's naming"}.`]
    if (ADDRESS.test(imp.listed_address || '')) lines.push(`  the issuer's own contract for that stock: ${short(imp.listed_address)} (check it with this skill before using it).`)
    return { state: 'impostor', lines }
  }
  const other = b.listed_on_other_chain
  const lines = [`${chain}: NOT ON ${ISSUER[chain].toUpperCase()}'S LIST. That says it is not the issuer's token here; it does not say what it is.`]
  if (other && CHAINS.includes(other.chain)) lines.push(`  the issuer lists this address on ${other.chain} instead.`)
  return { state: 'not_listed', lines }
}

export async function run (argv, { fetchImpl = globalThis.fetch, print = (s) => console.log(s), timeoutMs = 10000 } = {}) {
  const p = parse(argv)
  if (p.error) { print(`Proof of Stock: ${p.error}.`); return 2 }
  if (typeof fetchImpl !== 'function') { print('Proof of Stock: no fetch available (Node 18 or newer is needed).'); return 3 }

  if (p.kind === 'ticker') {
    const r = await getJson(fetchImpl, `/api/find?q=${encodeURIComponent(p.q)}${p.chain ? '&chain=' + p.chain : ''}`, timeoutMs)
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.matches)) { print('Proof of Stock: UNAVAILABLE, the issuer lists could not be searched just now.'); return 3 }
    const m = r.body.matches.filter((x) => x && CHAINS.includes(x.chain) && ADDRESS.test(x.address || '')).slice(0, 8)
    if (!m.length) { print(`Proof of Stock: no issuer-listed token matches "${safe(p.q, 40)}". A token by that name elsewhere is not the issuer's.`); return 1 }
    print(`Proof of Stock: issuer-listed contracts for "${safe(p.q, 40)}"${r.body.match === 'exact' ? '' : ' (closest matches)'}:`)
    for (const x of m) print(`- ${x.chain} (${ISSUER[x.chain]}): ${safe(x.symbol, 16)}, ${safe(x.name, 48)}: ${short(x.address)}`)
    print('Only these exact addresses are the issuer\'s. Any other contract with the same name or symbol is not.')
    print(`Source: ${API}/api/find (issuer lists read every 5 minutes).`)
    return 0
  }

  const results = []
  for (const chain of p.chains) results.push(verdictOf(chain, await getJson(fetchImpl, `/verify?chain=${chain}&address=${p.q}`, timeoutMs)))
  const states = results.map((r) => r.state)
  const head = states.includes('listed') ? 'ISSUER-LISTED' : states.includes('impostor') ? 'LOOK-ALIKE' : states.includes('unavailable') ? 'UNAVAILABLE' : 'NOT ON THE ISSUER\'S LIST'
  print(`Proof of Stock: ${head} for ${p.q}`)
  for (const r of results) for (const l of r.lines) print(l)
  print(`Passport and proof: ${API}/?chain=${p.chains.find((c, k) => results[k].state === 'listed') || p.chains[0]}&address=${p.q}`)
  print('This is a registry check, not advice. It never approves a trade by itself.')
  return states.includes('listed') ? 0 : states.includes('unavailable') && !states.includes('impostor') ? 3 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run(process.argv.slice(2)).then((code) => { process.exitCode = code })
