// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameTokens is ERC1155, Ownable {
    //set up ERC1155 tokenIds from 1 to 9
    uint256 public constant Jeff = 1;
    uint256 public constant Charlie = 2;
    uint256 public constant Henley = 3;
    uint256 public constant Jack = 4;
    uint256 public constant Bob = 5;
    uint256 public constant Sophie = 6;
    uint256 public constant Steve = 7;
    uint256 public constant Berserk = 8;
    uint256 public constant ForceShield = 9;

    constructor() ERC1155("ipfs://QmdBAAW5AJ8Yv2zyZYeeQ1bdYUsNQDjxpsTKt3MfmnHhwg/{id}.json") {
        
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        public
    {
        _mint(account, id, amount, data);
    }

    function burn(address account, uint256 id, uint256 amount)
        public
    {
        _burn(account, id, amount);
    }

}