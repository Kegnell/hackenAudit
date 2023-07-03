import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import chai from "chai";
import { TestERC20 } from "../typechain-types";
import { SharesVault } from "../typechain-types";
import { TestSwapper } from "../typechain-types";
import { TestMaster } from "../typechain-types";
import { PagosAutomConRecompra } from "../typechain-types";
const { expect } = chai;

describe("Deep testing for sharesVault and PagosAutomConRecompra", function () {
  const deepnes = 1000; //amount of iteration of events
  let btcb: TestERC20;
  let amt: TestERC20;
  let sharesVault: SharesVault;
  let swapperTrucho: TestSwapper;
  let pagosAutomConRecompra: PagosAutomConRecompra;
  let masterTrucho: TestMaster;
  beforeEach(async function () {
    const [owner, serverWallet, beneficiary] = await ethers.getSigners();

    const Btcb = await ethers.getContractFactory("TestERC20");
    btcb = (await Btcb.deploy(1000000000000)) as TestERC20;
    await btcb.deployed();

    const Amt = await ethers.getContractFactory("TestERC20");
    amt = (await Amt.deploy(54000000000)) as TestERC20;
    await amt.deployed();

    const SharesVault = await ethers.getContractFactory("SharesVault");
    sharesVault = (await SharesVault.deploy(
      beneficiary.address,
      btcb.address
    )) as SharesVault;
    await sharesVault.deployed();

    const SwapperTrucho = await ethers.getContractFactory("TestSwapper");
    swapperTrucho = (await SwapperTrucho.deploy(
      btcb.address,
      amt.address
    )) as TestSwapper;
    await swapperTrucho.deployed();

    const MasterTrucho = await ethers.getContractFactory("TestMaster");
    masterTrucho = (await MasterTrucho.deploy(btcb.address)) as TestMaster;
    await masterTrucho.deployed();
    const PagosAutomConRecompra = await ethers.getContractFactory(
      "PagosAutomConRecompra"
    );
    pagosAutomConRecompra = (await PagosAutomConRecompra.deploy(
      sharesVault.address,
      btcb.address,
      amt.address,
      masterTrucho.address,
      swapperTrucho.address
    )) as PagosAutomConRecompra;
    await pagosAutomConRecompra.deployed();
    await sharesVault.setDepositMaker(pagosAutomConRecompra.address);
    await amt.transfer(swapperTrucho.address, 10000000); //Send to swapper to check swap operations
    await btcb.transfer(masterTrucho.address, 10000000); //Send to master to check charge operations
    await btcb
      .connect(serverWallet)
      .approve(pagosAutomConRecompra.address, "999999999999999999999999999");
  });

  it("Multiple random events DEPOSIT CHARGE WITHDRAW and final withdraw", async function () {
    this.timeout((deepnes / 1000) * 90000); // Each 1000 iteration 90000 (90s) of test timeout
    const [owner, serverWallet, beneficiary] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    let totalBtcbToWithdraw = BigNumber.from(0);
    //0 deposit event
    //1 charge event
    //2 withdraw
    let events = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 3)
    );
    for (let i = 0; i < events.length; i++) {
      let randomValue = Math.floor(Math.random() * 10) + 1;
      if (events[i] == 0) {
        await pagosAutomConRecompra.connect(serverWallet).deposit(randomValue);
        totalBtcbToWithdraw = totalBtcbToWithdraw.add(randomValue);
      }
      if (events[i] == 1) {
        await pagosAutomConRecompra.connect(serverWallet).charge(0);
      }
      if (events[i] == 2) {
        await expect(
          sharesVault.connect(beneficiary).withdraw()
        ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);
        totalBtcbToWithdraw = BigNumber.from(0);
      }
    }
    await expect(
      sharesVault.connect(beneficiary).withdraw
    ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);
  });

  it("Multiple swaps from different sources", async function () {
    this.timeout((deepnes / 1000) * 90000); // Each 1000 iteration 90000 (90s) of test timeout
    const [owner, serverWallet, beneficiary] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 10000000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    let totalBtcbToWithdraw = BigNumber.from(0);
    let totalAmtForAdminToWithdraw = BigNumber.from(0);
    //0 deposit & swap event
    //1 charge & swap event
    //2 withdraw

    let events = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 3)
    );
    for (let i = 0; i < events.length; i++) {
      let randomValue = Math.floor(Math.random() * 10) + 1;
      if (events[i] == 0) {
        await pagosAutomConRecompra.connect(serverWallet).deposit(randomValue);
        totalBtcbToWithdraw = totalBtcbToWithdraw.add(randomValue);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(randomValue, false);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          randomValue * 2
        );
      }
      if (events[i] == 1) {
        const btcbBefore = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra.connect(serverWallet).charge(0);
        const btcbAfter = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(btcbAfter.sub(btcbBefore), true);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          btcbAfter.sub(btcbBefore).mul(2)
        );
      }
      if (events[i] == 2) {
        await expect(
          sharesVault.connect(beneficiary).withdraw()
        ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);
        totalBtcbToWithdraw = BigNumber.from(0);
      }
    }
    await expect(
      sharesVault.connect(beneficiary).withdraw
    ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);

    await expect(pagosAutomConRecompra.withdrawAll()).to.changeTokenBalance(
      amt,
      owner.address,
      totalAmtForAdminToWithdraw
    );
  });

  it("Check event consistency", async function () {
    this.timeout((deepnes / 1000) * 1100000); // Each 1000 iteration 1100000 (90s) of test timeout
    const [owner, serverWallet, beneficiary] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    let totalBtcbToWithdraw = BigNumber.from(0);
    let totalAmtForAdminToWithdraw = BigNumber.from(0);
    //0 deposit & swap event
    //1 charge & swap event
    let events = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 2)
    );
    for (let i = 0; i < events.length; i++) {
      let randomValue = Math.floor(Math.random() * 10) + 1;
      if (events[i] == 0) {
        await pagosAutomConRecompra.connect(serverWallet).deposit(randomValue);
        totalBtcbToWithdraw = totalBtcbToWithdraw.add(randomValue);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(randomValue, false);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          randomValue * 2
        );
      }
      if (events[i] == 1) {
        const btcbBefore = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra.connect(serverWallet).charge(0);
        const btcbAfter = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(btcbAfter.sub(btcbBefore), true);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          btcbAfter.sub(btcbBefore).mul(2)
        );
      }
    }

    //Event checking
    const chargeFilter = pagosAutomConRecompra.filters.charged(null, null);
    const chargeEvents = await pagosAutomConRecompra.queryFilter(chargeFilter);

    const depositMadeFilter = pagosAutomConRecompra.filters.depositMade(null);
    const depositMadeEvents = await pagosAutomConRecompra.queryFilter(
      depositMadeFilter
    );

    const swapMadeFilter = pagosAutomConRecompra.filters.swapMade(null, null);
    const swapMadeEvents = await pagosAutomConRecompra.queryFilter(
      swapMadeFilter
    );

    let btcbToWithdrawlByEventData = BigNumber.from(0);
    for (let i = 0; i < depositMadeEvents.length; i++) {
      btcbToWithdrawlByEventData = btcbToWithdrawlByEventData.add(
        depositMadeEvents[i].args.amount
      );
    }
    await expect(
      sharesVault.connect(beneficiary).withdraw()
    ).to.changeTokenBalance(
      btcb,
      beneficiary.address,
      btcbToWithdrawlByEventData
    );

    let amtToWithdrawlByEventData = BigNumber.from(0);
    for (let i = 0; i < swapMadeEvents.length; i++) {
      amtToWithdrawlByEventData = amtToWithdrawlByEventData.add(
        swapMadeEvents[i].args.amtRecived
      );
    }
    await expect(pagosAutomConRecompra.withdrawAll()).to.changeTokenBalance(
      amt,
      owner.address,
      amtToWithdrawlByEventData
    );
  });

  it("Check direct transfers of both tokens  to shares vault", async function () {
    this.timeout((deepnes / 1000) * 90000); // Each 1000 iteration 90000 (90s) of test timeout
    const [owner, serverWallet, beneficiary, directTransferer] =
      await ethers.getSigners();
    await btcb.transfer(directTransferer.address, 10000);
    await amt.transfer(directTransferer.address, 10000);
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 10000000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    let totalBtcbToWithdraw = BigNumber.from(0);
    let totalAmtForAdminToWithdraw = BigNumber.from(0);

    //0 deposit & swap event
    //1 charge & swap event
    //2 withdraw
    let events = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 3)
    );
    //0 no direct transfer
    //1 btcb direct transfer
    //2 amt direct transfer
    let directTransferEvents = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 3)
    );
    for (let i = 0; i < events.length; i++) {
      if (directTransferEvents[i] == 1) {
        let randomValueToDirectTransfer = Math.floor(Math.random() * 5) + 1;
        await btcb
          .connect(directTransferer)
          .transfer(sharesVault.address, randomValueToDirectTransfer);
        totalBtcbToWithdraw = totalBtcbToWithdraw.add(
          randomValueToDirectTransfer
        );
      }
      if (directTransferEvents[i] == 2) {
        let randomValueToDirectTransfer = Math.floor(Math.random() * 5) + 1;
        await amt
          .connect(directTransferer)
          .transfer(sharesVault.address, randomValueToDirectTransfer);
      }
      let randomValue = Math.floor(Math.random() * 10) + 1;
      if (events[i] == 0) {
        await pagosAutomConRecompra.connect(serverWallet).deposit(randomValue);
        totalBtcbToWithdraw = totalBtcbToWithdraw.add(randomValue);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(randomValue, false);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          randomValue * 2
        );
      }
      if (events[i] == 1) {
        const btcbBefore = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra.connect(serverWallet).charge(0);
        const btcbAfter = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(btcbAfter.sub(btcbBefore), true);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          btcbAfter.sub(btcbBefore).mul(2)
        );
      }
      if (events[i] == 2) {
        await expect(
          sharesVault.connect(beneficiary).withdraw()
        ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);
        totalBtcbToWithdraw = BigNumber.from(0);
      }
    }
    await expect(
      sharesVault.connect(beneficiary).withdraw
    ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);

    await expect(pagosAutomConRecompra.withdrawAll()).to.changeTokenBalance(
      amt,
      owner.address,
      totalAmtForAdminToWithdraw
    );
  });

  it("Check direct transfers of both tokens  to pagosAutomConRecompra", async function () {
    this.timeout((deepnes / 1000) * 110000); // Each 1000 iteration 90000 (90s) of test timeout
    const [owner, serverWallet, beneficiary, directTransferer] =
      await ethers.getSigners();
    await btcb.transfer(directTransferer.address, 10000);
    await amt.transfer(directTransferer.address, 10000);
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 10000000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    let totalBtcbToWithdraw = BigNumber.from(0);
    let totalAmtForAdminToWithdraw = BigNumber.from(0);

    //0 deposit & swap event
    //1 charge & swap event
    //2 withdraw
    let events = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 3)
    );
    //0 no direct transfer
    //1 btcb direct transfer
    //2 amt direct transfer
    let directTransferEvents = Array.from({ length: deepnes }, () =>
      Math.floor(Math.random() * 3)
    );
    for (let i = 0; i < events.length; i++) {
      if (directTransferEvents[i] == 1) {
        let randomValueToDirectTransfer = Math.floor(Math.random() * 5) + 1;
        await btcb
          .connect(directTransferer)
          .transfer(pagosAutomConRecompra.address, randomValueToDirectTransfer);
      }
      if (directTransferEvents[i] == 2) {
        let randomValueToDirectTransfer = Math.floor(Math.random() * 5) + 1;
        await amt
          .connect(directTransferer)
          .transfer(pagosAutomConRecompra.address, randomValueToDirectTransfer);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          randomValueToDirectTransfer
        );
      }
      let randomValue = Math.floor(Math.random() * 10) + 1;
      if (events[i] == 0) {
        await pagosAutomConRecompra.connect(serverWallet).deposit(randomValue);
        totalBtcbToWithdraw = totalBtcbToWithdraw.add(randomValue);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(randomValue, false);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          randomValue * 2
        );
      }
      if (events[i] == 1) {
        const btcbBefore = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra.connect(serverWallet).charge(0);
        const btcbAfter = await btcb.balanceOf(pagosAutomConRecompra.address);
        await pagosAutomConRecompra
          .connect(serverWallet)
          .swap(btcbAfter.sub(btcbBefore), true);
        totalAmtForAdminToWithdraw = totalAmtForAdminToWithdraw.add(
          btcbAfter.sub(btcbBefore).mul(2)
        );
      }
      if (events[i] == 2) {
        await expect(
          sharesVault.connect(beneficiary).withdraw()
        ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);
        totalBtcbToWithdraw = BigNumber.from(0);
      }
    }
    await expect(
      sharesVault.connect(beneficiary).withdraw
    ).to.changeTokenBalance(btcb, beneficiary.address, totalBtcbToWithdraw);

    await expect(pagosAutomConRecompra.withdrawAll()).to.changeTokenBalance(
      amt,
      owner.address,
      totalAmtForAdminToWithdraw
    );
  });
});
