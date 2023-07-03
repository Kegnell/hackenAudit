import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import chai from "chai";
import { TestERC20 } from "../typechain-types";
import { SharesVault } from "../typechain-types";
import { TestSwapper } from "../typechain-types";
import { TestMaster } from "../typechain-types";
import { PagosAutomConRecompra } from "../typechain-types";
const { expect } = chai;

describe("UNIT: pagosAutomConRecompra", function () {
  let btcb: TestERC20;
  let amt: TestERC20;
  let sharesVault: SharesVault;
  let swapperTrucho: TestSwapper;
  let pagosAutomConRecompra: PagosAutomConRecompra;
  let masterTrucho: TestMaster;

  beforeEach(async function () {
    const [owner, serverWallet, beneficiary] = await ethers.getSigners();

    const Btcb = await ethers.getContractFactory("TestERC20");
    btcb = (await Btcb.deploy(1000000000)) as TestERC20;
    await btcb.deployed();

    const Amt = await ethers.getContractFactory("TestERC20");
    amt = (await Amt.deploy(54000000)) as TestERC20;
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
    await amt.transfer(swapperTrucho.address, 100000); //Send to swapper to check swap operations
    await btcb.transfer(masterTrucho.address, 100000); //Send to master to check charge operations
    await btcb
      .connect(serverWallet)
      .approve(pagosAutomConRecompra.address, "999999999999999999999999999");
  });

  it("Owner may be able to set administrative wallet", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    expect(await pagosAutomConRecompra.addrAdministrativeWallet()).to.equal(
      serverWallet.address
    );
  });



  it("Not owner must not be able to set administrative wallet", async function () {
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await expect(
      pagosAutomConRecompra
        .connect(addr2)
        .setAdministrativeWallet(serverWallet.address)
    ).to.revertedWith("Ownable: caller is not the owner");
  });
  it("Owner may be able to set slippage", async function(){
    const [owner] = await ethers.getSigners();
    await pagosAutomConRecompra.setSlippage(2);
    expect(await pagosAutomConRecompra.slippage()).to.be.equal(2)

  })

  it("Server wallet may be able to deposit on sharesVault via pagosAutomConRecompra", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      pagosAutomConRecompra.connect(serverWallet).deposit(10)
    ).to.changeTokenBalances(
      btcb,
      [pagosAutomConRecompra.address, sharesVault.address],
      [-10, 10]
    );
  });

  it("Not server wallet must not be able to deposit on sharesVault via pagosAutomConRecompra", async function () {
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      pagosAutomConRecompra.connect(addr2).deposit(10)
    ).to.revertedWith("Wallet not allowed to execute deposit");
  });

  it("Owner must be able to extend approve to any contract", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await pagosAutomConRecompra.connect(serverWallet).deposit(10);
    expect(
      await btcb.allowance(pagosAutomConRecompra.address, sharesVault.address)
    ).to.equal(ethers.BigNumber.from("99999999999000000000000000000").sub(10));
    await pagosAutomConRecompra.extendApprove(sharesVault.address);
    expect(
      await btcb.allowance(pagosAutomConRecompra.address, sharesVault.address)
    ).to.equal(ethers.BigNumber.from("99999999999000000000000000000"));
  });

  it("Not owner must not be able to extend or generate approves for any address", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await pagosAutomConRecompra.connect(serverWallet).deposit(10);
    expect(
      await btcb.allowance(pagosAutomConRecompra.address, sharesVault.address)
    ).to.equal(ethers.BigNumber.from("99999999999000000000000000000").sub(10));
    await expect(
      pagosAutomConRecompra
        .connect(serverWallet)
        .extendApprove(sharesVault.address)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("Deposit must emit event deposit", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(pagosAutomConRecompra.connect(serverWallet).deposit(10))
      .to.emit(pagosAutomConRecompra, "depositMade")
      .withArgs(10);
  });

  it("Server wallet may execute swap operation, check changes on BTCB balance", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      pagosAutomConRecompra.connect(serverWallet).swap(10, false)
    ).to.changeTokenBalances(
      btcb,
      [pagosAutomConRecompra.address, swapperTrucho.address],
      [-10, 10]
    );
  });

  it("Server wallet may execute swap operation, check changes on AMT balance", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      pagosAutomConRecompra.connect(serverWallet).swap(10, false)
    ).to.changeTokenBalances(
      amt,
      [pagosAutomConRecompra.address, swapperTrucho.address],
      [20, -20]
    );
  });

  it("Server wallet may execute swap operation, check swap event emit", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(pagosAutomConRecompra.connect(serverWallet).swap(10, false))
      .to.emit(pagosAutomConRecompra, "swapMade")
      .withArgs(20, false);
  });

  it("Server wallet may execute swap operation, check swap event on transaction receipt", async function () {
    const [owner, serverWallet] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    const swapTransaction = await pagosAutomConRecompra
      .connect(serverWallet)
      .swap(10, false);
    const receipt = await swapTransaction.wait();
    const events = receipt.events;
    expect(events).to.satisfy((eventList: any[]) => {
      return eventList.some((event) => {
        if (event.event === "swapMade") {
          const argsMatch = event.args.some((arg: any) => {
            return BigNumber.from(20).eq(arg);
          });
          return argsMatch;
        }
      });
    });
  });

  it("Not server wallet must not execute swap operation", async function () {
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      pagosAutomConRecompra.connect(addr2).swap(10, false)
    ).to.revertedWith("Wallet not allowed to execute swap");
  });

  it("Server wallet must be able to execute charge", async function () {
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      await pagosAutomConRecompra.connect(serverWallet).charge(1)
    ).to.emit(pagosAutomConRecompra, "charged");
  });

  it("Not server wallet must not be able to execute charge", async function () {
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await expect(
      pagosAutomConRecompra.connect(addr2).charge(1)
    ).to.revertedWith("Wallet not allowed to execute charge");
  });

  it("Check event correctly emited on charged", async function () {
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    const balanceBefore = await btcb.balanceOf(pagosAutomConRecompra.address);
    const transaction = await pagosAutomConRecompra
      .connect(serverWallet)
      .charge(1);
    const balanceAfter = await btcb.balanceOf(pagosAutomConRecompra.address);

    const receipt = await transaction.wait();
    const events = receipt.events;
    expect(events).to.satisfy((eventList: any[]) => {
      return eventList.some((event) => {
        if (event.event === "charged") {
          const argsMatch = event.args.some((arg: any) => {
            return balanceAfter.sub(balanceBefore).eq(arg);
          });
          return argsMatch;
        }
      });
    });
  });

  it("Owner should be able to withdrawl all", async function(){
    const [owner, serverWallet, addr2] = await ethers.getSigners();
    await pagosAutomConRecompra.setAdministrativeWallet(serverWallet.address);
    await btcb.transfer(pagosAutomConRecompra.address, 1000); // Owner transfers btcb to pagosAutomConRecompra to make operations
    await pagosAutomConRecompra.connect(serverWallet).swap(10, false)
    await expect(pagosAutomConRecompra.withdrawAll()).to.changeTokenBalance(amt,owner.address,20);
  })
});
