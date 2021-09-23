const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XpNetStaker", function () {
  it("Should return the name", async function () {
    const Greeter = await ethers.getContractFactory("XpNetStaker");
    const greeter = await Greeter.deploy();
    await greeter.deployed();

    expect(await greeter.name()).to.equal("XpNetStaker");
  });
});
