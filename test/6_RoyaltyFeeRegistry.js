const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: boredApeAddress, abi: boredApeAbi } = require("./constants/boredApe");

describe("Royalty Fee Registry", function () {
  // Deploy contract
  let royaltyFeeRegistry, owner, account1;

  before(async () => {
    [owner, account1, account2] = await ethers.getSigners();

    await network.provider.send("hardhat_setBalance", [
      owner.address,
      numToHex(45281102540907114720),
    ]);

    const RoyaltyFeeRegistry = await ethers.getContractFactory(
      "RoyaltyFeeRegistry"
    );
    royaltyFeeRegistry =
      await RoyaltyFeeRegistry.deploy(ethers.utils.parseUnits("500", 0));
    await royaltyFeeRegistry.deployed();
  });

  it("Should pass: set and check royalty fee limit", async function () {
    await royaltyFeeRegistry.updateRoyaltyFeeLimit(ethers.utils.parseUnits("2000", 0));

    const feeLimit = ethers.utils.formatUnits(await royaltyFeeRegistry.royaltyFeeLimit(), 0);

    expect(feeLimit).to.be.eq('2000');
  });

  it("Should fail: set royalty fee limit over 95%", async function () {
    const tx = royaltyFeeRegistry.updateRoyaltyFeeLimit(ethers.utils.parseUnits("9800", 0));

    await expect(tx).to.be.revertedWith('Owner_RoyaltyFeeLimitTooHigh');
  });

  it("Should pass: set and check royalty info for collection", async function () {
    await royaltyFeeRegistry.updateRoyaltyInfoForCollection(boredApeAddress, account1.address, account2.address, ethers.utils.parseUnits("1100", 0));

    const [setter, receiver, fee] = await royaltyFeeRegistry.royaltyFeeInfoCollection(boredApeAddress);

    expect(setter).to.be.eq(account1.address);
    expect(receiver).to.be.eq(account2.address);
    expect(ethers.utils.formatUnits(fee, 0)).to.be.eq('1100');
  });

  it("Should fail: set royalty fee above over limit", async function () {
    const tx = royaltyFeeRegistry.updateRoyaltyInfoForCollection(boredApeAddress, account1.address, account2.address, ethers.utils.parseUnits("2100", 0));

    await expect(tx).to.be.revertedWith('Registry_RoyaltyFeeTooHigh');
  });

  it("Should fail: set royalty info by non-owner", async function () {
    const tx = royaltyFeeRegistry.connect(account1).updateRoyaltyInfoForCollection(boredApeAddress, account1.address, account2.address, ethers.utils.parseUnits("1100", 0));

    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
