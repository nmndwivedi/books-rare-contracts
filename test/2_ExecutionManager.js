const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Execution Manager", function () {
  let executionManager, strategies;

  before(async () => {
    const ExecutionManager = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManager.deploy();
    await executionManager.deployed();

    const MockErc20 = await ethers.getContractFactory("MockErc20");

    strategies = await Promise.all([MockErc20.deploy(), MockErc20.deploy(), MockErc20.deploy()]);
    await Promise.all(strategies.map(c=>c.deployed()));
    strategies = strategies.map(c=>c.address);
  });

  it("SBA2 add strategies to whitelist ", async function () {
    // Add strategies, check whether strategies are whitelisted, confirm whitelist elements and count
    await Promise.all(strategies.map(c => {
      executionManager.addStrategy(c);
    }));

    const wl = await executionManager.viewWhitelistedStrategies();
    const wlStrategies = wl[0];
    const wlStrategiesCount = wl[1];

    expect(strategies.every((c)=>wlStrategies.includes(c) && strategies.length===wlStrategies.length)).to.be.true;

    strategies.map(async c => {
      expect(await executionManager.isStrategyWhitelisted(c)).to.be.true;
    });

    expect(await executionManager.viewCountWhitelistedStrategies()).to.be.equal(strategies.length).to.be.equal(wlStrategies.length).to.be.equal(wlStrategiesCount);
  })

  it("SBA2 remove a strategy from whitelist", async function () {
    strategies.map(async c=>{
      await executionManager.removeStrategy(c);
      expect(await executionManager.isStrategyWhitelisted(c)).to.be.false;
    })

    expect(await executionManager.viewCountWhitelistedStrategies()).to.be.equal(0);
  });
});
