#!/usr/bin/env node
const https = require('https');

const TOKEN_MAP = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'GHST': 'aavegotchi',
  'MATIC': 'matic-network', 'USDC': 'usd-coin', 'USDT': 'tether',
  'DAI': 'dai', 'WETH': 'weth', 'UNI': 'uniswap', 'AAVE': 'aave',
  'LINK': 'chainlink', 'SOL': 'solana', 'AXS': 'axie-infinity',
  'MANA': 'decentraland', 'SAND': 'the-sandbox', 'APE': 'apecoin',
};

function parseTimestamp(input) {
  if (!isNaN(input)) return new Date(parseInt(input) * 1000);

  // Try to parse DD-MM-YYYY format
  const ddmmyyyyMatch = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback to Date constructor for other formats
  const date = new Date(input);
  if (isNaN(date.getTime())) throw new Error('Invalid timestamp: ' + input);
  return date;
}

function formatDate(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return day + '-' + month + '-' + year;
}

async function fetchPrice(tokenId, date) {
  const dateStr = formatDate(date);
  const url = 'https://api.coingecko.com/api/v3/coins/' + tokenId + '/history?date=' + dateStr;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.market_data && json.market_data.current_price) {
            resolve({
              name: json.name,
              symbol: json.symbol.toUpperCase(),
              price: json.market_data.current_price.usd,
              timestamp: date.toISOString()
            });
          } else {
            reject(new Error('No price data for ' + tokenId + ' on ' + dateStr));
          }
        } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node get-price.js <TOKEN> <TIMESTAMP>');
    console.error('Example: node get-price.js ETH 1704067200');
    process.exit(1);
  }
  
  const tokenInput = args[0].toUpperCase();
  const timestampInput = args.slice(1).join(' ');
  
  try {
    const tokenId = TOKEN_MAP[tokenInput] || tokenInput.toLowerCase();
    const date = parseTimestamp(timestampInput);
    console.log('Fetching ' + tokenInput + ' price at ' + date.toISOString() + '...');
    const result = await fetchPrice(tokenId, date);
    console.log('');
    console.log(result.name + ' (' + result.symbol + ')');
    console.log('Date: ' + result.timestamp);
    console.log('Price: $' + result.price.toFixed(6) + ' USD');
  } catch (error) {
    console.error('Error: ' + error.message);
    process.exit(1);
  }
}

main();
