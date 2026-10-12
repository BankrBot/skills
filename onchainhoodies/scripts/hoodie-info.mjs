#!/usr/bin/env node
// Read-only diagnostic, never signs or broadcasts a transaction.
const nftAddress = '0x9Ec6C5b9f572A9B02138E553BC5F5882Da735F45';
const hoodOsAddress = '0x1993c5515E81d2768f7F8D8a1e6e38Bbf4e4beB9';
const rpcUrl = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';

function usage() {
  console.log('Usage: node scripts/hoodie-info.mjs <tokenId> [ownerAddress]');
  console.log('Read-only Robinhood Chain mainnet inspection; RH_RPC_URL optionally overrides RPC.');
}
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
const tokenIdRaw = process.argv[2];
const ownerArg = process.argv[3];
if (!tokenIdRaw || !/^\d+$/.test(tokenIdRaw) || (ownerArg && !/^0x[0-9a-fA-F]{40}$/.test(ownerArg))) {
  usage();
  process.exit(1);
}

const { ethers } = await import('ethers');
const provider = new ethers.JsonRpcProvider(rpcUrl, 4663, { staticNetwork: true });
const tokenId = BigInt(tokenIdRaw);
const nft = new ethers.Contract(nftAddress, ['function ownerOf(uint256) view returns (address)'], provider);
const os = new ethers.Contract(hoodOsAddress, [
  'function walletOf(uint256) view returns (address)',
  'function isActive(uint256) view returns (bool)',
  'function activationEnabled() view returns (bool)',
  'function activationCost() view returns (uint256)',
  'function paymentToken() view returns (address)',
], provider);
try {
  const chain = await provider.getNetwork();
  if (chain.chainId !== 4663n) throw new Error(`Wrong network: ${chain.chainId}`);
  const [owner, wallet, active, enabled, cost, paymentAddress] = await Promise.all([
    nft.ownerOf(tokenId), os.walletOf(tokenId), os.isActive(tokenId),
    os.activationEnabled(), os.activationCost(), os.paymentToken(),
  ]);
  const erc20 = new ethers.Contract(paymentAddress, [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
  ], provider);
  const [decimals, symbol, balance, allowance, nativeBalance, walletCode] = await Promise.all([
    erc20.decimals(), erc20.symbol(), erc20.balanceOf(owner),
    erc20.allowance(owner, hoodOsAddress), provider.getBalance(owner), provider.getCode(wallet),
  ]);
  const result = {
    chainId: Number(chain.chainId), tokenId: tokenId.toString(),
    collection: nftAddress, hoodOS: hoodOsAddress, owner, hoodWallet: wallet,
    hoodWalletDeployed: walletCode !== '0x', active, activationEnabled: enabled,
    paymentToken: paymentAddress, paymentSymbol: symbol,
    activationCost: ethers.formatUnits(cost, decimals),
    ownerTokenBalance: ethers.formatUnits(balance, decimals),
    currentAllowance: ethers.formatUnits(allowance, decimals),
    needsApproval: allowance < cost, hasEnoughTokens: balance >= cost,
    ownerGasETH: ethers.formatEther(nativeBalance),
    queriedAddress: ownerArg || null,
    queriedAddressIsOwner: ownerArg ? owner.toLowerCase() === ownerArg.toLowerCase() : null,
    readOnly: true,
  };
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(`Read failed: ${err.shortMessage || err.message}`);
  process.exitCode = 1;
} finally {
  provider.destroy();
}
