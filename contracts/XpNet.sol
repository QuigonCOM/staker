//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

contract XpNet is ERC20PresetFixedSupply, Ownable, ERC20Pausable {
    string public _name = "XpNet";
    string public _symbol = "XPNET";

    constructor()
        ERC20PresetFixedSupply(_name, _symbol, 5e9 ether, msg.sender)
    {}

    function setName(string calldata newName) public onlyOwner {
        _name = newName;
    }

    function setSymbol(string calldata newSymbol) public onlyOwner {
        _symbol = newSymbol;
    }

    function pause() public onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() public onlyOwner whenPaused {
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
