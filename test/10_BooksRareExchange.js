const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: azukiAddress, abi: azukiAbi } = require("./constants/azuki");

describe("Royalty Fee Manager", function () {
  // Deploy contract
  let currencyManager,
    executionManager,
    royaltyFeeManager,
    royaltyFeeRegistry,
    royaltyFeeSetter,
    transferManagerERC721,
    transferManagerERC1155,
    transferManagerNonCompliantERC721,
    transferSelectorNFT,
    booksRareExchange,
    strategyStandardSaleForFixedPrice,
    strategyAnyItemFromCollectionForFixedPrice,
    strategyPrivateSale,
    owner,
    account1,
    DOMAIN_SEPARATOR;

  let weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

  const createMatchingMakerAndTakerOrderOld = async (isMakerAskTakerBid) => {
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let startTime = timestampBefore;
    let seconds = 1000;
    let endTime = startTime + seconds;


    const priv = new ethers.Wallet("b0c2334182528060f650b13e44de881cd3a7bd38d2efd18c657227c8bc59ea17");

    let makerOrder = {
      isOrderAsk: isMakerAskTakerBid,
      signer: priv.address,
      collection: azukiAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: weth,
      nonce: 0,
      startTime,
      endTime,
      minPercentageToAsk: 9000,
      params: [],
    };

    let takerOrder = {
      isOrderAsk: !isMakerAskTakerBid,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk: 9000,
      params: [],
    };

    DOMAIN_SEPARATOR = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          "0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f", // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
          "0xeb55f97c7a81bf7a256970253121b0fab0720e859229ab96d3a7d0002fc3cb2f", // keccak256("BooksRareExchange")
          "0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6", // keccak256(bytes("1")) for versionId = 1
          (await ethers.provider.getNetwork()).chainId,
          booksRareExchange.address,
        ]
      )
    );

    const MAKER_ORDER_HASH = "0x40261ade532fa1d2c7293df30aaadb9b3c616fae525a0b56d3d411c841a85028";

    const orderHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        [ "bytes32", "bool", "address", "address", "uint256", "uint256", "uint256", "address", "address", "uint256", "uint256", "uint256", "uint256", "bytes32", ],
        [ MAKER_ORDER_HASH, makerOrder.isOrderAsk, makerOrder.signer, makerOrder.collection, makerOrder.price, makerOrder.tokenId, makerOrder.amount, makerOrder.strategy, makerOrder.currency, makerOrder.nonce, makerOrder.startTime, makerOrder.endTime, makerOrder.minPercentageToAsk, ethers.utils.keccak256(makerOrder.params), ]
      )
    );

    let messageHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["string", "bytes32", "bytes32"],
        ["\x19\x01", DOMAIN_SEPARATOR, orderHash]
      )
    );

    console.log(ethers.utils.solidityPack(
      ["string", "bytes32", "bytes32"],
      ["\x19\x01", DOMAIN_SEPARATOR, orderHash]
    ));

    const signature = await priv._signTypedData((ethers.utils.solidityPack(
      ["string", "bytes32", "bytes32"],
      ["\x19\x01", DOMAIN_SEPARATOR, orderHash]
    )));

    console.log(signature);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    makerOrder.v = v;
    makerOrder.r = r;
    makerOrder.s = s;



    // messageHash = ethers.utils.keccak256(
    //   ethers.utils.solidityPack(
    //     ["string", "bytes32"],
    //     ["\x19Ethereum Signed Messsage:\n32", messageHash]
    //   )
    // );

    // console.log(ethers.utils.verifyMessage(ethers.utils.arrayify(ethers.utils.solidityPack(
    //   ["string", "bytes32", "bytes32"],
    //   ["\x19\x01", DOMAIN_SEPARATOR, orderHash]
    // )), signature));
    // console.log(signature);

    if (isMakerAskTakerBid) return { makerAsk: makerOrder, takerBid: takerOrder, signature };
    else return { makerBid: makerOrder, takerAsk: takerOrder, signature };
  };

  const createMatchingMakerAndTakerOrder = async (isMakerAskTakerBid) => {
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    let startTime = timestampBefore;
    let seconds = 1000;
    let endTime = startTime + seconds;

    let makerOrder = {
      isOrderAsk: isMakerAskTakerBid,
      signer: owner.address,
      collection: azukiAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: weth,
      nonce: 0,
      startTime,
      endTime,
      minPercentageToAsk: 9000,
      params: [],
    };

    let takerOrder = {
      isOrderAsk: !isMakerAskTakerBid,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk: 9000,
      params: [],
    };

    const domain = {
      name: 'BooksRareExchange',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: booksRareExchange.address
    };

    const types = {
        MakerOrder:[
          {name:"isOrderAsk",type:"bool"},
          {name:"signer",type:"address"},
          {name:"collection",type:"address"},
          {name:"price", type:"uint256"},
          {name:"tokenId", type:"uint256"},
          {name:"amount", type:"uint256"},
          {name:"strategy", type:"address"},
          {name:"currency", type:"address"},
          {name:"nonce", type:"uint256"},
          {name:"startTime", type:"uint256"},
          {name:"endTime", type:"uint256"},
          {name:"minPercentageToAsk", type:"uint256"},
          {name:"params", type:"bytes"},
        ]
    }

    const signature = await owner._signTypedData(domain, types, makerOrder);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    makerOrder.v = v;
    makerOrder.r = r;
    makerOrder.s = s;



    // messageHash = ethers.utils.keccak256(
    //   ethers.utils.solidityPack(
    //     ["string", "bytes32"],
    //     ["\x19Ethereum Signed Messsage:\n32", messageHash]
    //   )
    // );

    // console.log(ethers.utils.verifyMessage(ethers.utils.arrayify(ethers.utils.solidityPack(
    //   ["string", "bytes32", "bytes32"],
    //   ["\x19\x01", DOMAIN_SEPARATOR, orderHash]
    // )), signature));
    // console.log(signature);

    if (isMakerAskTakerBid) return { makerAsk: makerOrder, takerBid: takerOrder, signature };
    else return { makerBid: makerOrder, takerAsk: takerOrder, signature };
  };

  before(async () => {
    [owner, account1, account2] = await ethers.getSigners();

    strategyStandardSaleForFixedPrice = await (
      await ethers.getContractFactory("StrategyStandardSaleForFixedPrice")
    ).deploy(0);
    await strategyStandardSaleForFixedPrice.deployed();

    strategyAnyItemFromCollectionForFixedPrice = await (
      await ethers.getContractFactory(
        "StrategyAnyItemFromCollectionForFixedPrice"
      )
    ).deploy(0);
    await strategyAnyItemFromCollectionForFixedPrice.deployed();

    strategyPrivateSale = await (
      await ethers.getContractFactory("StrategyPrivateSale")
    ).deploy(0);
    await strategyPrivateSale.deployed();

    currencyManager = await (
      await ethers.getContractFactory("CurrencyManager")
    ).deploy();
    await currencyManager.deployed();

    await currencyManager.addCurrency(weth);
    await currencyManager.addCurrency(dai);

    executionManager = await (
      await ethers.getContractFactory("ExecutionManager")
    ).deploy();
    await executionManager.deployed();

    await executionManager.addStrategy(
      strategyStandardSaleForFixedPrice.address
    );
    await executionManager.addStrategy(
      strategyAnyItemFromCollectionForFixedPrice.address
    );
    await executionManager.addStrategy(strategyPrivateSale.address);

    royaltyFeeRegistry = await (
      await ethers.getContractFactory("RoyaltyFeeRegistry")
    ).deploy(ethers.utils.parseUnits("2000", 0));
    await royaltyFeeRegistry.deployed();

    royaltyFeeSetter = await (
      await ethers.getContractFactory("RoyaltyFeeSetter")
    ).deploy(royaltyFeeRegistry.address);
    await royaltyFeeSetter.deployed();

    await royaltyFeeRegistry.transferOwnership(royaltyFeeSetter.address);

    royaltyFeeManager = await (
      await ethers.getContractFactory("RoyaltyFeeManager")
    ).deploy(royaltyFeeRegistry.address);
    await royaltyFeeManager.deployed();

    transferManagerERC721 = await (
      await ethers.getContractFactory("TransferManagerERC721")
    ).deploy();
    await transferManagerERC721.deployed();

    transferManagerERC1155 = await (
      await ethers.getContractFactory("TransferManagerERC1155")
    ).deploy();
    await transferManagerERC1155.deployed();

    transferManagerNonCompliantERC721 = await (
      await ethers.getContractFactory("TransferManagerNonCompliantERC721")
    ).deploy();
    await transferManagerNonCompliantERC721.deployed();

    transferSelectorNFT = await (
      await ethers.getContractFactory("TransferSelectorNFT")
    ).deploy(transferManagerERC721.address, transferManagerERC1155.address);
    await transferSelectorNFT.deployed();

    booksRareExchange = await (
      await ethers.getContractFactory("BooksRareExchange")
    ).deploy(
      currencyManager.address,
      executionManager.address,
      royaltyFeeManager.address,
      transferSelectorNFT.address,
      weth,
      owner.address
    );
    await booksRareExchange.deployed();

    transferManagerERC721.transferOwnership(booksRareExchange.address);
    transferManagerERC1155.transferOwnership(booksRareExchange.address);
    transferManagerNonCompliantERC721.transferOwnership(
      booksRareExchange.address
    );
  });

  // make -> edit -> fulfil -> delete

  //cancelAllOrdersForSender
  //cancelMultipleMakerOrders
  //matchAskWithTakerBidUsingETHAndWETH
  //matchAskWithTakerBid
  //matchBidWithTakerAsk

  it("Should pass: Match signed maker ask with taker bid", async () => {
    const { makerAsk, takerBid, signature } = await createMatchingMakerAndTakerOrder(true);

    const tx = booksRareExchange.connect(account1).matchAskWithTakerBid(takerBid, makerAsk);

    await expect(tx).to.be.revertedWith("Signature_Invalid");
  });
});
