//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract XpNetStaker is Ownable, ERC721, ERC721Enumerable, ERC721URIStorage {
    // A struct represnting a stake.
    struct Stake {
        uint256 amount;
        uint256 nftTokenId;
        uint256 lockInPeriod;
        uint256 rewardWithdrawn;
        uint256 startTime;
        address staker;
        int256 correction;
        bool isActive;
        bool stakeWithdrawn;
    }
    // The primary token for the contract.
    ERC20 private token;

    // The NFT nonce which is used to keep the track of nftIDs.
    uint256 private nonce = 0;

    string public baseUri = "";

    uint256 public stakedCount = 0;

    // stakes[nftTokenId] => Stake
    mapping(uint256 => Stake) public stakes;

    /*
    Takes an ERC20 token and initializes it as the primary token for this smart contract.
     */
    constructor(ERC20 _token) ERC721("XpNetStaker", "XPS") {
        token = _token;
        baseUri = "https://staking-api.xp.network/staking-nfts/";
    }

    event StakeCreated(address owner, uint256 amt, uint256 nftID);
    event StakeWithdrawn(address owner, uint256 amt);
    event StakeRewardWithdrawn(address owner, uint256 amt);
    event SudoWithdraw(address to, uint256 amt);

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    function setBaseUri(string memory _newUri) public onlyOwner {
        baseUri = _newUri;
    }

    /*
    Initates a stake
    @param _amt: The amount of ERC20 tokens that are being staked.
    @param _timeperiod: The amount of time for which these are being staked.
    @param _metadataUri: The metadata URI of the NFT token.
     */
    function stake(uint256 _amt, uint256 _timeperiod) public {
        require(_amt != 0, "You cant stake 0 tokens.");
        require(_amt >= 1_500 * (10**18), "The minimum stake is 1,500 XPNET");
        require(
            stakedCount + _amt <= 50_000_000 * (10**18),
            "Maximum count for stakes reached."
        );
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
            block.timestamp,
            msg.sender,
            0,
            true,
            false
        );
        _mint(msg.sender, nonce);
        stakes[nonce] = _newStake;
        emit StakeCreated(msg.sender, _amt, nonce);
        nonce += 1;
        stakedCount += _amt;
    }

    function _calculateTimeDifference(uint256 _startTime, uint256 _lockInPeriod)
        internal
        view
        returns (uint256)
    {
        if ((block.timestamp - _startTime) > _lockInPeriod) {
            return _lockInPeriod;
        } else {
            return block.timestamp - _startTime;
        }
    }

    /*
    Withdraws a stake, the amount is always returned to the staker
    @requires - The Stake Time Period must be completed before it is ready to be withdrawn.
    @param _tokenID: The nft id of the stake.
     */
    function withdraw(uint256 _nftID) public {
        Stake memory _stake = stakes[_nftID];
        require(_stake.isActive, "The given token id is incorrect.");
        require(
            block.timestamp >= _stake.startTime + _stake.lockInPeriod,
            "Stake hasnt matured yet."
        );
        require(_stake.staker == msg.sender, "You dont own this stake.");
        require(
            !stakes[_nftID].stakeWithdrawn,
            "You have already withdrawn your stake."
        );
        require(
            token.transfer(msg.sender, _stake.amount),
            "failed to withdraw rewards"
        );
        stakes[_nftID].stakeWithdrawn = true;
        emit StakeWithdrawn(msg.sender, _stake.amount);
    }

    /*
    Withdraws rewards earned in a stake.
    The rewards are send to the address which calls this function.
    @param _nftID: The nft id of the stake.
     */
    function withdrawRewards(uint256 _nftID, uint256 _amt) public {
        Stake memory _stake = stakes[_nftID];
        require(_stake.isActive, "The given token id is incorrect.");
        uint256 _reward = _calculateRewards(
            _stake.lockInPeriod,
            _stake.amount,
            _stake.startTime
        );
        require(ownerOf(_nftID) == msg.sender, "You dont own this nft.");
        uint256 _final = uint256(
            int256(_stake.amount + _reward - _stake.rewardWithdrawn) +
                _stake.correction
        );
        require(
            _amt <= _final,
            "cannot withdraw amount more than currently earned rewards"
        );

        require(token.transfer(msg.sender, _amt), "failed to withdraw rewards");

        stakes[_nftID].rewardWithdrawn += _amt;
        emit StakeRewardWithdrawn(msg.sender, _amt);
    }

    /*
    Internal function to calculate the rewards.
    @param _lockInPeriod: The time period of the stake.
    @param _amt: The Amount of the stake.
    @param _startTime: The Time of the stake's start.
     */
    function _calculateRewards(
        uint256 _lockInPeriod,
        uint256 _amt,
        uint256 _startTime
    ) private view returns (uint256) {
        uint256 _reward;
        uint256 timeDiff = _calculateTimeDifference(_startTime, _lockInPeriod);
        if (
            _lockInPeriod == 90 days || (block.timestamp - _startTime) < 90 days
        ) {
            _reward = (((_amt * 1125 * timeDiff))) / 90 days / 10000;
        } else if (
            _lockInPeriod == 180 days ||
            (block.timestamp - _startTime) < 180 days
        ) {
            _reward = (((_amt * 3750 * timeDiff))) / 180 days / 10000;
        } else if (
            _lockInPeriod == 270 days ||
            (block.timestamp - _startTime) < 270 days
        ) {
            _reward = (((_amt * 7500 * timeDiff))) / 270 days / 10000;
        } else if (
            _lockInPeriod == 365 days ||
            (block.timestamp - _startTime) < 365 days
        ) {
            _reward = (((_amt * 12500 * timeDiff))) / 365 days / 10000;
        }
        return _reward;
    }

    /*
    Checks whether the stake is ready to be withdrawn or not.
    @param _nftID: The nft id of the stake.
     */
    function checkIsUnlocked(uint256 _nftID) public view returns (bool) {
        Stake memory _stake = stakes[_nftID];
        require(_stake.isActive, "The given token id is incorrect.");
        return block.timestamp >= _stake.startTime + _stake.lockInPeriod;
    }

    function showAvailableRewards(uint256 _nftID)
        public
        view
        returns (uint256)
    {
        Stake memory _stake = stakes[_nftID];
        require(_stake.isActive, "The given token id is incorrect.");
        uint256 _reward = _calculateRewards(
            _stake.lockInPeriod,
            _stake.amount,
            _stake.startTime
        );
        return
            uint256(
                int256(_reward - _stake.rewardWithdrawn) + _stake.correction
            );
    }

    /*
    SUDO ONLY:
    Increases the _amt of tokens in a stake owned by owner of _nftID.
    PLEASE MAKE SURE ONLY ABSOLUTE NUMBERS ARE SENT 
    @param _nftID: The nft id of the stake.
    @param _amt: The amount of tokens to be added.
     */
    function sudoAddToken(uint256 _nftID, uint256 _amt)
        public
        onlyOwner
        returns (bool)
    {
        stakes[_nftID].correction += int256(_amt);
        return true;
    }

    /*
    SUDO ONLY:
    Deducts the _amt of tokens from a stake owned by owner of _nftID.
    @param _tokenID: The nft id of the stake.
     */
    function sudoDeductToken(uint256 _nftID, int256 _amt)
        public
        onlyOwner
        returns (bool)
    {
        stakes[_nftID].correction -= _amt;
        return true;
    }

    /*
    SUDO ONLY:
    THE DEPLOYER OF THE SMART CONTRACT CAN USE THIS METHOD TO WITHDRAW A STAKE.
    NO REWARDS ARE GIFTED IN THIS CASE.
    @param _nftID: The address to which _amt Tokens must be transferred to.
     */
    function sudoWithdrawToken(uint256 _nftID) public onlyOwner {
        Stake memory _stake = stakes[_nftID];
        token.transfer(_stake.staker, _stake.amount);
        emit SudoWithdraw(_stake.staker, _stake.amount);
        delete stakes[_nftID];
    }
}
