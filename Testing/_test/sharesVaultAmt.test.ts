import { ethers } from "hardhat";
import chai from "chai";
import { TestERC20 } from "../typechain-types";
import { SharesVaultAmt } from "../typechain-types";
import { TestSwapper } from "../typechain-types";
import { TestMaster } from "../typechain-types";
import { PagosAutomMiners } from "../typechain-types";
const { expect } = chai;

describe("ShareVaultAmt", function () {
  let amt: TestERC20;
  let btcb: TestERC20;
  let sharesVaultAmt: SharesVaultAmt;
  let swapperTrucho: TestSwapper;
  let masterTrucho: TestMaster;
  let pagosAutomMiners: PagosAutomMiners;

  this.beforeEach(async function () {
    this.timeout(300000);
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();

    const Btcb = await ethers.getContractFactory("TestERC20");
    btcb = (await Btcb.deploy(1000000000)) as TestERC20;
    await btcb.deployed();

    const Amt = await ethers.getContractFactory("TestERC20");
    amt = (await Amt.deploy(54000000)) as TestERC20;
    await amt.deployed();

    const SwapperTrucho = await ethers.getContractFactory("TestSwapper");
    swapperTrucho = (await SwapperTrucho.deploy(
      btcb.address,
      amt.address
    )) as TestSwapper;
    await swapperTrucho.deployed();

    const MasterTrucho = await ethers.getContractFactory("TestMaster");
    masterTrucho = (await MasterTrucho.deploy(btcb.address)) as TestMaster;
    await masterTrucho.deployed();

    const SharesVaultAmt = await ethers.getContractFactory("SharesVaultAmt");
    sharesVaultAmt = (await SharesVaultAmt.deploy(
      amt.address,
      btcb.address,
      swapperTrucho.address,
      masterTrucho.address
    )) as SharesVaultAmt;
    await sharesVaultAmt.deployed();

    const PagosAutomMiners = await ethers.getContractFactory(
      "PagosAutomMiners"
    );
    pagosAutomMiners = (await PagosAutomMiners.deploy(
      sharesVaultAmt.address,
      btcb.address
    )) as PagosAutomMiners;
    await pagosAutomMiners.deployed();

    await btcb.transfer(pagosAutomMiners.address, 10000); // Owner send to pagos autom to be able to deposit
    await amt.transfer(swapperTrucho.address, 100000); //Send to swaper to be able to swap
    await btcb.transfer(masterTrucho.address, 100000); //Send btcb to masterTrucho to be able to pay
    await sharesVaultAmt.setDepositMaker(pagosAutomMiners.address);
    await sharesVaultAmt.setAdministrativeWallet(serverWallet.address);
    await pagosAutomMiners.setAdministrativeWallet(serverWallet.address);

    await sharesVaultAmt.setShares(addr1.address, 10);
    await sharesVaultAmt.setShares(addr2.address, 10);
    await sharesVaultAmt.setShares(addr3.address, 10);
    await sharesVaultAmt.setShares(addr4.address, 20);
    await sharesVaultAmt.setShares(addr5.address, 50);
  });

  it("Withdrawl all from pagosAutomMiners", async function () {
    const [owner] = await ethers.getSigners();
    await expect(pagosAutomMiners.withdrawAll()).to.changeTokenBalance(
      btcb,
      owner.address,
      10000
    );
  });

  it("Not server wallet must not be able to pay", async function () {
    const [owner] = await ethers.getSigners();
    await expect(pagosAutomMiners.pagar(10)).to.revertedWith(
      "Not allowed to execute deposit"
    );
  });

  it("Basic deposit and distribution", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();
    await pagosAutomMiners.connect(serverWallet).pagar(50);
    await expect(
      sharesVaultAmt.connect(addr1).withdraw()
    ).to.changeTokenBalance(amt, addr1.address, 10);
    await expect(
      sharesVaultAmt.connect(addr2).withdraw()
    ).to.changeTokenBalance(amt, addr2.address, 10);
    await expect(
      sharesVaultAmt.connect(addr3).withdraw()
    ).to.changeTokenBalance(amt, addr3.address, 10);
    await expect(
      sharesVaultAmt.connect(addr4).withdraw()
    ).to.changeTokenBalance(amt, addr4.address, 20);
    await expect(
      sharesVaultAmt.connect(addr5).withdraw()
    ).to.changeTokenBalance(amt, addr5.address, 50);
  });

  it("Seting shares depositing, setting new shares and depositing again", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5, addr6] =
      await ethers.getSigners();
    await pagosAutomMiners.connect(serverWallet).pagar(50);
    await sharesVaultAmt.setShares(addr6.address, 100);
    await pagosAutomMiners.connect(serverWallet).pagar(50);
    await expect(
      sharesVaultAmt.connect(addr1).withdraw()
    ).to.changeTokenBalance(amt, addr1.address, 15);
    await expect(
      sharesVaultAmt.connect(addr2).withdraw()
    ).to.changeTokenBalance(amt, addr2.address, 15);
    await expect(
      sharesVaultAmt.connect(addr3).withdraw()
    ).to.changeTokenBalance(amt, addr3.address, 15);
    await expect(
      sharesVaultAmt.connect(addr4).withdraw()
    ).to.changeTokenBalance(amt, addr4.address, 30);
    await expect(
      sharesVaultAmt.connect(addr5).withdraw()
    ).to.changeTokenBalance(amt, addr5.address, 75);
    await expect(
      sharesVaultAmt.connect(addr6).withdraw()
    ).to.changeTokenBalance(amt, addr6.address, 50);
  });

  it("A little bit more complex deposit and set share scenario", async function () {
    const [
      owner,
      serverWallet,
      addr1,
      addr2,
      addr3,
      addr4,
      addr5,
      addr6,
      addr7,
    ] = await ethers.getSigners();
    await pagosAutomMiners.connect(serverWallet).pagar(50);

    await expect(
      sharesVaultAmt.connect(addr1).withdraw()
    ).to.changeTokenBalance(amt, addr1.address, 10);

    await sharesVaultAmt.setShares(addr6.address, 100);

    await pagosAutomMiners.connect(serverWallet).pagar(50);
    await sharesVaultAmt.setShares(addr7.address, 10);

    await expect(
      sharesVaultAmt.connect(addr1).withdraw()
    ).to.changeTokenBalance(amt, addr1.address, 5);
    await expect(
      sharesVaultAmt.connect(addr2).withdraw()
    ).to.changeTokenBalance(amt, addr2.address, 15);
    await expect(
      sharesVaultAmt.connect(addr3).withdraw()
    ).to.changeTokenBalance(amt, addr3.address, 15);

    await pagosAutomMiners.connect(serverWallet).pagar(50);

    await expect(
      sharesVaultAmt.connect(addr4).withdraw()
    ).to.changeTokenBalance(amt, addr4.address, 39);
    await expect(
      sharesVaultAmt.connect(addr5).withdraw()
    ).to.changeTokenBalance(amt, addr5.address, 98);
    await expect(
      sharesVaultAmt.connect(addr6).withdraw()
    ).to.changeTokenBalance(amt, addr6.address, 97);

    await expect(
      sharesVaultAmt.connect(addr7).withdraw()
    ).to.changeTokenBalance(amt, addr7.address, 4);
  });

  it("Removing share holder", async function () {
    const [
      owner,
      serverWallet,
      addr1,
      addr2,
      addr3,
      addr4,
      addr5,
      addr6,
      addr7,
    ] = await ethers.getSigners();
    await pagosAutomMiners.connect(serverWallet).pagar(50);

    await expect(
      sharesVaultAmt.connect(addr2).withdraw()
    ).to.changeTokenBalance(amt, addr2.address, 10);
    await expect(
      sharesVaultAmt.connect(addr3).withdraw()
    ).to.changeTokenBalance(amt, addr3.address, 10);
    await expect(
      sharesVaultAmt.connect(addr4).withdraw()
    ).to.changeTokenBalance(amt, addr4.address, 20);
    await expect(
      sharesVaultAmt.removeShareHolder(addr5.address)
    ).to.changeTokenBalance(amt, addr5.address, 50);

    await pagosAutomMiners.connect(serverWallet).pagar(50);

    await expect(
      sharesVaultAmt.connect(addr1).withdraw()
    ).to.changeTokenBalance(amt, addr1.address, 30);
    await expect(
      sharesVaultAmt.connect(addr2).withdraw()
    ).to.changeTokenBalance(amt, addr2.address, 20);
    await expect(
      sharesVaultAmt.connect(addr3).withdraw()
    ).to.changeTokenBalance(amt, addr3.address, 20);
    await expect(
      sharesVaultAmt.connect(addr4).withdraw()
    ).to.changeTokenBalance(amt, addr4.address, 40);
  });

  it("Charging from master", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();
    const balanceAmtBefore = await amt.balanceOf(sharesVaultAmt.address);
    await sharesVaultAmt.connect(serverWallet).chargeAndSwap(1);
    const balanceAmtAfter = await amt.balanceOf(sharesVaultAmt.address);
    const charged = balanceAmtAfter.sub(balanceAmtBefore);

    const toWithdraw1 = charged.mul(10).div(100);
    const toWithdraw2 = charged.mul(10).div(100);
    const toWithdraw3 = charged.mul(10).div(100);
    const toWithdraw4 = charged.mul(20).div(100);
    const toWithdraw5 = charged.mul(50).div(100);

    await expect(
      sharesVaultAmt.connect(addr1).withdraw()
    ).to.changeTokenBalance(amt, addr1.address, toWithdraw1);
    await expect(
      sharesVaultAmt.connect(addr2).withdraw()
    ).to.changeTokenBalance(amt, addr2.address, toWithdraw2);
    await expect(
      sharesVaultAmt.connect(addr3).withdraw()
    ).to.changeTokenBalance(amt, addr3.address, toWithdraw3);
    await expect(
      sharesVaultAmt.connect(addr4).withdraw()
    ).to.changeTokenBalance(amt, addr4.address, toWithdraw4);
    await expect(
      sharesVaultAmt.connect(addr5).withdraw()
    ).to.changeTokenBalance(amt, addr5.address, toWithdraw5);
  });

  it("Owner must be able to withdraw all from sharesVaultAmt", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();
    await pagosAutomMiners.connect(serverWallet).pagar(50);
    await expect(sharesVaultAmt.withdrawAll()).to.changeTokenBalances(amt,[owner.address, sharesVaultAmt.address],[100,-100]);
  });

  //Tests for public view functions
  it("view addr list must return correct values", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();
    let addrList = await sharesVaultAmt.viewAddrList();
    expect(addrList[0]).to.be.equal(addr1.address);
    expect(addrList[1]).to.be.equal(addr2.address);
    expect(addrList[2]).to.be.equal(addr3.address);
    expect(addrList[3]).to.be.equal(addr4.address);
    expect(addrList[4]).to.be.equal(addr5.address);
  });

  it("view miner shares must return correct values", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();
    expect(await sharesVaultAmt.viewMinersShares(addr1.address)).to.be.equal(
      10
    );
    expect(await sharesVaultAmt.viewMinersShares(addr2.address)).to.be.equal(
      10
    );
    expect(await sharesVaultAmt.viewMinersShares(addr3.address)).to.be.equal(
      10
    );
    expect(await sharesVaultAmt.viewMinersShares(addr4.address)).to.be.equal(
      20
    );
    expect(await sharesVaultAmt.viewMinersShares(addr5.address)).to.be.equal(
      50
    );
  });

  it("View a cobrar must return correct values", async function () {
    const [owner, serverWallet, addr1, addr2, addr3, addr4, addr5] =
      await ethers.getSigners();
    expect(await sharesVaultAmt.viewACobrar(addr1.address)).to.be.equal(0);
    expect(await sharesVaultAmt.viewACobrar(addr2.address)).to.be.equal(0);
    expect(await sharesVaultAmt.viewACobrar(addr3.address)).to.be.equal(0);
    expect(await sharesVaultAmt.viewACobrar(addr4.address)).to.be.equal(0);
    expect(await sharesVaultAmt.viewACobrar(addr5.address)).to.be.equal(0);
    await pagosAutomMiners.connect(serverWallet).pagar(50);
    expect(await sharesVaultAmt.viewACobrar(addr1.address)).to.be.equal(10);
    expect(await sharesVaultAmt.viewACobrar(addr2.address)).to.be.equal(10);
    expect(await sharesVaultAmt.viewACobrar(addr3.address)).to.be.equal(10);
    expect(await sharesVaultAmt.viewACobrar(addr4.address)).to.be.equal(20);
    expect(await sharesVaultAmt.viewACobrar(addr5.address)).to.be.equal(50);
  });

  //Require failiure tests ¿¿??
});
