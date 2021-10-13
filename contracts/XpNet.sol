//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

contract XpNet is ERC20PresetFixedSupply {
    constructor()
        ERC20PresetFixedSupply("XpNet", "XPNET", 5e9 ether, msg.sender)
    {}
}
