const { ethers } = require('ethers');

// Aavegotchi Diamond on Base
const DIAMOND_ADDRESS = '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF';
const RPC_URL = process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';

const ABI = [
  'function getAavegotchi(uint256 _tokenId) external view returns (tuple(uint256 tokenId, string name, address owner, uint256 randomNumber, uint256 status, int16[6] numericTraits, int16[6] modifiedNumericTraits, uint16[16] equippedWearables, address collateral, address escrow, uint256 stakedAmount, uint256 minimumStake, uint256 kinship, uint256 lastInteracted, uint256 experience, uint256 toNextLevel, uint256 usedSkillPoints, uint256 level, uint256 hauntId, uint256 baseRarityScore, uint256 modifiedRarityScore, bool locked))'
];

const MAX_GOTCHI_ID = 25000; // Approximate max gotchi ID on Base

async function findGotchiByName(searchName) {
  console.log(`\n🔍 Searching for Gotchi: "${searchName}"`);
  console.log('⏳ This may take 30-60 seconds (scanning all gotchis on-chain)...\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(DIAMOND_ADDRESS, ABI, provider);
    
    console.log(`📊 Scanning gotchis 1-${MAX_GOTCHI_ID.toLocaleString()}`);
    console.log(`🔎 Searching for name: "${searchName}" (case-insensitive)\n`);
    
    const searchLower = searchName.toLowerCase().trim();
    const batchSize = 100;
    let found = null;
    
    // Scan sequential IDs in batches
    for (let i = 1; i <= MAX_GOTCHI_ID; i += batchSize) {
      const end = Math.min(i + batchSize - 1, MAX_GOTCHI_ID);
      const percent = ((end / MAX_GOTCHI_ID) * 100).toFixed(1);
      process.stdout.write(`\r⏳ Progress: ${end.toLocaleString()}/${MAX_GOTCHI_ID.toLocaleString()} (${percent}%)`);
      
      // Fetch batch
      const promises = [];
      for (let tokenId = i; tokenId <= end; tokenId++) {
        promises.push(
          contract.getAavegotchi(tokenId)
            .then(gotchi => ({
              tokenId: gotchi.tokenId.toString(),
              name: gotchi.name,
              status: Number(gotchi.status)
            }))
            .catch(() => null) // Gotchi doesn't exist
        );
      }
      
      const results = await Promise.all(promises);
      
      // Check for name match
      for (const gotchi of results) {
        if (!gotchi) continue;
        if (gotchi.status < 2) continue; // Skip portals
        
        const gotchiName = (gotchi.name || '').toLowerCase().trim();
        if (gotchiName === searchLower) {
          found = gotchi;
          break;
        }
      }
      
      if (found) break;
    }
    
    console.log('\n');
    
    if (found) {
      console.log(`✅ Found: Gotchi #${found.tokenId} "${found.name}"\n`);
      return found.tokenId;
    } else {
      console.log(`❌ No gotchi found with name: "${searchName}"`);
      console.log(`\nTips:`);
      console.log(`  • Check spelling (search is case-insensitive)`);
      console.log(`  • Some gotchis may be unnamed`);
      console.log(`  • Only searches live gotchis (status 2+)`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error searching for gotchi:`, error.message);
    throw error;
  }
}

// Main
async function main() {
  const searchName = process.argv[2];
  
  if (!searchName) {
    console.log('Usage: node find-by-name.js "<gotchi-name>"');
    console.log('Example: node find-by-name.js "aaigotchi"');
    process.exit(1);
  }
  
  const tokenId = await findGotchiByName(searchName);
  
  if (tokenId) {
    // Output just the ID for piping to other scripts
    console.log(tokenId);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { findGotchiByName };
