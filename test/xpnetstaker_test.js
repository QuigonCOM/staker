const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("XpNetStaker", function () {
  let owner, addr1, addr2, addr3, addr4;
  let xpnet;
  let staker;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const XPNet = await ethers.getContractFactory("XpNet");
    xpnet = await XPNet.deploy(100000000000, "XpNet", 18, "XPT");

    const Staker = await ethers.getContractFactory("XpNetStaker");
    staker = await Staker.deploy(xpnet.address);
  });

  it("admin matches deployer", async () => {
    await expect(await staker.owner()).to.equals(owner.address);
  });

  it("stakes for 90 days without approving", async () => {
    await expect(staker.stake(500, 90 * 86400)).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'token balance or allowance is lower than amount requested'"
    );
  });

  it("stakes tokens by addr1 for 90 days with approval", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    await expect(staker.connect(addr1).stake(1000, 90 * 86400)).to.emit(
      staker,
      "Transfer"
    );
  });

  it("stakes tokens by addr1 for wrong number of days with approval", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    await expect(
      staker.connect(addr1).stake(1000, 90 * 86200)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
  });

  it("stakes and tries to withdraw rewards", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    let receipt2 = await (
      await staker.connect(addr1).withdrawRewards(event.args.tokenId, 0)
    ).wait();
    let event2 = receipt2.events?.filter((x) => {
      return x.event == "StakeRewardWithdrawn";
    })[0];
    assert(event2, "did not find any withdraw event");
  });

  it("stakes and tries to withdraw stake", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    assert(
      (await xpnet.balanceOf(staker.address)).toNumber() == 1000,
      "amount should be 1000"
    );
    let receipt2 = await (
      await staker.connect(addr1).withdraw(event.args.tokenId)
    ).wait();
    let event2 = receipt2.events?.filter((x) => {
      return x.event == "StakeWithdrawn";
    })[0];
    console.log(event2.args.amt.toNumber());
    assert(event2, "did not find any withdraw event");
  });

  it("tries to set uri twice", async () => {
    await xpnet.approve(staker.address, 1000);
    let tx = await staker.stake(1000, 90 * 86400);
    let receipt = await tx.wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];

    await staker.setURI(event.args.tokenId, "https://google.com");
    expect(
      staker.setURI(event.args.tokenId, "https://google.com")
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'can't change token uri'"
    );
  });

  it("tries to make sudo trasnsaction", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400)
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];

    await staker.connect(owner).sudoWithdrawToken(event.args.tokenId);
    let stake = await staker.stakes(event.args.tokenId);
    assert(stake.amount.toNumber() == 0);
  });
});
