const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");

const boreApeAbi = [
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "symbol", type: "string" },
      { internalType: "uint256", name: "maxNftSupply", type: "uint256" },
      { internalType: "uint256", name: "saleStart", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "approved",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      { indexed: false, internalType: "bool", name: "approved", type: "bool" },
    ],
    name: "ApprovalForAll",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [],
    name: "BAYC_PROVENANCE",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_APES",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "REVEAL_TIMESTAMP",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "apePrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "baseURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "emergencySetStartingIndexBlock",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "flipSaleState",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "getApproved",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "operator", type: "address" },
    ],
    name: "isApprovedForAll",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxApePurchase",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "numberOfTokens", type: "uint256" },
    ],
    name: "mintApe",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "reserveApes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "saleIsActive",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "operator", type: "address" },
      { internalType: "bool", name: "approved", type: "bool" },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "baseURI", type: "string" }],
    name: "setBaseURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "provenanceHash", type: "string" },
    ],
    name: "setProvenanceHash",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "revealTimeStamp", type: "uint256" },
    ],
    name: "setRevealTimestamp",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "setStartingIndex",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "startingIndex",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "startingIndexBlock",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "tokenByIndex",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];
const boredApeAddress = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";

describe("Strategy Standard Sale For Fixed Price", function () {
  // Deploy contract
  let strategyStandardSaleForFixedPrice, owner, account1;

  before(async () => {
    [owner, account1] = await ethers.getSigners();

    await network.provider.send("hardhat_setBalance", [
      owner.address,
      numToHex(34244188250),
    ]);

    //   const bal = await hre.network.provider.send("eth_getBalance",
    //     [owner.address],
    //   );

    // console.log(hexToNum(bal));

    const StrategyStandardSaleForFixedPrice = await ethers.getContractFactory(
      "StrategyStandardSaleForFixedPrice"
    );
    strategyStandardSaleForFixedPrice =
      await StrategyStandardSaleForFixedPrice.deploy(0);
    await strategyStandardSaleForFixedPrice.deployed();
  });

  it("Should pass: taker bid: matching taker bid and maker ask", async function () {
    const sig = await owner.signMessage(
      "This is a random string, because we are not using the signature in this contract"
    );
    const { v, r, s } = ethers.utils.splitSignature(sig);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    console.log(`Block Num before: ${blockNumBefore}`);
    console.log(`Timestamp before: ${timestampBefore}`);

    let startTime = timestampBefore;
    let seconds = 1000;
    endTime = startTime + seconds;

    let makerAsk = {
      isOrderAsk: true,
      signer: owner.address,
      collection: boredApeAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      nonce: 100,
      startTime,
      endTime,
      minPercentageToAsk: 9000,
      params: [],
      v,
      r,
      s,
    };

    let takerBid = {
      isOrderAsk: false,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk: 9000,
      params: [],
    };

    let match = await strategyStandardSaleForFixedPrice.canExecuteTakerBid(
      takerBid,
      makerAsk
    );

    expect(match[0]).to.be.true;
    expect(ethers.utils.formatUnits(match[1], 0)).to.be.equal("10");
  });

  it("Should fail: taker bid: expired maker ask", async function () {
    // same order set, but pass blocks ahead of order expiration - test fail
    const sig = await owner.signMessage(
      "This is a random string, because we are not using the signature in this contract"
    );
    const { v, r, s } = ethers.utils.splitSignature(sig);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let startTime = timestampBefore;
    let seconds = 1000;
    endTime = startTime + seconds;

    let makerAsk = {
      isOrderAsk: true,
      signer: owner.address,
      collection: boredApeAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      nonce: 100,
      startTime,
      endTime,
      minPercentageToAsk: 9000,
      params: [],
      v,
      r,
      s,
    };

    let takerBid = {
      isOrderAsk: false,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk: 9000,
      params: [],
    };

    let match = await strategyStandardSaleForFixedPrice.canExecuteTakerBid(
      takerBid,
      makerAsk
    );

    expect(match[0]).to.be.true;
    expect(ethers.utils.formatUnits(match[1], 0)).to.be.equal("10");

    await moveTime(1001);

    match = await strategyStandardSaleForFixedPrice.canExecuteTakerBid(
      takerBid,
      makerAsk
    );

    expect(match[0]).to.be.false;
  });

  it("Should pass: taker ask: matching taker ask and maker bid", async function () {
    const sig = await owner.signMessage(
      "This is a random string, because we are not using the signature in this contract"
    );
    const { v, r, s } = ethers.utils.splitSignature(sig);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let startTime = timestampBefore;
    let seconds = 1000;
    endTime = startTime + seconds;

    let makerBid = {
      isOrderAsk: false,
      signer: owner.address,
      collection: boredApeAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      nonce: 100,
      startTime,
      endTime,
      minPercentageToAsk: 9000,
      params: [],
      v,
      r,
      s,
    };

    let takerAsk = {
      isOrderAsk: false,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk: 9000,
      params: [],
    };

    let match = await strategyStandardSaleForFixedPrice.canExecuteTakerAsk(
      takerAsk,
      makerBid
    );

    expect(match[0]).to.be.true;
    expect(ethers.utils.formatUnits(match[1], 0)).to.be.equal("10");
  });

  it("Should fail: taker ask: expired maker bid", async function () {
    const sig = await owner.signMessage(
      "This is a random string, because we are not using the signature in this contract"
    );
    const { v, r, s } = ethers.utils.splitSignature(sig);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let startTime = timestampBefore;
    let seconds = 1000;
    endTime = startTime + seconds;

    let makerBid = {
      isOrderAsk: false,
      signer: owner.address,
      collection: boredApeAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      nonce: 100,
      startTime,
      endTime,
      minPercentageToAsk: 9000,
      params: [],
      v,
      r,
      s,
    };

    let takerAsk = {
      isOrderAsk: false,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk: 9000,
      params: [],
    };

    let match = await strategyStandardSaleForFixedPrice.canExecuteTakerAsk(
      takerAsk,
      makerBid
    );

    expect(match[0]).to.be.true;
    expect(ethers.utils.formatUnits(match[1], 0)).to.be.equal("10");

    await moveTime(1001);

    match = await strategyStandardSaleForFixedPrice.canExecuteTakerAsk(
      takerAsk,
      makerBid
    );

    expect(match[0]).to.be.false;
  });
});
