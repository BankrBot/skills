#!/usr/bin/env node
/**
 * deployer-scanner.js - FIXED scoring
 * 
 * Bug fix: Track actual contract creations separately from tokens with market data
 */

const ROUTESCAN_API_KEY = process.env.ROUTESCAN_API_KEY || 'rs_a60d758bbed63a5b598141e7';
const API_BASE = 'https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (i === maxRetries - 1) throw new Error(`HTTP ${response.status}`);
        await sleep(1000 * (i + 1));
        continue;
      }
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}

async function getDeployerAddress(tokenCA) {
  const url = `${API_BASE}?module=contract&action=getcontractcreation&contractaddresses=${tokenCA}&apikey=${ROUTESCAN_API_KEY}`;
  
  const data = await fetchWithRetry(url);
  
  if (data.status === '1' && data.result && data.result[0] && data.result[0].contractCreator) {
    return data.result[0].contractCreator;
  }
  
  console.error('  getcontractcreation empty, trying txlist fallback...');
  const txUrl = `${API_BASE}?module=account&action=txlist&address=${tokenCA}&startblock=0&endblock=99999999&sort=asc&page=1&offset=10&apikey=${ROUTESCAN_API_KEY}`;
  
  const txData = await fetchWithRetry(txUrl);
  
  if (txData.status === '1' && txData.result && txData.result.length > 0) {
    const firstTx = txData.result[0];
    return firstTx.from;
  }
  
  throw new Error(`Could not determine deployer for ${tokenCA}`);
}

async function getDeployerContracts(deployerAddress) {
  const url = `${API_BASE}?module=account&action=txlistinternal&address=${deployerAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${ROUTESCAN_API_KEY}`;
  
  const data = await fetchWithRetry(url);
  
  if (data.status !== '1' || !data.result) {
    return [];
  }
  
  return data.result.filter(tx => 
    tx.contractAddress && 
    tx.contractAddress !== '' &&
    (tx.type === 'create' || tx.type === 'create2')
  );
}

async function getTokenInfo(contractAddress) {
  try {
    const url = `https://api.dexscreener.com/token-pairs/v1/base/${contractAddress}`;
    
    await sleep(300);
    
    const data = await fetchWithRetry(url);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }
    
    const pair = data[0];
    const baseToken = pair.baseToken;
    const quoteToken = pair.quoteToken;
    
    const isBase = baseToken.address.toLowerCase() === contractAddress.toLowerCase();
    const token = isBase ? baseToken : quoteToken;
    
    const mcap = pair.fdv || pair.marketCap || 0;
    const volume24h = pair.volume?.h24 || 0;
    const priceUsd = parseFloat(pair.priceUsd || 0);
    const liquidity = pair.liquidity?.usd || 0;
    
    const pairCreatedAt = new Date(pair.pairCreatedAt || Date.now());
    const daysOld = Math.floor((Date.now() - pairCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    let status = 'unknown';
    if (liquidity === 0 || mcap === 0 || priceUsd === 0) {
      status = 'dead';
    } else if (liquidity > 1000) {
      status = 'active';
    } else {
      status = 'low_liquidity';
    }
    
    return {
      ca: contractAddress,
      name: token.name || 'Unknown',
      symbol: token.symbol || '???',
      currentMcap: mcap,
      peakMcap: mcap,
      volume24h,
      liquidity,
      status,
      daysOld,
      priceUsd
    };
  } catch (error) {
    return null;
  }
}

function calculateDeployerScore(tokensWithData, totalContractsCreated) {
  let score = 50;
  
  // Use actual contract count, not just those with market data
  const totalTokens = totalContractsCreated;
  const survived7Days = tokensWithData.filter(t => t && t.daysOld >= 7 && t.status === 'active').length;
  const survived30Days = tokensWithData.filter(t => t && t.daysOld >= 30 && t.status === 'active').length;
  const deadUnder72h = tokensWithData.filter(t => t && t.daysOld < 3 && t.status === 'dead').length;
  
  const validMcaps = tokensWithData.filter(t => t && t.peakMcap > 0).map(t => t.peakMcap);
  const avgPeakMcap = validMcaps.length > 0 ? validMcaps.reduce((a, b) => a + b, 0) / validMcaps.length : 0;
  
  // Positive signals
  if (survived30Days > 0) score += 10;
  score += Math.min(survived7Days * 5, 20);
  if (avgPeakMcap > 500000) score += 10;
  
  // Negative signals
  score -= Math.min(deadUnder72h * 10, 30);
  
  // CRITICAL FIX: Penalize serial deployers with no survivors
  if (totalTokens > 5 && survived7Days === 0) {
    score -= 20;  // Increased penalty for proven track record of failure
  }
  
  // Additional penalty: lots of contracts deployed but almost none have market data
  const dataRate = totalTokens > 0 ? tokensWithData.length / totalTokens : 0;
  if (totalTokens >= 10 && dataRate < 0.3) {
    score -= 15;  // Most deployed contracts never got liquidity = red flag
  }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    score: Math.round(score),
    totalTokens,
    tokensWithMarketData: tokensWithData.length,
    survived7Days,
    survived30Days,
    deadUnder72h,
    avgPeakMcap: Math.round(avgPeakMcap),
    dataRate: Math.round(dataRate * 100)
  };
}

