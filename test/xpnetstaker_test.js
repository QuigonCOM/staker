const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XpNetStaker", function () {
  it("Should deploy", async function () {
    const Greeter = await ethers.getContractFactory("XpNetStaker");
    const greeter = await Greeter.deploy();
    await greeter.deployed();
  });
});
