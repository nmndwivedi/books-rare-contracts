const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: azukiAddress, abi: azukiAbi } = require("./constants/azuki");

describe("Royalty Fee Manager", function () {
  // Deploy contract
  let royaltyFeeManager, royaltyFeeRegistry, royaltyFeeSetter, owner, account1;

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


    const RoyaltyFeeManager = await ethers.getContractFactory("RoyaltyFeeManager");
    royaltyFeeManager = await RoyaltyFeeManager.deploy(royaltyFeeRegistry.address);
    await royaltyFeeManager.deployed();
  });

  it("Should pass: collection setter must be of type 2(azuki inherits ownable)", async () => {
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

    const [receiver, royaltyAmt] = await royaltyFeeManager.calculateRoyaltyFeeAndGetRecipient(azukiAddress, 99, ethers.utils.parseEther("1"));

    expect(receiver).to.equal(account1.address);
    expect(ethers.utils.formatEther(royaltyAmt)).to.equal("0.2");
  });


});
