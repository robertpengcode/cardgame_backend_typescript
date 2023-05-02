import { expect } from "chai";
import { ethers, network } from "hardhat";

const { developmentChains } = require("../helper-hardhat-config");

import {GameTokens, CardBattle } from '../typechain-types';

import { Signer, BigNumber } from "ethers";

!developmentChains.includes(network.name)
  ? describe.skip : 
  describe("CardBattle", function () {
      let owner: Signer,
        player1: Signer,
        player2: Signer,
        player3: Signer,
        player4: Signer,
        cardBattle: CardBattle,
        gameTokens: GameTokens,
        player1_characterId: BigNumber | Promise< BigNumber >,
        player2_characterId: BigNumber | Promise< BigNumber >,
        player3_characterId: BigNumber | Promise< BigNumber >
      const characterPrice: BigNumber | Promise< BigNumber > = ethers.utils.parseEther("0.001");
      const treasurePrice: number = 0.0002;
      before(async () => {
        [owner, player1, player2, player3, player4] = await ethers.getSigners();

        const GameTokensFactory = await ethers.getContractFactory("GameTokens");
        gameTokens = (await GameTokensFactory.deploy()) as GameTokens;
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

        const CardBattle = await ethers.getContractFactory("CardBattle");
        cardBattle = (await CardBattle.deploy(tokensArr, gameTokens.address)) as CardBattle;
        await cardBattle.deployed();
      });

      describe("Deployment", function () {
        it("Should set the right owner", async () => {
          expect(await gameTokens.owner()).to.equal(await owner.getAddress());
          expect(await cardBattle.owner()).to.equal(await owner.getAddress());
        });

        it("Should set tokens in the game", async () => {
          expect((await cardBattle.getToken(1)).attack).to.equal(8);
        });

        it("Should set game token contract address", async () => {
          expect(await cardBattle.gameTokensContract()).to.equal(
            gameTokens.address
          );
        });
      });

      describe("Register Player", function () {
        it("Should register player - event RegisteredPlayer", async () => {
          await expect(cardBattle.connect(player1).registerPlayer()).to.emit(
            cardBattle,
            "RegisteredPlayer"
          );
        });
        it("Should be in players mapping", async () => {
          expect(
            (await cardBattle.getPlayer(player1.getAddress())).playerAddr
          ).to.equal(await player1.getAddress());
        });
        it("Should not register player - registered already", async () => {
          await expect(
            cardBattle.connect(player1).registerPlayer()
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__IsPlayerAlready"
          );
        });
        it("Should register player2 - event RegisteredPlayer", async () => {
          await expect(cardBattle.connect(player2).registerPlayer()).to.emit(
            cardBattle,
            "RegisteredPlayer"
          );
        });
      });

      describe("Mint Character", function () {
        it("Should not mint character - not player", async () => {
          await expect(
            cardBattle.connect(player3).mintCharacter({ value: characterPrice })
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });
        it("Should not mint character - wrong value", async () => {
          await expect(
            cardBattle.connect(player1).mintCharacter({ value: 0 })
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__SentWrongValue"
          );
        });
        it("Should mint character - event MintedCharacter", async () => {
          await expect(
            cardBattle.connect(player1).mintCharacter({ value: characterPrice })
          ).to.emit(cardBattle, "MintedCharacter");
        });

        it("Should update player's token balance", async () => {
          player1_characterId = await cardBattle.getLastMintedChar();
          expect(
            (
              await gameTokens.balanceOf(player1.getAddress(), player1_characterId)
            ).toString()
          ).to.equal("1");
          expect(
            (
              await cardBattle.getOwnedTokenAmount(
                player1.getAddress(),
                player1_characterId
              )
            ).toString()
          ).to.equal("1");
        });

        it("Should update ETH balances", async () => {
          await expect(
            cardBattle.connect(player2).mintCharacter({ value: characterPrice })
          ).to.changeEtherBalances(
            [cardBattle.address, (await player2.getAddress())],
            [characterPrice, -characterPrice]
          );
        });
      });

      describe("Mint Treasure", function () {
        const mintAmount = 1;
        const treasureId = 8;
        it("Should not mint treasure - not player", async () => {
          await expect(
            cardBattle.connect(player3).mintTreasure(treasureId, mintAmount, {
              value: ethers.utils.parseEther((treasurePrice * mintAmount).toString())
            })
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });

        it("Should not mint treasure - wrong value", async () => {
          await expect(
            cardBattle.connect(player1).mintTreasure(treasureId, mintAmount, {
              value: 0,
            })
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__SentWrongValue"
          );
        });

        it("Should mint treasure - event MintedTreasure", async () => {
          await expect(
            cardBattle.connect(player1).mintTreasure(treasureId, mintAmount, {
              value: ethers.utils.parseEther((treasurePrice * mintAmount).toString())
            })
          ).to.emit(cardBattle, "MintedTreasure");
        });

        it("Should update ETH balance", async () => {
          await expect(
            cardBattle.connect(player1).mintTreasure(treasureId, mintAmount, {
              value: ethers.utils.parseEther((treasurePrice * mintAmount).toString())
            })
          ).to.changeEtherBalances(
            [cardBattle.address, await player1.getAddress()],
            [ethers.utils.parseEther((treasurePrice * mintAmount).toString()),
               -ethers.utils.parseEther((treasurePrice * mintAmount).toString())]
          );
        });

        it("Should update player's token balance", async () => {
          expect(
            (await gameTokens.balanceOf(player1.getAddress(), treasureId)).toString()
          ).to.equal("2");
          expect(
            (
              await cardBattle.getOwnedTokenAmount(player1.getAddress(), treasureId)
            ).toString()
          ).to.equal("2");
        });
      });

      describe("Pick Character", function () {
        let anotherId: number;
        before(async () => {
          anotherId =
            Number((player1_characterId).toString()) - 1 === 0
              ? Number((player1_characterId).toString()) + 1
              : Number((player1_characterId).toString()) - 1;
          player2_characterId = await cardBattle.getLastMintedChar();
        });

        it("Should not pick Character - not player", async () => {
          await expect(
            cardBattle.connect(player3).pickCharacter(player1_characterId)
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });

        it("Should pick character - event PickedCharacter", async () => {
          await expect(
            cardBattle.connect(player1).pickCharacter(player1_characterId)
          ).to.emit(cardBattle, "PickedCharacter");
        });

        it("Should not pick Character - no balance", async () => {
          await expect(
            cardBattle.connect(player1).pickCharacter(BigInt(anotherId))
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__OwnNoCharacter"
          );
        });

        it("Should update player info", async () => {
          expect(
            (await cardBattle.getPlayer(player1.getAddress())).battleTokens[0]
          ).to.be.equal(player1_characterId);
        });

        it("Should pick character (player2) - event PickedCharacter", async () => {
          await expect(
            cardBattle.connect(player2).pickCharacter(player2_characterId)
          ).to.emit(cardBattle, "PickedCharacter");
        });
      });

      describe("Use Berserk", function () {
        const tokenId = 8;
        it("Should not use Berserk - not player", async () => {
          await expect(
            cardBattle.connect(player3).useBerserk()
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });

        it("Should not use Berserk - no balance", async () => {
          await expect(
            cardBattle.connect(player2).useBerserk()
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__OwnNoSuchTreasure"
          );
        });

        it("Should use Berserk - event UsedBerserk", async () => {
          await expect(cardBattle.connect(player1).useBerserk()).to.emit(
            cardBattle,
            "UsedBerserk"
          );
        });

        it("Should update player info", async () => {
          expect(
            (await cardBattle.getPlayer(player1.getAddress())).battleTokens[1]
          ).to.be.equal(tokenId);
        });
      });

      describe("Use ForceShield", function () {
        const tokenId = 9;
        const mintAmount = 2;
        before(async () => {
          await cardBattle.connect(player2).mintTreasure(tokenId, mintAmount, {
            value: ethers.utils.parseEther((treasurePrice * mintAmount).toString())
          });
        });

        it("Should not use ForceShield - not player", async () => {
          await expect(
            cardBattle.connect(player3).useForceShield()
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });

        it("Should not use ForceShield - no balance", async () => {
          await expect(
            cardBattle.connect(player1).useForceShield()
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__OwnNoSuchTreasure"
          );
        });

        it("Should use ForceShield - event UsedForceShield", async () => {
          await expect(cardBattle.connect(player2).useForceShield()).to.emit(
            cardBattle,
            "UsedForceShield"
          );
        });

        it("Should update player info", async () => {
          expect(
            (await cardBattle.getPlayer(player2.getAddress())).battleTokens[2]
          ).to.be.equal(tokenId);
        });
      });

      describe("Play Game", function () {
        it("Should not play - not player", async () => {
          await expect(
            cardBattle.connect(player3).playGame()
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });
        it("Should play (initiate battle) - event StartedBattle", async () => {
          await expect(cardBattle.connect(player1).playGame()).to.emit(
            cardBattle,
            "StartedBattle"
          );
        });
        it("Should set up battleId & nextBattleId", async () => {
          expect(await cardBattle.getNextBattleId()).to.equal(2);
        });
        it("Should set up waitingBattleId", async () => {
          expect(await cardBattle.getWaitingBattleId()).to.equal(1);
        });
        it("Should set up player1's attack", async () => {
          //Berserk: +1
          const player1_attack =
            (await cardBattle.getToken(player1_characterId)).attack + 1;
          expect(
            (await cardBattle.getPlayer(player1.getAddress())).battleAttack
          ).to.equal(player1_attack);
        });
        it("Should not play - in game already", async () => {
          await expect(
            cardBattle.connect(player1).playGame()
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__InBattleAlready"
          );
        });
        it("Should play (join battle) - event StartedBattle", async () => {
          await expect(cardBattle.connect(player2).playGame()).to.emit(
            cardBattle,
            "StartedBattle"
          );
        });
        it("Should set up player2's defense", async () => {
          //ForceShield: +1
          const player2_defense =
            (await cardBattle.getToken(player2_characterId)).defense + 1;
          expect(
            (await cardBattle.getPlayer(player2.getAddress())).battleDefense
          ).to.equal(player2_defense);
        });
        it("Should set up players in the battle", async () => {
          expect((await cardBattle.getBattle(1)).playerAddrs[0]).to.equal(
            await player1.getAddress()
          );
          expect((await cardBattle.getBattle(1)).playerAddrs[1]).to.equal(
            await player2.getAddress()
          );
        });
        it("Should update battle status", async () => {
          expect(await cardBattle.getBattleStatus(1)).to.equal(1);
        });
        it("Should reset waitingBattleId", async () => {
          expect(await cardBattle.getWaitingBattleId()).to.equal(0);
        });
        it("Should not play (initiate battle) - Require Character To Play", async () => {
          await cardBattle.connect(player3).registerPlayer();
          await expect(
            cardBattle.connect(player3).playGame()
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__RequireCharacterToPlay"
          );
        });
      });

      describe("Make move", () => {
        it("Should not make move - not player", async () => {
          await expect(
            cardBattle.connect(player4).makeMove(1, 1)
          ).to.be.revertedWithCustomError(cardBattle, "CardBattle__NotPlayer");
        });
        it("Should not make move - not in battle", async () => {
          await expect(
            cardBattle.connect(player3).makeMove(1, 1)
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__NotInBattle"
          );
        });
        it("Should not make move - not in this battle", async () => {
          await cardBattle
            .connect(player3)
            .mintCharacter({ value: characterPrice });
          player3_characterId = await cardBattle.getLastMintedChar();
          await cardBattle.connect(player3).pickCharacter(player3_characterId);
          await cardBattle.connect(player3).playGame();
          await expect(
            cardBattle.connect(player3).makeMove(1, 1)
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__NotInThisBattle"
          );
        });
        it("Should not make move - choice cannot be No", async () => {
          await expect(
            cardBattle.connect(player1).makeMove(1, 0)
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__CannotChoiceNo"
          );
        });
        it("Should make move - event MadeMove", async () => {
          await expect(cardBattle.connect(player1).makeMove(1, 1)).to.emit(
            cardBattle,
            "MadeMove"
          );
        });
        it("Should not make move - made move already", async () => {
          await expect(
            cardBattle.connect(player1).makeMove(1, 2)
          ).to.be.revertedWithCustomError(
            cardBattle,
            "CardBattle__MadeMoveAlready"
          );
        });
        it("Player2 make move should trigger updateGame", async () => {
          await cardBattle.connect(player2).makeMove(1, 1);
          expect((await cardBattle.getBattle(1)).moves[1]).to.emit(
            cardBattle,
            "UpdatedGame"
          );
        });

        //test moves [1,1]
        it("Should update players' data - moves: [1,1]", async () => {
          const player_1 = await cardBattle.getPlayer(player1.getAddress());
          const player_2 = await cardBattle.getPlayer(player2.getAddress());
          expect(player_1.health).to.equal(10 - player_2.battleAttack);
          expect(player_2.health).to.equal(10 - player_1.battleAttack);
        });

        //test moves [1,2]
        it("Should update players' data - moves: [1,2]", async () => {
          let player_1 = await cardBattle.getPlayer(player1.getAddress());
          let player_2 = await cardBattle.getPlayer(player2.getAddress());
          const player_1_health_before = player_1.health;
          const player_2_health_before = player_2.health;
          const player_1_energy_before = player_1.energy;
          const player_2_energy_before = player_2.energy;
          await cardBattle.connect(player1).makeMove(1, 1);
          await cardBattle.connect(player2).makeMove(1, 2);
          player_1 = await cardBattle.getPlayer(player1.getAddress());
          player_2 = await cardBattle.getPlayer(player2.getAddress());
          const player_1_health_after = player_1.health;
          const player_2_health_after = player_2.health;
          // console.log("P1_Before", player_1_health_before);
          // console.log("P2_Before", player_2_health_before);
          // console.log("P1_After", player_1_health_after);
          // console.log("P2_After", player_2_health_after);
          expect(player_1.health).to.equal(player_1_health_before);
          expect(player_2.health).to.equal(
            player_2_health_before -
              player_1.battleAttack +
              player_2.battleDefense
          );
          expect(player_1.energy).to.equal(player_1_energy_before - 2);
          expect(player_2.energy).to.equal(player_2_energy_before - 2);
          const winner = (await cardBattle.getBattle(1)).winner;
          //console.log("winner", winner);
          if (player_1.health > 0 && player_2.health <= 0) {
            expect(winner).to.equal(player1.getAddress());
          } else if (player_1.health <= 0 && player_2.health > 0) {
            expect(winner).to.equal(player2.getAddress());
          } else if (player_1.health <= 0 && player_2.health <= 0) {
            expect(winner.slice(0, 7)).to.equal(0x00000);
          }
        });

        //test move [2,1]
        it("Should update players' data - moves: [2,1]", async () => {
          let player_1 = await cardBattle.getPlayer(player1.getAddress());
          let player_2 = await cardBattle.getPlayer(player2.getAddress());
          const player_1_health_before = player_1.health;
          const player_2_health_before = player_2.health;
          const player_1_energy_before = player_1.energy;
          const player_2_energy_before = player_2.energy;
          await cardBattle.connect(player1).makeMove(1, 2);
          await cardBattle.connect(player2).makeMove(1, 1);
          player_1 = await cardBattle.getPlayer(player1.getAddress());
          player_2 = await cardBattle.getPlayer(player2.getAddress());
          const player_1_health_after = player_1.health;
          const player_2_health_after = player_2.health;
          // console.log("P1_Before", player_1_health_before);
          // console.log("P2_Before", player_2_health_before);
          // console.log("P1_After", player_1_health_after);
          // console.log("P2_After", player_2_health_after);
          expect(player_1.health).to.equal(
            player_1_health_before -
              player_2.battleAttack +
              player_1.battleDefense
          );
          expect(player_2.health).to.equal(player_2_health_before);
          expect(player_1.energy).to.equal(player_1_energy_before - 2);
          expect(player_2.energy).to.equal(player_2_energy_before - 2);
          const winner = (await cardBattle.getBattle(1)).winner;
          //console.log("winner", winner);
          if (player_1.health > 0 && player_2.health <= 0) {
            expect(winner).to.equal(player1.getAddress());
          } else if (player_1.health <= 0 && player_2.health > 0) {
            expect(winner).to.equal(player2.getAddress());
          } else if (player_1.health <= 0 && player_2.health <= 0) {
            expect(winner.slice(0, 7)).to.equal(0x00000);
          }
        });

        //test move [2,2]
        it("Should update players' data - moves: [2,2]", async () => {
          let player_1 = await cardBattle.getPlayer(player1.getAddress());
          let player_2 = await cardBattle.getPlayer(player2.getAddress());
          const player_1_health_before = player_1.health;
          const player_2_health_before = player_2.health;
          const player_1_energy_before = player_1.energy;
          const player_2_energy_before = player_2.energy;
          await cardBattle.connect(player1).makeMove(1, 2);
          await cardBattle.connect(player2).makeMove(1, 2);
          player_1 = await cardBattle.getPlayer(player1.getAddress());
          player_2 = await cardBattle.getPlayer(player2.getAddress());
          const player_1_health_after = player_1.health;
          const player_2_health_after = player_2.health;
          // console.log("P1_Before", player_1_health_before);
          // console.log("P2_Before", player_2_health_before);
          // console.log("P1_After", player_1_health_after);
          // console.log("P2_After", player_2_health_after);
          expect(player_1.health).to.equal(player_1_health_before);
          expect(player_2.health).to.equal(player_2_health_before);
          expect(player_1.energy).to.equal(player_1_energy_before - 2);
          expect(player_2.energy).to.equal(player_2_energy_before - 2);
          const winner = (await cardBattle.getBattle(1)).winner;
          //console.log("winner", winner);
          if (player_1.health > 0 && player_2.health <= 0) {
            expect(winner).to.equal(player1.getAddress());
          } else if (player_1.health <= 0 && player_2.health > 0) {
            expect(winner).to.equal(player2.getAddress());
          } else if (player_1.health <= 0 && player_2.health <= 0) {
            expect(winner.slice(0, 7)).to.equal(0x00000);
          }
        });
      });
    });

