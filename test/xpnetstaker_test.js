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
      staker.stake(500, 90 * 86400, "https://google.com")
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds allowance'"
    );
  });

  it("stakes tokens by addr1 for 90 days with approval", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 4000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 4000);
    await expect(
      staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
    ).to.emit(staker, "Transfer");
    await expect(
      staker.connect(addr1).stake(1000, 180 * 86400, "https://google.com")
    ).to.emit(staker, "Transfer");
    await expect(
      staker.connect(addr1).stake(1000, 270 * 86400, "https://google.com")
    ).to.emit(staker, "Transfer");
    await expect(
      staker.connect(addr1).stake(1000, 365 * 86400, "https://google.com")
    ).to.emit(staker, "Transfer");
  });

  it("stakes tokens by addr1 for wrong number of days with approval", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    await expect(
      staker.connect(addr1).stake(1000, 90 * 86200, "https://google.com")
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
    await expect(
      staker.connect(addr1).stake(1000, 180 * 86200, "https://google.com")
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
    await expect(
      staker.connect(addr1).stake(1000, 270 * 86200, "https://google.com")
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
    await expect(
      staker.connect(addr1).stake(1000, 365 * 86200, "https://google.com")
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Please make sure the amount specified is one of the four [90 days, 180 days, 270 days, 365 days]."
    );
  });

  it("stakes and tries to withdraw 1token from rewards", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    await ethers.provider.send("evm_increaseTime", [90 * 80000]);
    let receipt2 = await (
      await staker.connect(addr1).withdrawRewards(event.args.tokenId, 1)
    ).wait();
    assert(
      (await xpnet.balanceOf(addr1.address)).toNumber() == 1,
      "withdraw failed"
    );
  });

  it("tries withdrawing tokens before maturity is reached", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
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

  it("stakes 100tokens for 90 days and tries to check rewards after maturity, should equal 11", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    assert(
      (await xpnet.balanceOf(staker.address)).toNumber() ==
        contractBalanceBefore + 1000,
      "amount should be increased by 1000"
    );
    await ethers.provider.send("evm_increaseTime", [91 * 86900]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toNumber()
    ).to.be.equal(11);
  });

  it("stakes 100tokens for 180 days and tries to check rewards after maturity, should equal 36", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(1000, 180 * 86400, "https://google.com")
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    assert(
      (await xpnet.balanceOf(staker.address)).toNumber() ==
        contractBalanceBefore + 1000,
      "amount should be increased by 1000"
    );
    await ethers.provider.send("evm_increaseTime", [180 * 86401]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toNumber()
    ).to.be.equal(36);
  });

  it("stakes 100tokens for 270 days and tries to check rewards after maturity, should equal 73", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(1000, 270 * 86400, "https://google.com")
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    assert(
      (await xpnet.balanceOf(staker.address)).toNumber() ==
        contractBalanceBefore + 1000,
      "amount should be increased by 1000"
    );
    await ethers.provider.send("evm_increaseTime", [270 * 86401]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toNumber()
    ).to.be.equal(73);
  });

  it("stakes 100tokens for 365 days and tries to check rewards after maturity, should equal 125", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(1000, 365 * 86400, "https://google.com")
    ).wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Transfer";
    })[0];
    assert(
      (await xpnet.balanceOf(staker.address)).toNumber() ==
        contractBalanceBefore + 1000,
      "amount should be increased by 1000"
    );
    await ethers.provider.send("evm_increaseTime", [365 * 86401]);
    await ethers.provider.send("evm_mine", []);
    expect(
      (await staker.showAvailableRewards(event.args.tokenId)).toNumber()
    ).to.be.equal(125);
  });

  it("stakes 100tokens for 90 days and fails when someone other than staker tries to  withdraw", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let contractBalanceBefore = (
      await xpnet.balanceOf(staker.address)
    ).toNumber();
    let receipt = await (
      await staker.connect(addr1).stake(1000, 365 * 86400, "https://google.com")
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

  it("tries to make sudo trasnsaction", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
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
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
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
      await xpnet.connect(owner).transfer(addr1.address, 51_000_000)
    ).wait();
    await xpnet.connect(addr1).approve(staker.address, 51_000_000);
    let receipt = expect(
      staker.connect(addr1).stake(51_000_000, 90 * 86400, "https://google.com")
    ).to.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Maximum count for stakes reached.'"
    );
  });

  it("tests sudo decrease correction", async () => {
    await (await xpnet.connect(owner).transfer(addr1.address, 1000)).wait();
    await xpnet.connect(addr1).approve(staker.address, 1000);
    let receipt = await (
      await staker.connect(addr1).stake(1000, 90 * 86400, "https://google.com")
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
