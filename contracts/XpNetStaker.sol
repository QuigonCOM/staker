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

    event StakeCreated(address owner, uint256 amt);
    event StakeWithdrawn(address owner, uint256 amt);
    event SudoWithdraw(address to, uint256 amt);

    /*
    Initates a stake
    @param _amt: The amount of ERC20 tokens that are being staked.
    @param _timeperiod: The amount of time for which these are being staked.
     */
    function stake(uint256 _amt, uint256 _timeperiod) public {
        require(
            token.transferFrom(msg.sender, address(this), _amt),
            "Please approve the staking amount in native token first."
        );
        require(
            _timeperiod == 90 days ||
                _timeperiod == 180 days ||
                _timeperiod == 270 days ||
                _timeperiod == 365 days,
            "Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
        );
        Stake memory _newStake = Stake(
            _amt,
            nonce,
            _timeperiod,
            0,
            block.timestamp
        );
        _mint(msg.sender, nonce);
        stakes[nonce] = _newStake;
        emit StakeCreated(msg.sender, _amt);
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
        uint256 _reward = _calculateRewards(
            _stake.lockInPeriod,
            _stake.amount,
            _stake.startTime
        );
        token.transferFrom(address(this), msg.sender, _stake.amount + _reward);
        emit StakeWithdrawn(msg.sender, _stake.amount);
        delete stakes[nonce];
    }

    function _calculateRewards(
        uint256 _lockInPeriod,
        uint256 _amt,
        uint256 _startTime
    ) private view returns (uint256) {
        if (
            _lockInPeriod == 90 days || (block.timestamp - _startTime) < 90 days
        ) {
            uint256 rewardPercentage = (((block.timestamp - _startTime) /
                _lockInPeriod) * 45) / 100;
            return _amt.mul(rewardPercentage);
        } else if (
            _lockInPeriod == 180 days ||
            (block.timestamp - _startTime) < 180 days
        ) {
            uint256 rewardPercentage = (((block.timestamp - _startTime) /
                _lockInPeriod) * 75) / 100;
            return _amt.mul(rewardPercentage);
        } else if (
            _lockInPeriod == 270 days ||
            (block.timestamp - _startTime) < 270 days
        ) {
            uint256 rewardPercentage = (((block.timestamp - _startTime) /
                _lockInPeriod) * 100) / 100;
            return _amt.mul(rewardPercentage);
        } else if (
            _lockInPeriod == 365 days ||
            (block.timestamp - _startTime) < 365 days
        ) {
            uint256 rewardPercentage = (((block.timestamp - _startTime) /
                _lockInPeriod) * 125) / 100;
            return _amt.mul(rewardPercentage);
        } else {
            // TODO: Handle
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
        emit SudoWithdraw(_to, _amt);
    }
}
