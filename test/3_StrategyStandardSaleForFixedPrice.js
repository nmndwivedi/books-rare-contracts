const { expect } = require("chai");
const { Contract } = require("ethers");
const { ethers, network } = require("hardhat");

const { moveBlocks, moveTime } = require("./utils/move");
const { numToHex, hexToNum } = require("./utils/hex");
const { address: boredApeAddress, abi: boredApeAbi } = require("./constants/boredApe");

describe("Strategy Standard Sale For Fixed Price", function () {
  // Deploy contract
  let strategyStandardSaleForFixedPrice, owner, account1;

  const createMatchingMakerAndTakerOrder = async (isMakerAskTakerBid) => {
    const sig = await owner.signMessage(
        "This is a random string, because we are not using the signature in this contract"
      );
      const { v, r, s } = ethers.utils.splitSignature(sig);

      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
      const currentTimestamp = currentBlock.timestamp;

      let startTime = currentTimestamp;
      let seconds = 1000;
      let endTime = startTime + seconds;

      let makerOrder = {
        isOrderAsk: !!isMakerAskTakerBid,
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

      let takerOrder = {
        isOrderAsk: !isMakerAskTakerBid,
        taker: account1.address,
        price: ethers.utils.parseEther("2"),
        tokenId: 10,
        minPercentageToAsk: 9000,
        params: [],
      };

      if (isMakerAskTakerBid) return { makerAsk: makerOrder, takerBid: takerOrder };
      else return { makerBid: makerOrder, takerAsk: takerOrder };
  }

  before(async () => {
    [owner, account1] = await ethers.getSigners();

    await network.provider.send("hardhat_setBalance", [
      owner.address,
      numToHex(3424418825043170000),
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
    const { makerAsk, takerBid } = await createMatchingMakerAndTakerOrder(true);

    let match = await strategyStandardSaleForFixedPrice.canExecuteTakerBid(
      takerBid,
      makerAsk
    );

    expect(match[0]).to.be.true;
    expect(ethers.utils.formatUnits(match[1], 0)).to.be.equal("10");
  });

  it("Should fail: taker bid: expired maker ask", async function () {
    // same order set, but pass blocks ahead of order expiration - test fail
    const { makerAsk, takerBid } = await createMatchingMakerAndTakerOrder(true);

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
    const { makerBid, takerAsk } = await createMatchingMakerAndTakerOrder(false);

    let match = await strategyStandardSaleForFixedPrice.canExecuteTakerAsk(
      takerAsk,
      makerBid
    );

    expect(match[0]).to.be.true;
    expect(ethers.utils.formatUnits(match[1], 0)).to.be.equal("10");
  });

  it("Should fail: taker ask: expired maker bid", async function () {
    const { makerBid, takerAsk } = await createMatchingMakerAndTakerOrder(false);

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
