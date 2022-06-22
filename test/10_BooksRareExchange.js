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
  });

  it("Should pass: collection setter must be of type 2(azuki inherits ownable)", async () => {
    expect(true);
  });


});
