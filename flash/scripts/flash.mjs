#!/usr/bin/env node
// Flash protocol on Base: read-only views and UNSIGNED transaction plans.
// It never signs, holds keys or broadcasts. Output is always JSON.
//   node flash.mjs <command> [--flag value ...]
//   node flash.mjs help
import { getAddress } from 'viem';
import { K } from './lib/contracts.mjs';
import { parseUnits } from 'viem';
import { api, client, fmt, RPC_URL, call, simulate, plan } from './lib/plan.mjs';
import * as A from './lib/abis.mjs';
import { quoteCommand, swapCommand } from './lib/trade.mjs';
import * as R from './lib/rewards.mjs';
import * as C from './lib/churn.mjs';
import * as L from './lib/launch.mjs';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) { (options._ ||= []).push(token); continue; }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) options[key] = true;
    else { options[key] = next; i += 1; }
  }
  if (!options.wallet && process.env.FLASH_WALLET) options.wallet = process.env.FLASH_WALLET;
  if (!options.wallet && process.env.BANKR_WALLET_ADDRESS) options.wallet = process.env.BANKR_WALLET_ADDRESS;
  return { command, options };
}

async function overview() {
  const [live, tokens, markets] = await Promise.all([api('/v1/stack/live'), api('/v1/stack/tokens'), api('/v1/stack/markets')]);
  return {
    ok: true, status: 'info', action: 'overview',
    flash: { priceEthPerFlash: live.flash?.sqrtPriceX96 ? (2 ** 192 / Number(live.flash.sqrtPriceX96) ** 2) : undefined, koth: live.flash?.game, nextTrigger: live.flash?.nextTrigger, top100PoolEth: live.flash?.top100PoolEth },
    tokens: tokens.tokens.map((t) => ({ symbol: t.symbol, address: t.address, kind: t.kind, priceUsd: t.priceUsd, changePct24h: t.changePct24h, volumeUsd24h: t.volumeUsd24h })),
    perps: markets.markets.map((m) => ({ id: m.id, symbol: m.symbol, token: m.token, navUsdc: m.navUsdc, buyCapacityUsdc: m.buyCapacityUsdc, change24hPct: m.change24hPct })),
    quant: live.quant,
  };
}

async function portfolio(options) {
  if (!options.wallet) throw new Error('--wallet is required');
  const account = getAddress(options.wallet);
  const [balances, eth, perps, referral, revshare, orders] = await Promise.all([
    api(`/v1/wallet/${account}/balances`).catch((error) => ({ error: error.message })),
    client.getBalance({ address: account }),
    R.perpPositions({ wallet: account }).catch((error) => ({ error: error.message })),
    R.referralStatus({ wallet: account }).catch((error) => ({ error: error.message })),
    R.revshareStatus({ wallet: account }).catch((error) => ({ error: error.message })),
    C.limitOrders({ wallet: account }).catch((error) => ({ error: error.message })),
  ]);
  const flash = await client.readContract({ address: K.tokens.FLASH.address, abi: A.erc20, functionName: 'balanceOf', args: [account] });
  const quant = await client.readContract({ address: K.tokens.QUANT.address, abi: A.erc20, functionName: 'balanceOf', args: [account] });
  return {
    ok: true, status: 'info', action: 'portfolio', account,
    onChain: { eth: fmt(eth), flash: fmt(flash), quant: fmt(quant) },
    walletApi: balances, perps: perps.positions ?? perps, referral, revenueShare: revshare.error ? revshare : { position: revshare.position, retired: revshare.retired }, limitOrders: orders.markets ?? orders,
  };
}

async function wrapEth(options) {
  if (!options.wallet) throw new Error('--wallet is required');
  const account = getAddress(options.wallet);
  const amount = parseUnits(String(options.amount || ''), 18);
  if (!amount) throw new Error('--amount is required');
  const txs = [call({ to: K.tokens.WETH.address, abi: A.weth, functionName: 'deposit', value: amount, description: `Wrap ${fmt(amount)} ETH to WETH` })];
  return plan({ action: 'wrap-eth', summary: { amount: fmt(amount) }, transactions: txs, simulation: await simulate(account, txs), notes: ['Graduated ETH-pair launches trade against WETH: wrap first, then swap --market <token> --side buy.'] });
}

