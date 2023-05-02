// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./GameTokens.sol";

contract CardBattle is ERC1155Holder, Ownable, ReentrancyGuard {
    GameTokens public immutable gameTokensContract;
    
    uint256 public constant characterPrice = 0.001 ether;
    uint256 public constant treasurePrice = 0.0002 ether;
    //ToDo1: players pay ETH or buy game tokens (e.g., Gold) to play in the future
    //ToDo2: set up reward/prize mechanism (e.g., pay Gold) in the future
    //uint256 public constant battlePrice = 0.001 ether;
    //uint256 public constant winnerPrize = 0.0018 ether;
    //battleId starts from 1
    uint256 private nextBattleId = 1;
    //easier to check player's new minted character
    uint256 private lastMintedChar;
    //battles waiting for player to join
    uint256 private waitingBattleId = 0;

    struct Token {
        int8 attack;
        int8 defense;
    }

    struct Player {
        address playerAddr;
        //uint256 battleTimes;
        int8 health;
        int8 energy;
        //[characterId, treasureId1, treasureId2]
        uint256[3] battleTokens;
        int8 battleAttack;
        int8 battleDefense;
        uint8 battleMoveId;
        bool isInBattle;
    }

    struct Battle {
        address[2] playerAddrs;
        address winner;
        BattleStatus battleStatus;
        Choice[2] moves;
    }

    enum BattleStatus {
        PENDING,
        STARTED,
        ENDED
    }

    enum Choice {
        NO,
        ATTACK,
        DEFENSE
    }

    //user address to a Player struct
    mapping(address => Player) private players;
    //user address to tokenId to owned amount
    mapping(address => mapping(uint256 => uint256)) private ownedTokens;
    //battleId to a Battle struct
    mapping(uint256 => Battle) private battles;
    //tokenId to token struct
    mapping(uint256 => Token) private tokens;
    //user address to is in game or not
    //mapping(address => bool) private isInGame;
    //user address to ether balance
    //mapping(address => uint256) private playerBalances;

    event RegisteredPlayer(address indexed player, uint256 time);
    event MintedCharacter(address indexed player, uint256 tokenId, uint256 time);
    event MintedTreasure(address indexed player, uint256 tokenId, uint256 time);
    event PickedCharacter(address indexed player, uint256 tokenId, uint256 time);
    event UsedBerserk(address indexed player, uint256 tokenId, uint256 time);
    event UsedForceShield(address indexed player, uint256 tokenId, uint256 time);
    event StartedBattle(address indexed player1, address indexed player2, uint256 indexed battleId, uint8 playerIdx, uint256 time);
    event MadeMove(uint256 indexed battleId, address indexed player, Choice choice);
    event UpdatedGame(uint256 indexed battleId, address player1, address player2, uint256 time);
    event EndedBattle(uint256 indexed battleId, address indexed winner, uint256 time);
    event WithdrewByOwner(address owner, uint256 balance, uint256 time);

    error CardBattle__IsPlayerAlready();
    error CardBattle__NotPlayer();
    error CardBattle__SentWrongValue();
    //error CardBattle__NeedToBuyBattles();
    error CardBattle__OwnNoCharacter();
    error CardBattle__OwnNoSuchTreasure();
    error CardBattle__RequireCharacterToPlay();
    error CardBattle__InBattleAlready();
    error CardBattle__NotInBattle();
    error CardBattle__NotInThisBattle();
    error CardBattle__StatusNotCorrect();
    error CardBattle__CannotChoiceNo();
    error CardBattle__MadeMoveAlready();
    error CardBattle__SentOwnerFailed();

    modifier isNotPlayer() {
        if(players[msg.sender].playerAddr != address(0)) {
            revert CardBattle__IsPlayerAlready();
        }
        _;
    }

    modifier playerOnly() {
        if(players[msg.sender].playerAddr == address(0)) {
            revert CardBattle__NotPlayer();
        }
        _;
    }

    modifier notInBattle() {
        if(players[msg.sender].isInBattle) {
            revert CardBattle__InBattleAlready();
        }
        _;
    }

    modifier inBattle() {
        if(!players[msg.sender].isInBattle) {
            revert CardBattle__NotInBattle();
        }
        _;
    }

    modifier inThisBattle(uint256 battleId) {
        address player1 = battles[battleId].playerAddrs[0];
        address player2 = battles[battleId].playerAddrs[1];
        if(msg.sender != player1 && msg.sender != player2) {
            revert CardBattle__NotInThisBattle();
        }
        _;
    }

    //tokensArr = [[0, 0],[8, 2],[7, 3],[7, 3],[6, 4],[6, 4],[5, 5],[5, 5],[1, 0],[0, 1]]
    constructor(Token[] memory tokensArr, address gameTokensAddress) {
        _setUpTokens(tokensArr);
        gameTokensContract = GameTokens(gameTokensAddress);
    }

    function _setUpTokens(Token[] memory tokensArr) internal {
        for (uint8 i = 0; i <tokensArr.length; i++) {
            tokens[i].attack = tokensArr[i].attack;
            tokens[i].defense = tokensArr[i].defense;
        }
    }

    function registerPlayer() external isNotPlayer{
        players[msg.sender].playerAddr = msg.sender;
        emit RegisteredPlayer(msg.sender, block.timestamp);
    }

    function mintCharacter() external payable playerOnly nonReentrant{
        if (msg.value != characterPrice) {
            revert CardBattle__SentWrongValue();
        }
        uint256 characterId = _createRandomNum(7, msg.sender);
        gameTokensContract.mint(msg.sender, characterId, 1, "");
        ownedTokens[msg.sender][characterId]++;
        lastMintedChar = characterId;
        emit MintedCharacter(msg.sender, characterId, block.timestamp);
    }

    function mintTreasure(uint256 treasureId, uint256 amount) external payable playerOnly nonReentrant{
        if (msg.value != treasurePrice * amount) {
            revert CardBattle__SentWrongValue();
        }
        gameTokensContract.mint(msg.sender, treasureId, amount, "");
        ownedTokens[msg.sender][treasureId] += amount;
        emit MintedTreasure(msg.sender, treasureId, block.timestamp);
    }

    // function buyBattles(uint256 amount) external payable playerOnly{
    //     if (msg.value != battlePrice * amount) {
    //         revert CardBattle__SentWrongValue();
    //     }
    //     players[msg.sender].battleTimes += amount;
    // }

    function pickCharacter(uint256 characterId) external playerOnly{
        if (ownedTokens[msg.sender][characterId] <= 0){
            revert CardBattle__OwnNoCharacter();
        } 
        players[msg.sender].battleTokens[0] = characterId;
        emit PickedCharacter(msg.sender, characterId, block.timestamp);
    }
    //id for Berserk is 8
    function useBerserk() external playerOnly{
        if (ownedTokens[msg.sender][8] <= 0){
            revert CardBattle__OwnNoSuchTreasure();
        } 
        ownedTokens[msg.sender][8]--;
        gameTokensContract.burn(msg.sender, 8, 1);
        players[msg.sender].battleTokens[1] = 8;
        emit UsedBerserk(msg.sender, 8, block.timestamp);
    }
    //id for Berserk is 9
     function useForceShield() external playerOnly{
        if (ownedTokens[msg.sender][9] <= 0){
            revert CardBattle__OwnNoSuchTreasure();
        } 
        ownedTokens[msg.sender][9]--;
        gameTokensContract.burn(msg.sender, 9, 1);
        players[msg.sender].battleTokens[2] = 9;
        emit UsedForceShield(msg.sender, 9, block.timestamp);
    }

    function playGame() external playerOnly notInBattle{
        // if (players[msg.sender].battleTimes <= 0) {
        //     revert CardBattle__NeedToBuyBattles();
        // }
        //players[msg.sender].battleTimes--;
        uint256 characterId = players[msg.sender].battleTokens[0];
        if (characterId == 0) {
            revert CardBattle__RequireCharacterToPlay();
        }
        uint256 treasureId1 = players[msg.sender].battleTokens[1];
        uint256 treasureId2 = players[msg.sender].battleTokens[2];
        players[msg.sender].battleAttack = tokens[characterId].attack + tokens[treasureId1].attack;
        players[msg.sender].battleDefense = tokens[characterId].defense + tokens[treasureId2].defense;
        players[msg.sender].health = 10;
        players[msg.sender].energy = 10;
        players[msg.sender].isInBattle = true;

        if (waitingBattleId == 0) {
            players[msg.sender].battleMoveId = 0;
            uint256 battleId = nextBattleId;
            nextBattleId++;
            battles[battleId].playerAddrs[0] = msg.sender;
            waitingBattleId = battleId;
            emit StartedBattle(msg.sender, address(0), battleId, 0, block.timestamp);
        } else {
            players[msg.sender].battleMoveId = 1;
            uint256 battleId = waitingBattleId;
            address player1 = battles[battleId].playerAddrs[0];
            delete waitingBattleId;
            battles[battleId].playerAddrs[1] = msg.sender;
            battles[battleId].battleStatus = BattleStatus.STARTED;
            emit StartedBattle(player1, msg.sender, battleId, 1, block.timestamp);
        }
    }

    function makeMove(uint256 battleId, Choice choice) external playerOnly inBattle inThisBattle(battleId){
        if (battles[battleId].battleStatus != BattleStatus.STARTED) {
            revert CardBattle__StatusNotCorrect();
        }
        if (choice == Choice.NO) {
            revert CardBattle__CannotChoiceNo();
        }
        uint8 battleMoveId = players[msg.sender].battleMoveId;
        if (battles[battleId].moves[battleMoveId] != Choice.NO){
            revert CardBattle__MadeMoveAlready();
        }
        battles[battleId].moves[battleMoveId] = choice;
        if (battles[battleId].moves[0] != Choice.NO && battles[battleId].moves[1] != Choice.NO) {
            _updateGame(battleId);
        }
        emit MadeMove(battleId, msg.sender, choice);
    }

    function _updateGame(uint256 battleId) internal {
        address player1Addr = battles[battleId].playerAddrs[0];
        address player2Addr = battles[battleId].playerAddrs[1];
        Player storage player1 = players[player1Addr];
        Player storage player2 = players[player2Addr];
        Choice move1 = battles[battleId].moves[0]; 
        Choice move2 = battles[battleId].moves[1]; 
        battles[battleId].moves[0] = Choice.NO;
        battles[battleId].moves[1] = Choice.NO;
        if (move1 == Choice.ATTACK && move2 == Choice.ATTACK) {
            player1.health = player1.health - player2.battleAttack;
            player2.health = player2.health - player1.battleAttack;
            if (player1.health > 0 && player2.health <= 0) {
                battles[battleId].winner = player1.playerAddr;
                _endBattle(battleId, player1Addr, player2Addr);
            } else if (player1.health <= 0 && player2.health > 0) {
                battles[battleId].winner = player2.playerAddr;
                _endBattle(battleId, player1Addr, player2Addr);
            } else if (player1.health <= 0 && player2.health <= 0) {
                _endBattle(battleId, player1Addr, player2Addr);
            }
            player1.energy -= 2;
            player2.energy -= 2;
            if (player1.energy == 0) {
                if (player1.health > player2.health) {
                    battles[battleId].winner = player1.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                } else if (player1.health < player2.health) {
                    battles[battleId].winner = player2.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                }
                _endBattle(battleId, player1Addr, player2Addr);
            }
        } else if(move1 == Choice.ATTACK && move2 == Choice.DEFENSE) {
            player2.health = player2.health - player1.battleAttack + player2.battleDefense;
            if (player1.health > 0 && player2.health <= 0) {
                battles[battleId].winner = player1.playerAddr;
                _endBattle(battleId, player1Addr, player2Addr);
            } else if (player1.health <= 0 && player2.health > 0) {
                battles[battleId].winner = player2.playerAddr;
                _endBattle(battleId, player1Addr, player2Addr);
            } else if (player1.health <= 0 && player2.health <= 0) {
                _endBattle(battleId, player1Addr, player2Addr);
            }
            player1.energy -= 2;
            player2.energy -= 2;
            if (player1.energy == 0) {
                if (player1.health > player2.health) {
                    battles[battleId].winner = player1.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                } else if (player1.health < player2.health) {
                    battles[battleId].winner = player2.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                }
                _endBattle(battleId, player1Addr, player2Addr);
            }
        } else if(move1 == Choice.DEFENSE && move2 == Choice.ATTACK) {
            player1.health = player1.health - player2.battleAttack + player1.battleDefense;
            if (player1.health > 0 && player2.health <= 0) {
                battles[battleId].winner = player1.playerAddr;
                _endBattle(battleId, player1Addr, player2Addr);
            } else if (player1.health <= 0 && player2.health > 0) {
                battles[battleId].winner = player2.playerAddr;
                _endBattle(battleId, player1Addr, player2Addr);
            } else if (player1.health <= 0 && player2.health <= 0) {
                _endBattle(battleId, player1Addr, player2Addr);
            }
            player1.energy -= 2;
            player2.energy -= 2;
            if (player1.energy == 0) {
                if (player1.health > player2.health) {
                    battles[battleId].winner = player1.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                } else if (player1.health < player2.health) {
                    battles[battleId].winner = player2.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                }
               _endBattle(battleId, player1Addr, player2Addr);
            }
        } else if(move1 == Choice.DEFENSE && move2 == Choice.DEFENSE) {
            player1.energy -= 2;
            player2.energy -= 2;
            if (player1.energy == 0) {
                if (player1.health > player2.health) {
                    battles[battleId].winner = player1.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                } else if (player1.health < player2.health) {
                    battles[battleId].winner = player2.playerAddr;
                    _endBattle(battleId, player1Addr, player2Addr);
                }
                _endBattle(battleId, player1Addr, player2Addr);
            }
        }
        emit UpdatedGame(battleId, player1Addr, player1Addr, block.timestamp);
    }

    function _endBattle(uint256 battleId, address player1Addr, address player2Addr) internal {
        address winner = battles[battleId].winner;
        Player storage player1 = players[player1Addr];
        Player storage player2 = players[player2Addr];

        player1.isInBattle = false;
        player2.isInBattle = false;
        battles[battleId].battleStatus = BattleStatus.ENDED;
        emit EndedBattle(battleId, winner, block.timestamp);
    }

    //internal function to generate a random number
    function _createRandomNum(uint256 _max, address _sender) internal view returns (uint256 randomValue) {
        uint256 randomNum = uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp, _sender)));
        randomValue = randomNum % _max;
        //we want it from 1 to _max
        return randomValue + 1;
    }

    function ownerWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool sentOwner,) = payable(msg.sender).call{value:balance}("");
        if (!sentOwner) {
            revert CardBattle__SentOwnerFailed();
        }
        emit WithdrewByOwner(msg.sender, balance, block.timestamp);
    }

    function deletePlayer(address playerAddr) external onlyOwner {
        delete players[playerAddr];
    }

    function deleteBattle(uint256 battleId) external onlyOwner {
        delete battles[battleId];
    }

    function isPlayer(address playerAddr) public view returns (bool) {
        return players[playerAddr].playerAddr != address(0);
    }

    function getToken(uint256 tokenId) external view returns (Token memory){
        return tokens[tokenId];
    }

    function getPlayer(address playerAddr) external view returns (Player memory){
        return players[playerAddr];
    }

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getBattleStatus(uint256 battleId) external view returns (BattleStatus) {
        return battles[battleId].battleStatus;
    }

    function getNextBattleId() external view returns (uint256) {
        return nextBattleId;
    }

    function getWaitingBattleId() external view returns (uint256) {
        return waitingBattleId;
    }

    function getOwnedTokenAmount(address playerAddr, uint256 tokenId) external view returns(uint256) {
        return ownedTokens[playerAddr][tokenId];
    }

    function getContractBalance() external view returns(uint256) {
        return address(this).balance;
    }

    function getLastMintedChar() external view returns(uint256) {
        return lastMintedChar;
    }

    function getPlayerBattleTokens(address playerAddr) external view returns(uint256[3] memory) {
        return players[playerAddr].battleTokens;
    }
}
