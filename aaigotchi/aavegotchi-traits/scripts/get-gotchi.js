#!/usr/bin/env node

import { ethers } from 'ethers';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load wearables mapping
const wearablesData = JSON.parse(
  readFileSync(join(__dirname, 'wearables-data.json'), 'utf-8')
);

// Aavegotchi contract on Base mainnet
const AAVEGOTCHI_CONTRACT = '0xa99c4b08201f2913db8d28e71d020c4298f29dbf';
const BASE_RPC = 'https://mainnet.base.org';

// Subgraph endpoint (configurable via env var)
// NOTE: As of Feb 2026, there's no official Base subgraph yet
// When available, set: AAVEGOTCHI_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-base
const SUBGRAPH_URL = process.env.AAVEGOTCHI_SUBGRAPH_URL || null;

// Simplified ABI - only the functions we need
const AAVEGOTCHI_ABI = [
  'function getAavegotchi(uint256 _tokenId) view returns (tuple(uint256 tokenId, string name, address owner, uint256 randomNumber, uint256 status, int16[6] numericTraits, int16[6] modifiedNumericTraits, uint16[16] equippedWearables, address collateral, address escrow, uint256 stakedAmount, uint256 minimumStake, uint256 kinship, uint256 lastInteracted, uint256 experience, uint256 toNextLevel, uint256 usedSkillPoints, uint256 level, uint256 hauntId, uint256 baseRarityScore, uint256 modifiedRarityScore, bool locked))',
  'function tokenIdsOfOwner(address _owner) view returns (uint32[])',
  'function ownerOf(uint256 _tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 _index) view returns (uint256)'
];

// ERC20 ABI for querying token decimals
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// Trait names for numericTraits array
const TRAIT_NAMES = [
  'Energy',
  'Aggression', 
  'Spookiness',
  'Brain Size',
  'Eye Shape',
  'Eye Color'
];

// Trait emojis
const TRAIT_EMOJIS = {
  'Energy': '⚡',
  'Aggression': '💥',
  'Spookiness': '👻',
  'Brain Size': '🧠',
  'Eye Shape': '👁️',
  'Eye Color': '🎨'
};

/**
 * Query The Graph subgraph for gotchi by name (instant, case-insensitive)
 * Returns gotchi ID if found, null otherwise
 */
async function querySubgraphByName(name) {
  if (!SUBGRAPH_URL) {
    return null; // No subgraph configured
  }

  // Use lowercase for case-insensitive search
  const nameLower = name.toLowerCase();
  
  const query = `
    query GetGotchiByName($name: String!) {
      aavegotchis(where: { name_contains_nocase: $name }, first: 1) {
        id
        tokenId: id
        name
      }
    }
  `;

  try {
    console.log(`Querying subgraph for "${name}" (case-insensitive)...`);
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { name: nameLower }
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.log('Subgraph query failed:', result.errors[0].message);
      return null;
    }

    if (result.data?.aavegotchis?.length > 0) {
      const gotchiId = result.data.aavegotchis[0].tokenId;
      console.log(`✓ Found via subgraph: Gotchi #${gotchiId}`);
      return gotchiId;
    }

    return null;
  } catch (error) {
    console.log('Subgraph unavailable, falling back to on-chain search...');
    return null;
  }
}

async function searchGotchiByName(contract, searchName) {
  console.log(`Searching for Gotchi with name: "${searchName}" (case-insensitive)...`);
  
  try {
    // Get total supply
    const totalSupply = await contract.totalSupply();
    const total = Number(totalSupply);
    console.log(`Scanning ${total} gotchis (this may take 30-60 seconds)...`);
    
    // Search in larger batches with parallel processing
    const batchSize = 100;
    const searchLower = searchName.toLowerCase();
    let checked = 0;
    
    for (let i = 0; i < total; i += batchSize) {
      const end = Math.min(i + batchSize, total);
      
      // Query batch
      const promises = [];
      for (let j = i; j < end; j++) {
        promises.push(
          contract.tokenByIndex(j)
            .then(tokenId => contract.getAavegotchi(tokenId))
            .catch(() => null) // Skip invalid tokens
        );
      }
      
      const results = await Promise.all(promises);
      checked += results.length;
      
      // Progress update every 500 gotchis
      if (checked % 500 === 0 || checked === total) {
        console.log(`Progress: ${checked}/${total} (${Math.round(checked/total*100)}%)`);
      }
      
      // Check for name match (case-insensitive)
      for (const gotchi of results) {
        if (gotchi && gotchi.name && gotchi.name.toLowerCase() === searchLower) {
          console.log(`\nFound! Gotchi #${gotchi.tokenId}: ${gotchi.name}\n`);
          return gotchi; // Return full gotchi object to avoid redundant RPC call
        }
      }
    }
    
    console.error(`\nNo gotchi found with name "${searchName}"`);
    return null;
  } catch (error) {
    console.error('Error searching for gotchi:', error.message);
    return null;
  }
}

/**
 * Get token decimals from collateral contract
 */
async function getTokenDecimals(provider, tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await tokenContract.decimals();
    return Number(decimals);
  } catch (error) {
    console.log(`Warning: Could not fetch decimals for ${tokenAddress}, assuming 18`);
    return 18; // Default fallback
  }
}

