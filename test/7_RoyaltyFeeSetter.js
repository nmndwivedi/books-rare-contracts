const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: azukiAddress, abi: azukiAbi } = require("./constants/azuki");

describe("Royalty Fee Setter", function () {
  // Deploy contract
  let royaltyFeeSetter, royaltyFeeRegistry, owner, account1;

  before(async () => {
    [owner, account1, account2] = await ethers.getSigners();

    await network.provider.send("hardhat_setBalance", [
      owner.address,
      numToHex(45281102540907114720),
    ]);

    const RoyaltyFeeRegistry = await ethers.getContractFactory("RoyaltyFeeRegistry");
    royaltyFeeRegistry =  await RoyaltyFeeRegistry.deploy(ethers.utils.parseUnits("2000", 0));
    await royaltyFeeRegistry.deployed();

    const RoyaltyFeeSetter = await ethers.getContractFactory("RoyaltyFeeSetter");
    royaltyFeeSetter = await RoyaltyFeeSetter.deploy(royaltyFeeRegistry.address);
    await royaltyFeeSetter.deployed();

    await royaltyFeeRegistry.transferOwnership(royaltyFeeSetter.address);
  });

  it("Should pass: collection setter must be of type 2(azuki inherits ownable)", async () => {
    const [azukiSetter, azukiType] = await royaltyFeeSetter.checkForCollectionSetter(azukiAddress);
    expect(azukiSetter).to.equal("0x2aE6B0630EBb4D155C6e04fCB16840FFA77760AA"); //azuki owner (retrieved from etherscan)
    expect(azukiType).to.equal(2);
  });

  it("Should pass: update royalty info for collection as owner", async function () {
    const azukiOwner = "0x2aE6B0630EBb4D155C6e04fCB16840FFA77760AA";

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [azukiOwner],
    });

    await network.provider.send("hardhat_setBalance", [
      azukiOwner,
      numToHex(45281102540907114720),
    ]);

    const azukiOwnerSigner = await ethers.provider.getSigner(azukiOwner);

    await royaltyFeeSetter.connect(azukiOwnerSigner).updateRoyaltyInfoForCollectionIfOwner(azukiAddress, account1.address, account1.address, ethers.utils.parseUnits("2000", 0));

    const [setter, receiver, fee] = await royaltyFeeRegistry.royaltyFeeInfoCollection(azukiAddress);
    const newFee = ethers.utils.formatUnits(fee, 0);

    expect(newFee).to.be.eq('2000');
    expect(setter).to.be.eq(account1.address);
    expect(receiver).to.be.eq(account1.address);
  });

  it("Should pass: collection setter must be of type 0(setter already set)", async () => {
    const [azukiSetter, azukiType] = await royaltyFeeSetter.checkForCollectionSetter(azukiAddress);
    expect(azukiSetter).to.equal(account1.address); //azuki owner (retrieved from etherscan)
    expect(azukiType).to.equal(0);
  });

  it("Should fail: update royalty info for collection as a non-owner", async function () {
    const tx = royaltyFeeSetter.updateRoyaltyInfoForCollectionIfOwner(azukiAddress, account1.address, account1.address, ethers.utils.parseUnits("2000", 0));

    await expect(tx).to.be.revertedWith('Owner_NotTheOwner');
  });

  it("Should pass: update royalty info for collection as setter", async function () {
    await royaltyFeeSetter.connect(account1).updateRoyaltyInfoForCollectionIfSetter(azukiAddress, account2.address, account2.address, ethers.utils.parseUnits("1900", 0));

    const [setter, receiver, fee] = await royaltyFeeRegistry.royaltyFeeInfoCollection(azukiAddress);
    const newFee = ethers.utils.formatUnits(fee, 0);

    expect(newFee).to.be.eq('1900');
    expect(setter).to.be.eq(account2.address);
    expect(receiver).to.be.eq(account2.address);
  });

  it("Should fail: update royalty info for collection as non-setter", async function () {
    const tx = royaltyFeeSetter.connect(account1).updateRoyaltyInfoForCollectionIfSetter(azukiAddress, account2.address, account2.address, ethers.utils.parseUnits("1900", 0));

    await expect(tx).to.be.revertedWith('Setter_NotTheSetter');
  });
});
