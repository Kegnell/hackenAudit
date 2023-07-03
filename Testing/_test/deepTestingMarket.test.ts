import { ethers } from "hardhat";
import chai from "chai";
import { TestERC20 } from "../typechain-types";
import { Market } from "../typechain-types";
import { TestMaster } from "../typechain-types";
import { BigNumber } from "ethers";

const { expect } = chai;

describe("Deep: Market", function () {
  this.timeout(3000000000);
  let amt: TestERC20;
  let btcb: TestERC20;
  let usdt: TestERC20;
  let market: Market;
  let masterTrucho: TestMaster;
  let currentRate = 35; // 1 AMT = 0.35 USDT
  let currentFee = 10; // 1%
  let deepnes = 40;
  beforeEach(async function () {
    this.timeout(3000000);
    const [owner] = await ethers.getSigners();
    const addresses = await ethers.getSigners(); // addresses[0] owner
    const Btcb = await ethers.getContractFactory("TestERC20");
    btcb = (await Btcb.deploy("10000000000000000000")) as TestERC20;
    await btcb.deployed();

    const Amt = await ethers.getContractFactory("TestERC20");
    amt = (await Amt.deploy("10000000000000000000")) as TestERC20;
    await amt.deployed();

    const Usdt = await ethers.getContractFactory("TestERC20");
    usdt = (await Usdt.deploy("10000000000000000000")) as TestERC20;
    await usdt.deployed();

    const MasterTrucho = await ethers.getContractFactory("TestMaster");
    masterTrucho = (await MasterTrucho.deploy(btcb.address)) as TestMaster;
    await masterTrucho.deployed();

    const Market = await ethers.getContractFactory("Market");
    market = (await Market.deploy(
      currentRate, //Rate price per 1 amt = 0.35 usdt
      owner.address,
      currentFee, // 1% fee
      btcb.address,
      amt.address,
      usdt.address,
      masterTrucho.address
    )) as Market;
    await market.deployed();

    //Send tokens to contracts to operate
    await usdt.transfer(market.address, 100);
    await amt.transfer(market.address, 100);
    await btcb.transfer(masterTrucho.address, 10000);

    //Send tokens to addresses to operate and approves
    for (let i = 1; i < 100; i++) {
      await usdt.transfer(addresses[i].address, 100);
      await amt.transfer(addresses[i].address, 100);
      await usdt
        .connect(addresses[i])
        .approve(market.address, "9999999999999999999999999");
      await amt
        .connect(addresses[i])
        .approve(market.address, "9999999999999999999999999");
    }
    console.log("Before each hook finished");
  });

  it("Multiple events on the market", async () => {
    this.timeout(3000000);
    const addresses = await ethers.getSigners(); // addresses[0] owner
    let counterBuys = 0;
    let counterSells = 0;
    let counterRevertsNotEnougthAmt = 0;
    let counterRevertsNotEnougthUsdt = 0;
    let counterRevertsNotEnougthUsdtSell = 0;
    let counterRevertsNotEnougthAmtSell = 0;
    for (let i = 0; i < deepnes; i++) {
      console.log(i);
      //0 buy event
      //1 sell event
      let events = Array.from({ length: 100 }, () =>
        Math.floor(Math.random() * 2)
      );
      for (let j = 1; j < 100; j++) {
        let randomValue = Math.floor(Math.random() * 10) + 1; //To buy or sell
        //Buy event
        if (events[j] == 0) {
          const usdtToSend = BigNumber.from(randomValue);
          const expectedAmtToRecive = usdtToSend.mul(100).div(currentRate);
          if ((await usdt.balanceOf(addresses[j].address)).lt(usdtToSend)) {
            await expect(
              market.connect(addresses[j]).buy(usdtToSend)
            ).to.revertedWith("User doesnt have enough USDT");
            counterRevertsNotEnougthUsdt++;
            await usdt.transfer(addresses[j].address, 100);
          } else if (
            expectedAmtToRecive.gt(await amt.balanceOf(market.address))
          ) {
            await expect(
              market.connect(addresses[j]).buy(usdtToSend)
            ).to.revertedWith("Market doesnt have enough AMT");
            counterRevertsNotEnougthAmt++;
            await amt.transfer(market.address, 100);
          } else {
            await expect(market.connect(addresses[j]).buy(usdtToSend))
              .to.changeTokenBalances(
                amt,
                [addresses[j].address, market.address],
                [expectedAmtToRecive, -expectedAmtToRecive]
              )
              .and.to.changeTokenBalances(
                usdt,
                [addresses[0].address, addresses[j].address],
                [usdtToSend, -usdtToSend]
              );
            counterBuys++;
          }
        }
        //Sell event
        if (events[j] == 1) {
          const amtToSend = BigNumber.from(randomValue);
          const expectedUsdtToRecive = amtToSend
            .mul(currentRate)
            .div(100)
            .mul(1000 - currentFee)
            .div(1000);
          if (expectedUsdtToRecive.gt(await usdt.balanceOf(market.address))) {
            await expect(market.sell(amtToSend)).to.revertedWith(
              "Market doesnt have enough USDT"
            );
            counterRevertsNotEnougthUsdtSell++;
            await usdt.transfer(market.address, 100);
          } else if (amtToSend.gt(await amt.balanceOf(addresses[j].address))) {
            await expect(market.sell(amtToSend)).to.revertedWith(
              "User doesnt have enough AMT"
            );
            counterRevertsNotEnougthAmtSell++;
            await amt.transfer(addresses[j].address, 100);
          } else {
            await expect(market.connect(addresses[j]).sell(amtToSend))
              .to.changeTokenBalances(
                amt,
                [addresses[j].address, addresses[0].address],
                [-amtToSend, amtToSend]
              )
              .and.to.changeTokenBalances(
                usdt,
                [addresses[j].address, market.address],
                [expectedUsdtToRecive, -expectedUsdtToRecive]
              );
            counterSells++;
          }
        }
      }
    }
    console.log("Test finished testing with: ");
    console.log("Buys: " + counterBuys);
    console.log("Sells: " + counterSells);
    console.log(
      "BUY: Reverted by not enought amt: " + counterRevertsNotEnougthAmt
    );
    console.log(
      "BUY: Reverted by not enought usdt: " + counterRevertsNotEnougthUsdt
    );
    console.log(
      "SELL: Reverted by not enougth amt: " + counterRevertsNotEnougthAmtSell
    );
    console.log(
      "SELL: Reverted by not enougth usdt: " + counterRevertsNotEnougthUsdtSell
    );
  });
});
