const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: azukiAddress, abi: azukiAbi } = require("./constants/azuki");

describe("Royalty Fee Manager", function () {
  // Deploy contract
  let currencyManager, executionManager, royaltyFeeManager, royaltyFeeRegistry, royaltyFeeSetter, booksRareExchange, owner, account1;

  let weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  before(async () => {
    [owner, account1, account2] = await ethers.getSigners();

    await network.provider.send("hardhat_setBalance", [
      owner.address,
      numToHex(45281102540907114720),
    ]);

    const ExecutionManager = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManager.deploy();
    await executionManager.deployed();

    const CurrencyManager = await ethers.getContractFactory("CurrencyManager");
    currencyManager = await CurrencyManager.deploy();
    await currencyManager.deployed();


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


    const BooksRareExchange = await ethers.getContractFactory("BooksRareExchange");
    booksRareExchange = await BooksRareExchange.deploy(currencyManager.address, executionManager.address, royaltyFeeManager.address, weth, owner.address);
    await booksRareExchange.deployed();
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
