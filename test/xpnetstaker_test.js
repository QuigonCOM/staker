const { expect } = require("chai");
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
    let balAfterTransfer = (await xpnet.balanceOf(addr1.address)).toNumber();
    expect(balAfterTransfer).to.be.equals(1000);

    await (await xpnet.connect(addr1).approve(staker.address, 1000)).wait();
    await (await staker.connect(addr1).stake(1000, 90 * 86400)).wait();
    let balAfterStake = (await xpnet.balanceOf(addr1.address)).toNumber();
    expect(balAfterStake).to.be.equals(0);

    await staker.connect(owner).sudo_withdraw_token(addr1.address, 5);
    let balAfterSudo = (await xpnet.balanceOf(addr1.address)).toNumber();
    expect(balAfterSudo).to.be.equals(5);
  });
});
