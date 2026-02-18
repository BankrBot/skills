#!/usr/bin/env node

import { ethers } from 'ethers';

const AAVEGOTCHI_CONTRACT = '0xa99c4b08201f2913db8d28e71d020c4298f29dbf';
const BASE_RPC = 'https://mainnet.base.org';

const AAVEGOTCHI_ABI = [
  'function getAavegotchi(uint256 _tokenId) view returns (tuple(uint256 tokenId, string name, address owner, uint256 randomNumber, uint256 status, int16[6] numericTraits, int16[6] modifiedNumericTraits, uint16[16] equippedWearables, address collateral, address escrow, uint256 stakedAmount, uint256 minimumStake, uint256 kinship, uint256 lastInteracted, uint256 experience, uint256 toNextLevel, uint256 usedSkillPoints, uint256 level, uint256 hauntId, uint256 baseRarityScore, uint256 modifiedRarityScore, bool locked))',
  'function tokenByIndex(uint256 _index) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

async function testNames() {
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const contract = new ethers.Contract(AAVEGOTCHI_CONTRACT, AAVEGOTCHI_ABI, provider);

  console.log('Checking first 200 gotchis for named ones...\n');

  for (let i = 0; i < 200; i++) {
    try {
      const tokenId = await contract.tokenByIndex(i);
      const gotchi = await contract.getAavegotchi(tokenId);
      
      if (gotchi.name && gotchi.name.length > 0) {
        console.log(`Index ${i} => Token ID ${tokenId}: "${gotchi.name}" (length: ${gotchi.name.length}, bytes: ${Buffer.from(gotchi.name).toString('hex')})`);
      }
    } catch (e) {
      // Skip errors
    }
  }
}

testNames();