const COMMANDS = {
  'wrap-eth': wrapEth,
  help: async () => ({ ok: true, status: 'info', usage: USAGE }),
  contracts: async () => ({ ok: true, status: 'info', contracts: K }),
  api: async (o) => {
    const path = o._?.[0];
    if (!path || !/^\/?v1\/[A-Za-z0-9/_.:?=&-]+$/.test(path)) throw new Error('api <path>, e.g. api /v1/stack/live (GET only)');
    return { ok: true, status: 'info', path, data: await api(path) };
  },
  overview,
  portfolio,
  quote: quoteCommand,
  swap: swapCommand,
  'referral-status': R.referralStatus,
  'referral-bind': R.referralBind,
  'referral-claim': R.referralClaim,
  'referral-board': R.referralBoard,
  'referral-distribute': R.referralDistribute,
  'koth-status': R.kothStatus,
  'koth-buy': R.kothBuy,
  'koth-settle': R.kothSettle,
  'perp-positions': R.perpPositions,
  'perp-unwind': R.perpUnwind,
  'perp-orders': R.perpOrdersList,
  'perp-tpsl': R.perpTpSl,
  'perp-order-cancel': R.perpOrderCancel,
  'quant-status': R.quantStatus,
  'quant-sweep': R.quantSweep,
  'revshare-status': R.revshareStatus,
  'revshare-deposit': R.revshareDeposit,
  'revshare-withdraw': R.revshareWithdraw,
  'revshare-claim': R.revshareClaim,
  'revshare-migrate': R.revshareMigrate,
  treasury: R.treasuryInfo,
  'limit-markets': C.limitMarkets,
  'limit-orders': C.limitOrders,
  'limit-place': C.limitPlace,
  'limit-cancel': C.limitCancel,
  'limit-claim': C.limitClaim,
  'fullrange-deposit': (o) => C.fullRange(o, 'deposit'),
  'fullrange-withdraw': (o) => C.fullRange(o, 'withdraw'),
  'fullrange-claim': (o) => C.fullRange(o, 'claim'),
  'lattice-list': C.latticeList,
  'lattice-show': C.latticeShow,
  'lattice-open': C.latticeOpen,
  'lattice-withdraw': C.latticeWithdraw,
  'lattice-reformat': C.latticeReformat,
  'lattice-transfer': C.latticeTransfer,
  'launch-list': L.launchList,
  'launch-info': L.launchInfo,
  'launch-create': L.launchCreate,
  'launch-buy': L.launchBuy,
  'launch-sell': L.launchSell,
  'launch-claim': L.launchClaim,
  'launch-refund': L.launchRefund,
  'launch-creator-claim': L.launchCreatorClaim,
  'launch-graduate': L.launchGraduate,
  'launch-poke': L.launchPoke,
  'launch-airdrop': L.launchAirdrop,
  'war-status': L.warStatus,
  'war-enter': L.warEnter,
  'war-back': L.warBack,
  'war-sell': L.warSell,
  'war-jump': L.warJump,
  'war-claim': L.warClaim,
  'war-refund': L.warRefund,
  'war-creator-claim': L.warCreatorClaim,
  'war-open': L.warOpen,
  'war-finalize': L.warFinalize,
};

const USAGE = `node flash.mjs <command> [--wallet 0x...] [flags]   (JSON out; never signs or sends)
Reads:   overview | portfolio --wallet | contracts | api /v1/stack/live
Trade:   quote|swap --market FLASH|QUANT|ETH2xL|<launched token> --side buy|sell --amount N [--pay ETH|USDC|FLASH] [--exact-out] [--slippage-bps 500]
Refs:    referral-status | referral-bind --code N [--signature 0x --deadline T] | referral-claim | referral-board | referral-distribute
KOTH:    koth-status | koth-buy [--amount ETH] | koth-settle
Perps:   perp-positions | perp-unwind --market BTC2x [--amount N|all]   (buy/sell perps with swap)
TP/SL:   perp-orders [--status open] | perp-tpsl --market ETH2xL [--amount N|all] (--tp NAV | --sl NAV [--sl-min USDC] | both) [--expiry-days D] | perp-order-cancel --ids 1,2
QUANT:   quant-status | quant-sweep --pool <id>|--token <launch>
Limits:  limit-markets | limit-orders | limit-place --market FLASH|QUANT --amount N (--price P | --low P --high P [--bins 16 --shape exp] | --low-mult 1.5 --high-mult 10)
         limit-cancel --market M --level T | limit-claim --market M | fullrange-deposit|withdraw|claim --market M
Lattice: lattice-list --market M | lattice-show --id N | lattice-withdraw --id N [--amount] | lattice-transfer --id N --to 0x | lattice-reformat --id N --params JSON | lattice-open (creators/treasuries only)
Launch:  launch-list | launch-info --token | launch-create --name --symbol --pair ETH|FLASH|STOCK|PERP [--quote NVDAc|ETH2xL] [--mode 0|1 --preset 0|1 --reward 0x] --eth N
         launch-buy --token (--eth N|--flash N) | launch-sell --token [--amount N|all] | launch-claim | launch-refund | launch-creator-claim | launch-graduate | launch-poke | launch-airdrop
Wars:    war-status | war-enter --name --symbol --pair .. [--quote] [--pay ETH|FLASH] | war-back --id N --pay ETH|USDC|FLASH --amount N | war-sell --id N [--units] | war-jump --from A --to B [--units]
         war-claim [--war N] | war-refund --war N --id N | war-creator-claim [--war N] | war-open | war-finalize
Misc:    wrap-eth --amount N (ETH-pair launches trade against WETH)
Revenue: revshare-status | revshare-deposit --amount N|all (stake FLASH, earns ETH) | revshare-claim (ETH, keeps the stake) | revshare-withdraw [--amount N|all] (full FLASH stake + ETH out)
         revshare-migrate [--exit-only] [--amount N] (retired vault -> Revenue Share) | treasury --token 0x
Env: FLASH_RPC_URL (default ${RPC_URL}), FLASH_API_URL, FLASH_WALLET / BANKR_WALLET_ADDRESS.`;

const json = (value) => JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry), 2);

const { command, options } = parseArgs(process.argv.slice(2));
const handler = COMMANDS[command || 'help'];
if (!handler) {
  console.log(json({ ok: false, error: `Unknown command ${command}`, usage: USAGE }));
  process.exit(1);
}
try {
  const chainId = await client.getChainId();
  if (chainId !== 8453) throw new Error(`RPC ${RPC_URL} is chain ${chainId}, not Base (8453)`);
  const result = await handler(options);
  console.log(json(result));
  process.exit(result.ok === false ? 1 : 0);
} catch (error) {
  console.log(json({ ok: false, error: (error.shortMessage || error.message || String(error)).split('\n')[0] }));
  process.exit(1);
}
