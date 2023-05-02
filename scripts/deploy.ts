import { ethers } from "hardhat";
import {GameTokens, CardBattle } from '../typechain-types';

async function main() {
  
  const GameTokensFactory = await ethers.getContractFactory("GameTokens");
  const gameTokens = (await GameTokensFactory.deploy()) as GameTokens;
  await gameTokens.deployed();

  const tokensArr = [
          [0, 0],
          [8, 2],
          [7, 3],
          [7, 3],
          [6, 4],
          [6, 4],
          [5, 5],
          [5, 5],
          [1, 0],
          [0, 1],
        ];

  const CardBattleFactory = await ethers.getContractFactory("CardBattle");
  const cardBattle = (await CardBattleFactory.deploy(tokensArr, gameTokens.address)) as CardBattle;
  await cardBattle.deployed();
      
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