async function getGotchiInfo(identifier) {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const contract = new ethers.Contract(AAVEGOTCHI_CONTRACT, AAVEGOTCHI_ABI, provider);

    let gotchi = null;
    let tokenId = null;
    
    // Check if identifier is a number (gotchi ID)
    if (/^\d+$/.test(identifier)) {
      tokenId = identifier;
    } else {
      // Search by name - try subgraph first (instant), fallback to on-chain scan
      tokenId = await querySubgraphByName(identifier);
      
      if (!tokenId) {
        console.log('Subgraph not available or gotchi not found. Falling back to on-chain search...');
        gotchi = await searchGotchiByName(contract, identifier);
        
        if (!gotchi) {
          process.exit(1);
        }
        // gotchi is already the full object, no need to fetch again
      }
    }

    // Fetch gotchi data only if we don't have it yet
    if (!gotchi) {
      gotchi = await contract.getAavegotchi(tokenId);
    }
    
    // Query actual token decimals for correct formatting
    const tokenDecimals = await getTokenDecimals(provider, gotchi.collateral);
    const stakedAmountFormatted = ethers.formatUnits(gotchi.stakedAmount, tokenDecimals);
    
    // Parse the response
    const data = {
      tokenId: gotchi.tokenId.toString(),
      name: gotchi.name,
      owner: gotchi.owner,
      status: gotchi.status.toString(),
      hauntId: gotchi.hauntId.toString(),
      level: gotchi.level.toString(),
      kinship: gotchi.kinship.toString(),
      experience: gotchi.experience.toString(),
      baseRarityScore: gotchi.baseRarityScore.toString(),
      modifiedRarityScore: gotchi.modifiedRarityScore.toString(),
      traits: {},
      modifiedTraits: {},
      equippedWearables: [],
      collateral: gotchi.collateral,
      stakedAmount: stakedAmountFormatted,
      lastInteracted: new Date(Number(gotchi.lastInteracted) * 1000).toISOString(),
      age: Math.floor((Date.now() / 1000 - Number(gotchi.lastInteracted)) / 86400) // Days since last interaction
    };

    // Parse traits
    for (let i = 0; i < 6; i++) {
      data.traits[TRAIT_NAMES[i]] = gotchi.numericTraits[i].toString();
      data.modifiedTraits[TRAIT_NAMES[i]] = gotchi.modifiedNumericTraits[i].toString();
    }

    // Parse equipped wearables (filter out zeros)
    data.equippedWearables = gotchi.equippedWearables
      .map(w => w.toString())
      .filter(w => w !== '0');
    
    // Add wearable names
    data.wearableNames = data.equippedWearables.map(id => ({
      id,
      name: wearablesData[id] || 'Unknown Item'
    }));

    // Format output
    console.log('='.repeat(60));
    console.log(`AAVEGOTCHI #${data.tokenId}: ${data.name || '(unnamed)'}`);
    console.log('='.repeat(60));
    console.log(`Owner: ${data.owner}`);
    console.log(`Haunt: ${data.hauntId}`);
    console.log(`Level: ${data.level}`);
    console.log(`Age: ${data.age} days since last interaction`);
    console.log('');
    console.log('SCORES:');
    console.log(`  Base Rarity Score (BRS): ${data.baseRarityScore}`);
    console.log(`  Modified Rarity Score: ${data.modifiedRarityScore}`);
    console.log(`  Kinship: ${data.kinship}`);
    console.log(`  Experience: ${data.experience}`);
    console.log('');
    console.log('TRAITS:');
    for (const [trait, value] of Object.entries(data.traits)) {
      const modified = data.modifiedTraits[trait];
      const modifier = modified !== value ? ` (modified: ${modified})` : '';
      const emoji = TRAIT_EMOJIS[trait] || '';
      console.log(`  ${emoji} ${trait}: ${value}${modifier}`);
    }
    console.log('');
    console.log('WEARABLES:');
    if (data.equippedWearables.length > 0) {
      console.log(`  Equipped (${data.equippedWearables.length}):`);
      for (const wearableId of data.equippedWearables) {
        const name = wearablesData[wearableId] || 'Unknown Item';
        console.log(`    ${wearableId}: ${name}`);
      }
    } else {
      console.log('  None equipped');
    }
    console.log('');
    console.log('STAKING:');
    console.log(`  Collateral: ${data.collateral}`);
    console.log(`  Staked Amount: ${data.stakedAmount} tokens`);
    console.log(`  Last Interacted: ${data.lastInteracted}`);
    console.log('='.repeat(60));

    // Also output JSON for programmatic use
    console.log('\nJSON OUTPUT:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error fetching Aavegotchi data:', error.message);
    if (error.message.includes('invalid token ID')) {
      console.error('This Gotchi ID does not exist on Base.');
    }
    process.exit(1);
  }
}

// Main
const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: node get-gotchi.js <gotchi-id-or-name>');
  console.error('Example: node get-gotchi.js 12345');
  process.exit(1);
}

getGotchiInfo(identifier);
