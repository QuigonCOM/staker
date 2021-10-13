const { BigNumber } = require("@ethersproject/bignumber");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("XpNetStaker", function () {
  let owner, addr1, addr2, addr3, addr4;
  let xpnet;
  let staker;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const XPNet = await ethers.getContractFactory("XpNet");
    xpnet = await XPNet.deploy();

    const Staker = await ethers.getContractFactory("XpNetStaker");
    staker = await Staker.deploy(xpnet.address);
    await (await xpnet.connect(owner).transfer(staker.address, 1000000)).wait();
  });

  it("admin matches deployer", async () => {
    await expect(await staker.owner()).to.equals(owner.address);
  });

  it("stakes for 90 days without approving", async () => {
    await expect(
      staker.stake("1500000000000000000000", 90 * 86400)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds allowance'"
    );
  });

  it("stakes tokens by addr1 for 90 days with approval", async () => {
    const sixThousandTokens = "6000000000000000000000";
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, sixThousandTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, sixThousandTokens);
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).to.emit(staker, "Transfer");
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 180 * 86400)
    ).to.emit(staker, "Transfer");
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 270 * 86400)
    ).to.emit(staker, "Transfer");
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86400)
    ).to.emit(staker, "Transfer");
  });

  it("stakes tokens by addr1 for wrong number of days with approval", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86200)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 180 * 86200)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 270 * 86200)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
    await expect(
      staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86200)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
  });

  it("tests the metadataUrl of the nft", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "StakeCreated";
    })[0];
    assert(
      (await staker.connect(addr1)["tokenURI(uint256)"](event.args.nftID)) ==
        "https://staking-api.xp.network/staking-nfts/0",
      "tokenUri doesnt match"
    );
  });

  it("stakes and tries to withdraw 1token from rewards", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [90 * 80000]);
    let receipt2 = await (
      await staker
        .connect(addr1)
        .withdrawRewards(event.args.tokenId, "1000000000000000000")
    ).wait();
    assert(
      (await xpnet.balanceOf(addr1.address)).toString() ==
        "1000000000000000000",
      "withdraw failed"
    );
  });

  it("tries withdrawing tokens before maturity is reached", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "StakeCreated";
    })[0];
    assert(event, "did not find any stake event");
    await ethers.provider.send("evm_increaseTime", [90 * 86300]);
    await expect(
      staker.connect(addr1).withdraw(event.args.nftID)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Stake hasnt matured yet.'"
    );
  });

  it("test checkIsUnlocked", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "StakeCreated";
    })[0];
    assert(event, "did not find any stake event");
    await ethers.provider.send("evm_increaseTime", [90 * 86300]);
    await ethers.provider.send("evm_mine", []);
    await assert(
      (await staker.checkIsUnlocked(event.args.nftID)) == false,
      "failed to test checkIsUnlocked"
    );
    await ethers.provider.send("evm_increaseTime", [91 * 86400]);
    await ethers.provider.send("evm_mine", []);
    assert(
      (await staker.checkIsUnlocked(event.args.nftID)) == true,
      "failed to test checkIsUnlocked"
    );
  });

  it("stakes 1500tokens for 90 days and tries to check rewards after maturity, should equal 168.75", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [90 * 86400]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toString()
    ).to.be.equal("168750000000000000000");
  });

  it("stakes 1500tokens for 180 days and tries to check rewards after maturity, should equal 562.5", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 180 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [180 * 86400]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toString()
    ).to.be.equal("562500000000000000000");
  });

  it("stakes 1500tokens for 270 days and tries to check rewards after maturity, should equal 1125", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 270 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [270 * 86400]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toString()
    ).to.be.equal("1125000000000000000000");
  });

  it("stakes 1500tokens for 365 days and tries to check rewards after maturity, should equal 1875", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [365 * 86400]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toString()
    ).to.be.equal("1875000000000000000000");
  });

  it("stakes 1500tokens for 90 days and fails when someone other than staker tries to withdraw", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [365 * 86401]);
    await ethers.provider.send("evm_mine", []);
    expect(staker.connect(addr2).withdraw(event.args.tokenId)).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'You dont own this stake.'"
    );
  });

  it("stakes 1500tokens for 90 days and fails when someone other than nft owner tries to withdraw rewards, transfers the nft to the other address and then tries to withdraw and succeeds", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [365 * 86401]);
    await ethers.provider.send("evm_mine", []);
    expect(
      staker.connect(addr2).withdrawRewards(event.args.tokenId, 5)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'You dont own this nft.'"
    );
  });

  it("stakes 1500tokens for 90 days and fails when someone other than nft owner tries to  withdraw rewards", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [365 * 86401]);
    await ethers.provider.send("evm_mine", []);
    expect(
      staker.connect(addr2).withdrawRewards(event.args.tokenId, 5)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'You dont own this nft.'"
    );
    await (
      await staker
        .connect(addr1)
        [`safeTransferFrom(address,address,uint256)`](
          addr1.address,
          addr2.address,
          event.args.tokenId
        )
    ).wait();
    expect(
      staker.connect(addr2).withdrawRewards(event.args.tokenId, 5)
    ).to.emit(staker, "StakeRewardWithdrawn");
  });

  it("tries to make sudo trasnsaction", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    expect(
      staker.connect(addr1).sudoWithdrawToken(event.args.tokenId)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'"
    );
    await staker.connect(owner).sudoWithdrawToken(event.args.tokenId);
    let stake = await staker.stakes(event.args.tokenId);
    assert(stake.amount.toNumber() == 0);
  });

  it("tests sudo increase correct", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    expect(
      staker.connect(addr1).sudoWithdrawToken(event.args.tokenId)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'"
    );
    await staker.connect(owner).sudoAddToken(event.args.tokenId, 5);
    let stake = await staker.stakes(event.args.tokenId);
    assert(stake.correction.toNumber() == 5);
  });

  it("stakes 51 million tokens", async () => {
    await (
      await xpnet
        .connect(owner)
        .transfer(addr1.address, "500000000000000000000000000")
    ).wait();
    await xpnet
      .connect(addr1)
      .approve(staker.address, "500000000000000000000000000");
    expect(
      staker.connect(addr1).stake("500000000000000000000000000", 90 * 86400)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Maximum count for stakes reached.'"
    );
  });

  it("tests rewards after a day", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    const receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "StakeCreated";
    })[0];
    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (
        await staker.connect(addr1).showAvailableRewards(event.args.nftID)
      ).toString()
    ).to.be.equals("1875000000000000000");
  });

  it("tests that extra awards should not be awarded for after lock in period is complete", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 365 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [700 * 86400]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toString()
    ).to.be.equal("1875000000000000000000");
  });

  it("tests sudo decrease correction", async () => {
    const fifteenHundredTokens = "1500000000000000000000";
    await (
      await xpnet.connect(owner).transfer(addr1.address, fifteenHundredTokens)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, fifteenHundredTokens);
    let receipt = await (
      await staker.connect(addr1).stake(fifteenHundredTokens, 90 * 86400)
    ).wait();

    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    expect(
      staker.connect(addr1).sudoWithdrawToken(event.args.tokenId)
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'"
    );
    await staker.connect(owner).sudoDeductToken(event.args.tokenId, 5);
    let stake = await staker.stakes(event.args.tokenId);
    assert(stake.correction.toNumber() == -5);
  });
});
