const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Currency Manager", function () {
  let currencyManager, currencies;

  before(async () => {
    const CurrencyManager = await ethers.getContractFactory("CurrencyManager");
    currencyManager = await CurrencyManager.deploy();
    await currencyManager.deployed();

    const MockErc20 = await ethers.getContractFactory("MockErc20");

    currencies = await Promise.all([MockErc20.deploy(), MockErc20.deploy(), MockErc20.deploy()]);
    await Promise.all(currencies.map(c=>c.deployed()));
    currencies = currencies.map(c=>c.address);
  });

  it("SBA2 add currencies to whitelist ", async function () {
    // Add currencies, check whether currencies are whitelisted, confirm whitelist elements and count
    await Promise.all(currencies.map(c => {
      currencyManager.addCurrency(c);
    }));

    const wl = await currencyManager.viewWhitelistedCurrencies();
    const wlCurrencies = wl[0];
    const wlCurrenciesCount = wl[1];

    expect(currencies.every((c)=>wlCurrencies.includes(c) && currencies.length===wlCurrencies.length)).to.be.true;

    currencies.map(async c => {
      expect(await currencyManager.isCurrencyWhitelisted(c)).to.be.true;
    });

    expect(await currencyManager.viewCountWhitelistedCurrencies()).to.be.equal(currencies.length).to.be.equal(wlCurrencies.length).to.be.equal(wlCurrenciesCount);
  })

  it("SBA2 remove a currency from whitelist", async function () {
    currencies.map(async c=>{
      await currencyManager.removeCurrency(c);
      expect(await currencyManager.isCurrencyWhitelisted(c)).to.be.false;
    })

    expect(await currencyManager.viewCountWhitelistedCurrencies()).to.be.equal(0);
  });
});
