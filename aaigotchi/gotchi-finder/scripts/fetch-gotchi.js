const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Aavegotchi Diamond on Base
const DIAMOND_ADDRESS = '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF';
const RPC_URL = process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';

const ABI = [
  'function getAavegotchiSvg(uint256 _tokenId) external view returns (string memory)',
  'function getAavegotchi(uint256 _tokenId) external view returns (tuple(uint256 tokenId, string name, address owner, uint256 randomNumber, uint256 status, int16[6] numericTraits, int16[6] modifiedNumericTraits, uint16[16] equippedWearables, address collateral, address escrow, uint256 stakedAmount, uint256 minimumStake, uint256 kinship, uint256 lastInteracted, uint256 experience, uint256 toNextLevel, uint256 usedSkillPoints, uint256 level, uint256 hauntId, uint256 baseRarityScore, uint256 modifiedRarityScore, bool locked))'
];

const STATUS_NAMES = {
  0: 'Portal (Unopened)',
  1: 'Portal (Opened)',
  2: 'Gotchi',
  3: 'Gotchi'
};

async function fetchGotchi(tokenId, outputDir = '.') {
  console.log(`\n👻 Fetching Gotchi #${tokenId}...\n`);
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(DIAMOND_ADDRESS, ABI, provider);
    
    // Get gotchi data
    const gotchiData = await contract.getAavegotchi(tokenId);
    const status = Number(gotchiData.status);
    const statusName = STATUS_NAMES[status] || `Unknown (${status})`;
    
    const result = {
      tokenId: tokenId.toString(),
      name: gotchiData.name || 'Unnamed',
      owner: gotchiData.owner,
      status: status,
      statusName: statusName,
      hauntId: gotchiData.hauntId.toString(),
      isGotchi: status >= 2
    };
    
    console.log(`📊 Status: ${status} - ${statusName}`);
    console.log(`📛 Name: ${result.name}`);
    console.log(`👤 Owner: ${result.owner}`);
    console.log(`🏰 Haunt: ${result.hauntId}`);
    
    if (result.isGotchi) {
      result.brs = gotchiData.baseRarityScore.toString();
      result.kinship = gotchiData.kinship.toString();
      result.level = gotchiData.level.toString();
      result.experience = gotchiData.experience.toString();
      result.modifiedBrs = gotchiData.modifiedRarityScore.toString();
      result.collateral = gotchiData.collateral;
      result.stakedAmount = ethers.formatEther(gotchiData.stakedAmount);
      result.locked = gotchiData.locked;
      
      // Numeric traits (Energy, Aggression, Spookiness, Brain Size, Eye Shape, Eye Color)
      result.traits = {
        energy: gotchiData.numericTraits[0].toString(),
        aggression: gotchiData.numericTraits[1].toString(),
        spookiness: gotchiData.numericTraits[2].toString(),
        brainSize: gotchiData.numericTraits[3].toString(),
        eyeShape: gotchiData.numericTraits[4].toString(),
        eyeColor: gotchiData.numericTraits[5].toString()
      };
      
      console.log(`📛 Name: ${result.name}`);
      console.log(`⭐ BRS: ${result.brs} (Modified: ${result.modifiedBrs})`);
      console.log(`💜 Kinship: ${result.kinship}`);
      console.log(`🎯 Level: ${result.level}`);
      console.log(`✨ XP: ${result.experience}`);
      console.log(`🔒 Locked: ${result.locked ? 'Yes' : 'No'}`);
      console.log(`\n🎭 Traits:`);
      console.log(`   Energy: ${result.traits.energy}`);
      console.log(`   Aggression: ${result.traits.aggression}`);
      console.log(`   Spookiness: ${result.traits.spookiness}`);
      console.log(`   Brain Size: ${result.traits.brainSize}`);
      console.log(`   Eye Shape: ${result.traits.eyeShape}`);
      console.log(`   Eye Color: ${result.traits.eyeColor}`);
    }
    
    // Fetch SVG
    console.log(`\n📥 Fetching SVG...`);
    const svg = await contract.getAavegotchiSvg(tokenId);
    
    // Determine image type
    let imageType = 'Unknown';
    if (svg.includes('gotchi-body') || svg.includes('gotchi-wearable')) {
      imageType = '👻 Gotchi';
    } else if (svg.includes('Portal')) {
      imageType = '🌀 Portal';
    } else if (svg.includes('Sacrificed')) {
      imageType = '💀 Sacrificed';
    }
    
    result.imageType = imageType;
    result.svgSize = svg.length;
    
    console.log(`🎨 Image Type: ${imageType}`);
    console.log(`📏 SVG Size: ${(svg.length / 1024).toFixed(2)} KB`);
    
    // Save SVG
    const svgFilename = path.join(outputDir, `gotchi-${tokenId}.svg`);
    fs.writeFileSync(svgFilename, svg);
    result.svgPath = svgFilename;
    console.log(`💾 Saved SVG: ${svgFilename}`);
    
    // Save JSON metadata
    const jsonFilename = path.join(outputDir, `gotchi-${tokenId}.json`);
    fs.writeFileSync(jsonFilename, JSON.stringify(result, null, 2));
    result.jsonPath = jsonFilename;
    console.log(`💾 Saved JSON: ${jsonFilename}`);
    
    console.log('\n' + '═'.repeat(70));
    console.log(`✅ Gotchi #${tokenId} "${result.name}" fetched successfully!`);
    console.log('═'.repeat(70));
    
    return result;
    
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.error(`❌ Gotchi #${tokenId} does not exist on Base chain`);
    } else if (error.message.includes('rate limit')) {
      console.error(`❌ RPC rate limit hit - try again in a few seconds`);
    } else {
      console.error(`❌ Error:`, error.message);
    }
    throw error;
  }
}

// Main
async function main() {
  const tokenId = process.argv[2];
  const outputDir = process.argv[3] || '.';
  
  if (!tokenId) {
    console.log('Usage: node fetch-gotchi.js <tokenId> [outputDir]');
    console.log('Example: node fetch-gotchi.js 9638 /tmp/gotchis');
    process.exit(1);
  }
  
  await fetchGotchi(tokenId, outputDir);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchGotchi };
