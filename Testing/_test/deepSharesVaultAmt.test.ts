import { ethers } from "hardhat";
import chai from "chai";
import { TestERC20 } from "../typechain-types";
import { SharesVaultAmt } from "../typechain-types";
import { TestSwapper } from "../typechain-types";
import { TestMaster } from "../typechain-types";
import { PagosAutomMiners } from "../typechain-types";
import { BigNumber } from "ethers";
const { expect } = chai;

describe("Deep ShareVaultAmt testing", function () {
  let walletAmount = 50;
  let deepness = 100;
  let amt: TestERC20;
  let btcb: TestERC20;
  let sharesVaultAmt: SharesVaultAmt;
  let swapperTrucho: TestSwapper;
  let masterTrucho: TestMaster;
  let pagosAutomMiners: PagosAutomMiners;
  let shares: Array<number>;
  let totalShares: number;

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
    const addresses = await ethers.getSigners();
    shares = Array.from(
      { length: walletAmount },
      () => Math.floor(Math.random() * 300) + 40
    );
    totalShares = shares.reduce((a, b) => a + b, 0);
    for (let i = 2; i < walletAmount + 2; i++) {
      await sharesVaultAmt.setShares(addresses[i].address, shares[i - 2]);
    }
  });

  it("Multiple events of deposit charging and withdrawl", async function () {
    this.timeout(500000);
    const addresses = await ethers.getSigners();
    for (let i = 0; i < deepness; i++) {
      let randomValue = Math.floor(Math.random() * 100) + 50;
      pagosAutomMiners.connect(addresses[1]).pagar(randomValue);
      for (let j = 2; j < walletAmount + 1; j++) {
        const toWithdraw = BigNumber.from(randomValue * 2)
          .mul(shares[j - 2])
          .div(totalShares);
    
        if (toWithdraw.gt(0)) {
          await expect(
            sharesVaultAmt.connect(addresses[j]).withdraw()
          ).to.changeTokenBalance(amt, addresses[j].address, toWithdraw);
        } else {
            console.log("To withdraw: " + await sharesVaultAmt.viewACobrar(addresses[j].address))

          await expect(
            sharesVaultAmt.connect(addresses[j]).withdraw()
          ).to.revertedWith("No tokens available for withdrawal");
        }
      }
    }
  });
});
