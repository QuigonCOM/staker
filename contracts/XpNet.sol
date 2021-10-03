//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

contract XpNet is ERC20PresetFixedSupply {
    constructor()
        ERC20PresetFixedSupply("XpNet", "XPNET", 10000000000, msg.sender)
    {}
}
