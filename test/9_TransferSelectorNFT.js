const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: boredApeAddress, abi: boredApeAbi } = require("./constants/boredApe");

describe("Royalty Fee Manager", function () {
  // Deploy contract
  let transferManagerERC721, transferManagerERC1155, transferManagerNonCompliantERC721, transferSelectorNFT, owner, account1;

  before(async () => {
    [owner, account1, account2] = await ethers.getSigners();

    await network.provider.send("hardhat_setBalance", [
      owner.address,
      numToHex(45281102540907114720),
    ]);

    transferManagerERC721 =  await (await ethers.getContractFactory("TransferManagerERC721")).deploy();
    await transferManagerERC721.deployed();

    transferManagerERC1155 =  await (await ethers.getContractFactory("TransferManagerERC1155")).deploy();
    await transferManagerERC1155.deployed();

    transferManagerNonCompliantERC721 =  await (await ethers.getContractFactory("TransferManagerNonCompliantERC721")).deploy();
    await transferManagerNonCompliantERC721.deployed();

    transferSelectorNFT =  await (await ethers.getContractFactory("TransferSelectorNFT")).deploy(transferManagerERC721.address, transferManagerERC1155.address);
    await transferSelectorNFT.deployed();
  });

  it("Should pass: transfer manager for bored ape should be 721", async () => {
    const boredApeTransferManager = await transferSelectorNFT.checkTransferManagerForToken(boredApeAddress);
    expect(boredApeTransferManager).to.equal(transferManagerERC721.address);
  });

  it("Should pass: transfer manager for AlpacaToken should be 1155", async () => {
    const alpacaTokenTransferManager = await transferSelectorNFT.checkTransferManagerForToken("0xc7e5e9434f4a71e6db978bd65b4d61d3593e5f27");
    expect(alpacaTokenTransferManager).to.equal(transferManagerERC1155.address);
  });
});