async function scanDeployer(tokenCA) {
  console.error(`\nScanning deployer for token: ${tokenCA}`);
  
  if (!ROUTESCAN_API_KEY) {
    throw new Error('ROUTESCAN_API_KEY environment variable not set');
  }
  
  console.error('Step 1: Fetching deployer address...');
  const deployerAddress = await getDeployerAddress(tokenCA);
  console.error(`  Deployer: ${deployerAddress}`);
  
  console.error('Step 2: Fetching deployer contract creations...');
  const contractCreations = await getDeployerContracts(deployerAddress);
  console.error(`  Found ${contractCreations.length} contract creations`);
  
  console.error('Step 3: Fetching token info from DexScreener...');
  const previousTokens = [];
  
  for (const tx of contractCreations) {
    const contractAddr = tx.contractAddress;
    
    if (contractAddr.toLowerCase() === tokenCA.toLowerCase()) {
      continue;
    }
    
    const tokenInfo = await getTokenInfo(contractAddr);
    if (tokenInfo) {
      previousTokens.push(tokenInfo);
    }
  }
  
  console.error(`  Found market data for ${previousTokens.length}/${contractCreations.length} contracts`);
  
  // FIXED: Pass both market data AND total contract count
  const scoreData = calculateDeployerScore(previousTokens, contractCreations.length);
  
  let tokenName = 'Unknown';
  let tokenSymbol = '???';
  try {
    const currentTokenInfo = await getTokenInfo(tokenCA);
    if (currentTokenInfo) {
      tokenName = currentTokenInfo.name;
      tokenSymbol = currentTokenInfo.symbol;
    }
  } catch (e) {
    console.error('  Warning: Could not fetch current token info');
  }
  
  const output = {
    token: tokenSymbol,
    tokenName,
    ca: tokenCA,
    deployer: deployerAddress,
    deployerHistory: {
      totalContractsCreated: scoreData.totalTokens,
      tokensWithMarketData: scoreData.tokensWithMarketData,
      dataRate: scoreData.dataRate,
      survivedPast7Days: scoreData.survived7Days,
      survivedPast30Days: scoreData.survived30Days,
      avgPeakMcap: scoreData.avgPeakMcap,
      previousTokens: previousTokens.map(t => ({
        ca: t.ca,
        name: t.name,
        symbol: t.symbol,
        currentMcap: t.currentMcap,
        peakMcap: t.peakMcap,
        volume24h: t.volume24h,
        liquidity: t.liquidity,
        status: t.status,
        daysOld: t.daysOld,
        priceUsd: t.priceUsd
      }))
    },
    deployerScore: scoreData.score,
    timestamp: new Date().toISOString()
  };
  
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tokenCA = process.argv[2];
  
  if (!tokenCA) {
    console.error('Usage: node deployer-scanner.js <TOKEN_CONTRACT_ADDRESS>');
    console.error('Env: ROUTESCAN_API_KEY');
    process.exit(1);
  }
  
  scanDeployer(tokenCA)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error(`\nERROR: ${error.message}`);
      process.exit(1);
    });
}

export { scanDeployer };
