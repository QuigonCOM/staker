//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract XpNetStaker is ERC721, Ownable {
    using SafeMath for uint256;
    // A struct represnting a stake.
    struct Stake {
        uint256 amount;
        uint256 nftTokenId;
        uint256 lockInPeriod;
        uint256 rewardWithdrawn;
        uint256 startTime;
    }
    // The primary token for the contract.
    ERC20 private token;

    // The NFT nonce which is used to keep the track of nftIDs.
    uint256 private nonce = 0;

    // stakes[nftTokenId] => Stake
    mapping(uint256 => Stake) public stakes;

    /*
    Takes an ERC20 token and initializes it as the primary token for this smart contract.
     */
    constructor(ERC20 _token) ERC721("XpNetStaker", "XPS") {
        token = _token;
    }

    /*
    Initates a stake
    @param _amt: The amount of ERC20 tokens that are being staked.
    @param _timeperiod: The amount of time for which these are being staked.
     */
    function stake(uint256 _amt, uint256 _timeperiod) public {
        _mint(msg.sender, nonce);
        token.transferFrom(msg.sender, address(this), _amt);
        Stake memory _newStake = Stake(
            _amt,
            nonce,
            _timeperiod,
            0,
            block.timestamp
        );
        stakes[nonce] = _newStake;
        nonce += 1;
    }

    /*
    Withdraws a stake
    @requires - The Stake Time Period must be completed before it is ready to be withdrawn.
    @param _tokenID: The nft id of the stake.
     */
    function withdraw(uint256 _tokenID) public {
        Stake memory _stake = stakes[_tokenID];
        require(
            _stake.startTime + _stake.lockInPeriod > block.timestamp,
            "Stake hasnt matured yet."
        );
        _burn(_tokenID);
        uint256 _reward = _calculateRewards(_stake.lockInPeriod, _stake.amount);
        token.transferFrom(address(this), msg.sender, _stake.amount + _reward);
        delete stakes[nonce];
    }

    function _calculateRewards(uint256 _lockInPeriod, uint256 _amt)
        private
        returns (uint256)
    {
        if (_lockInPeriod == 90 days) {
            return _amt.mul(0.45);
        } else if (_lockInPeriod == 180 days) {
            return _amt.mul(0.75);
        } else if (_lockInPeriod == 270 days) {
            return _amt.mul(1);
        } else if (_lockInPeriod == 365 days) {
            return _amt.mul(1.25);
        } else {
            return 0;
        }
    }

    /*
    Checks whether the stake is ready to be withdrawn or not.
    @param _tokenID: The nft id of the stake.
     */
    function check_is_locked(uint256 _nftID) public view returns (bool) {
        Stake memory _stake = stakes[_nftID];
        return _stake.startTime + _stake.lockInPeriod > block.timestamp;
    }

    /*
    SUDO ONLY:
    @param address: The address to which _amt Tokens must be transferred to.
    @param amt: The amt of tokens.
     */
    function sudo_withdraw_token(address _to, uint256 _amt) public onlyOwner {
        token.transferFrom(address(this), _to, _amt);
    }
}
