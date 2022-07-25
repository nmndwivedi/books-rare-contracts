const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const {
  toBytes32,
  setStorageAt,
  getStorageAt,
} = require("./utils/storageManipulator");
const { address: wethAddress, abi: wethAbi } = require("./constants/weth");
const { address: daiAddress, abi: daiAbi } = require("./constants/dai");
const {
  address: boredApeAddress,
  abi: boredApeAbi,
} = require("./constants/boredApe");
const { address: azukiAddress, abi: azukiAbi } = require("./constants/azuki");

describe("BooksRare Exchange", function () {
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
    wethContract,
    daiContract,
    boredApeContract;

  let nonce = 0;

  const createMatchingMakerAndTakerOrder = async (
    isMakerAskTakerBid,
    minPercentageToAsk = 9000
  ) => {
    let apeOwner = await boredApeContract.ownerOf("10");

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [apeOwner],
    });

    let apeOwnerSigner = await ethers.provider.getSigner(apeOwner);

    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
    const currentTimestamp = currentBlock.timestamp;

    let startTime = currentTimestamp;
    let seconds = 1000;
    let endTime = startTime + seconds;

    // maker will always be the owner account
    let makerOrder = {
      isOrderAsk: isMakerAskTakerBid,
      signer: owner.address,
      collection: boredApeAddress,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      amount: 1,
      strategy: strategyStandardSaleForFixedPrice.address,
      currency: wethAddress,
      nonce: nonce++,
      startTime,
      endTime,
      minPercentageToAsk,
      params: [],
    };

    let takerOrder = {
      isOrderAsk: !isMakerAskTakerBid,
      taker: account1.address,
      price: ethers.utils.parseEther("2"),
      tokenId: 10,
      minPercentageToAsk,
      params: [],
    };

    const domain = {
      name: "BooksRareExchange",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: booksRareExchange.address,
    };

    const types = {
      MakerOrder: [
        { name: "isOrderAsk", type: "bool" },
        { name: "signer", type: "address" },
        { name: "collection", type: "address" },
        { name: "price", type: "uint256" },
        { name: "tokenId", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "strategy", type: "address" },
        { name: "currency", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "minPercentageToAsk", type: "uint256" },
        { name: "params", type: "bytes" },
      ],
    };

    await boredApeContract
      .connect(apeOwnerSigner)
      .transferFrom(
        apeOwner,
        isMakerAskTakerBid ? owner.address : account1.address,
        10
      );
    await boredApeContract
      .connect(isMakerAskTakerBid ? owner : account1)
      .setApprovalForAll(transferManagerERC721.address, true);

    const signature = await owner._signTypedData(domain, types, makerOrder);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    makerOrder.v = v;
    makerOrder.r = r;
    makerOrder.s = s;

    if (isMakerAskTakerBid)
      return { makerAsk: makerOrder, takerBid: takerOrder, signature };
    else return { makerBid: makerOrder, takerAsk: takerOrder, signature };
  };

  before(async () => {
    [owner, account1, account2] = await ethers.getSigners();

    strategyStandardSaleForFixedPrice = await (
      await ethers.getContractFactory("StrategyStandardSaleForFixedPrice")
    ).deploy(99);
    await strategyStandardSaleForFixedPrice.deployed();

    strategyAnyItemFromCollectionForFixedPrice = await (
      await ethers.getContractFactory(
        "StrategyAnyItemFromCollectionForFixedPrice"
      )
    ).deploy(ethers.utils.parseEther("100"));
    await strategyAnyItemFromCollectionForFixedPrice.deployed();

    strategyPrivateSale = await (
      await ethers.getContractFactory("StrategyPrivateSale")
    ).deploy(ethers.utils.parseEther("100"));
    await strategyPrivateSale.deployed();

    currencyManager = await (
      await ethers.getContractFactory("CurrencyManager")
    ).deploy();
    await currencyManager.deployed();

    await currencyManager.addCurrency(wethAddress);
    await currencyManager.addCurrency(daiAddress);

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
      wethAddress,
      account2.address
    );
    await booksRareExchange.deployed();

    transferManagerERC721.transferOwnership(booksRareExchange.address);
    transferManagerERC1155.transferOwnership(booksRareExchange.address);
    transferManagerNonCompliantERC721.transferOwnership(
      booksRareExchange.address
    );

    wethContract = await ethers.getContractAt(wethAbi, wethAddress);
    daiContract = await ethers.getContractAt(daiAbi, daiAddress);
    boredApeContract = await ethers.getContractAt(boredApeAbi, boredApeAddress);
  });

  // make -> edit -> fulfil -> delete

  it("Should pass: Match signed maker ask with taker bid", async () => {
    const { makerAsk, takerBid } = await createMatchingMakerAndTakerOrder(true);

    const index = ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [account1.address, 3] // key, slot
    );

    await setStorageAt(
      wethAddress,
      index,
      toBytes32(ethers.utils.parseEther("200"))
    );
    const bal = await getStorageAt(wethAddress, index);

    expect(parseInt(bal, 16) / 10 ** 18).to.be.eq(200);

    await wethContract
      .connect(account1)
      .approve(booksRareExchange.address, ethers.utils.parseEther("200"));

    const tx = await booksRareExchange
      .connect(account1)
      .matchAskWithTakerBid(takerBid, makerAsk);

    const newOwner = await boredApeContract.ownerOf(10);
    const newBalanceBuyer = ethers.utils.formatEther(
      await wethContract.balanceOf(account1.address)
    );

    const MAKER_ORDER_HASH =
      "0x40261ade532fa1d2c7293df30aaadb9b3c616fae525a0b56d3d411c841a85028";

    const orderHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        [
          "bytes32",
          "bool",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "bytes32",
        ],
        [
          MAKER_ORDER_HASH,
          makerAsk.isOrderAsk,
          makerAsk.signer,
          makerAsk.collection,
          makerAsk.price,
          makerAsk.tokenId,
          makerAsk.amount,
          makerAsk.strategy,
          makerAsk.currency,
          makerAsk.nonce,
          makerAsk.startTime,
          makerAsk.endTime,
          makerAsk.minPercentageToAsk,
          ethers.utils.keccak256(makerAsk.params),
        ]
      )
    );

    let receipt = await tx.wait();

    expect(receipt.events[3].args[0]).to.eq(orderHash);
    expect(newOwner).to.be.eq(account1.address);
    expect(newBalanceBuyer).to.be.eq("198.0");
  });

  // Failures to test: invalid signature,

  it("Should fail: Match signed maker ask with taker bid with expired bid time", async () => {
    const { makerAsk, takerBid } = await createMatchingMakerAndTakerOrder(true);

    const index = ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [account1.address, 3] // key, slot
    );

    await setStorageAt(
      wethAddress,
      index,
      toBytes32(ethers.utils.parseEther("200"))
    );
    const bal = await getStorageAt(wethAddress, index);

    expect(parseInt(bal, 16) / 10 ** 18).to.be.eq(200);

    await wethContract
      .connect(account1)
      .approve(booksRareExchange.address, ethers.utils.parseEther("200"));

    await moveTime(1001); //Fail due to order expiry

    const tx = booksRareExchange
      .connect(account1)
      .matchAskWithTakerBid(takerBid, makerAsk);

    await expect(tx).to.be.revertedWith("Strategy_ExecutionInvalid");
  });

  // it("Should fail: Match signed maker ask with taker bid with minPercentageToAsk greater than protocolFee", async () => {
  //   const { makerAsk, takerBid } = await createMatchingMakerAndTakerOrder(true, 9900);

  //   const index = ethers.utils.solidityKeccak256(
  //     ["uint256", "uint256"],
  //     [account1.address, 3] // key, slot
  //   )

  //   await setStorageAt(wethAddress, index, toBytes32(ethers.utils.parseEther('200')));
  //   const bal = await getStorageAt(wethAddress, index);

  //   expect(parseInt(bal, 16) / 10 ** 18).to.be.eq(200);

  //   await wethContract.connect(account1).approve(booksRareExchange.address, ethers.utils.parseEther('200'));

  //   await moveTime(1001); //Fail due to order expiry

  //   const tx = booksRareExchange.connect(account1).matchAskWithTakerBid(takerBid, makerAsk);

  //   await expect(tx).to.be.revertedWith('Fees_HigherThanExpected');
  // });

  it("Should pass: Match signed maker bid with taker ask", async () => {
    const { makerBid, takerAsk } = await createMatchingMakerAndTakerOrder(
      false
    );

    const index = ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [owner.address, 3] // key, slot
    );

    await setStorageAt(
      wethAddress,
      index,
      toBytes32(ethers.utils.parseEther("200"))
    );
    const bal = await getStorageAt(wethAddress, index);

    expect(parseInt(bal, 16) / 10 ** 18).to.be.eq(200);

    await wethContract
      .connect(owner)
      .approve(booksRareExchange.address, ethers.utils.parseEther("200"));

    const tx = await booksRareExchange
      .connect(account1)
      .matchBidWithTakerAsk(takerAsk, makerBid);

    const newOwner = await boredApeContract.ownerOf(10);
    const newBalanceBuyer = ethers.utils.formatEther(
      await wethContract.balanceOf(owner.address)
    );

    const MAKER_ORDER_HASH =
      "0x40261ade532fa1d2c7293df30aaadb9b3c616fae525a0b56d3d411c841a85028";

    const orderHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        [
          "bytes32",
          "bool",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "bytes32",
        ],
        [
          MAKER_ORDER_HASH,
          makerBid.isOrderAsk,
          makerBid.signer,
          makerBid.collection,
          makerBid.price,
          makerBid.tokenId,
          makerBid.amount,
          makerBid.strategy,
          makerBid.currency,
          makerBid.nonce,
          makerBid.startTime,
          makerBid.endTime,
          makerBid.minPercentageToAsk,
          ethers.utils.keccak256(makerBid.params),
        ]
      )
    );

    let receipt = await tx.wait();

    expect(receipt.events[3].args[0]).to.eq(orderHash);
    expect(newOwner).to.be.eq(owner.address);
    expect(newBalanceBuyer).to.be.eq("198.0");
  });

  it("Should fail: Match signed maker bid with taker ask with expired bid time", async () => {
    const { makerBid, takerAsk } = await createMatchingMakerAndTakerOrder(
      false
    );

    const index = ethers.utils.solidityKeccak256(
      ["uint256", "uint256"],
      [owner.address, 3] // key, slot
    );

    await setStorageAt(
      wethAddress,
      index,
      toBytes32(ethers.utils.parseEther("200"))
    );
    const bal = await getStorageAt(wethAddress, index);

    expect(parseInt(bal, 16) / 10 ** 18).to.be.eq(200);

    await wethContract
      .connect(owner)
      .approve(booksRareExchange.address, ethers.utils.parseEther("200"));

    await moveTime(1001); //Fail due to order expiry

    const tx = booksRareExchange
      .connect(account1)
      .matchBidWithTakerAsk(takerAsk, makerBid);

    await expect(tx).to.be.revertedWith("Strategy_ExecutionInvalid");
  });
});
