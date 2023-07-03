import { ethers } from "hardhat";
import chai from "chai";
import { SharesVault } from "../typechain-types/contracts/SharesVault";
import { TestERC20 } from "../typechain-types";

const { expect } = chai;

describe("UNIT: SharesVault", function () {
  let btcb: TestERC20;
  let sharesVault: SharesVault;

  beforeEach(async function () {
    const [owner, depositMaker, beneficiary] = await ethers.getSigners();
    const Btcb = await ethers.getContractFactory("TestERC20");
    btcb = (await Btcb.deploy(1000000)) as TestERC20;
    await btcb.deployed();

    const SharesVault = await ethers.getContractFactory("SharesVault");
    sharesVault = (await SharesVault.deploy(
      beneficiary.address,
      btcb.address
    )) as SharesVault;
    await sharesVault.deployed();

    await btcb.approve(sharesVault.address, "99999999999999999999999999");
    await btcb
      .connect(depositMaker)
      .approve(sharesVault.address, "99999999999999999999999999");

    await btcb.transfer(depositMaker.address, 10000);
  });

  it("Should allow the owner to set deposit maker", async function () {
    const [owner, depositMaker, beneficiary] = await ethers.getSigners();
    await sharesVault.setDepositMaker(depositMaker.address);
    expect(await sharesVault.addrDepositMaker()).to.equal(depositMaker.address);
  });

  it("Must not allow not owner to set deposit maker", async function () {
    const [owner, depositMaker, beneficiary, addr3] = await ethers.getSigners();
    await expect(
      sharesVault.connect(addr3).setDepositMaker(depositMaker.address)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("Should allow the beneficiary to change beneficiary", async function () {
    const [owner, depositMaker, beneficiary, newBeneficiary] =
      await ethers.getSigners();
    await sharesVault
      .connect(beneficiary)
      .changeBeneficiary(newBeneficiary.address);
    expect(await sharesVault.beneficiary()).to.equal(newBeneficiary.address);
  });

  it("Must not allow not beneficiary to change beneficiary", async function () {
    const [owner, depositMaker, beneficiary, notBeneficiary] =
      await ethers.getSigners();
    await expect(
      sharesVault
        .connect(notBeneficiary)
        .changeBeneficiary(notBeneficiary.address)
    ).to.revertedWith("Not allowed to change beneficiary");
  });

  it("Deposit maker must be able to deposit", async function () {
    const [owner, depositMaker, beneficiary, newBeneficiary] =
      await ethers.getSigners();
    await sharesVault.setDepositMaker(depositMaker.address);
    await expect(
      sharesVault.connect(depositMaker).deposit(100)
    ).to.changeTokenBalance(btcb, sharesVault.address, 100);
  });

  it("Not deposit maker must not be able to deposit", async function () {
    const [owner, depositMaker, beneficiary, notDepositMaker] =
      await ethers.getSigners();
    await sharesVault.setDepositMaker(depositMaker.address);
    await expect(
      sharesVault.connect(notDepositMaker).deposit(100)
    ).to.revertedWith("not allowed to deposit");
  });

  it("Beneficiary must be able to withdraw", async function () {
    const [owner, depositMaker, beneficiary] = await ethers.getSigners();
    await sharesVault.setDepositMaker(depositMaker.address);
    await sharesVault.connect(depositMaker).deposit(100);
    await expect(
      sharesVault.connect(beneficiary).withdraw()
    ).to.changeTokenBalance(btcb, beneficiary.address, 100);
  });

  it("Not beneficiary must not be able to withdraw", async function () {
    const [owner, depositMaker, beneficiary, notBeneficiary] =
      await ethers.getSigners();
    await sharesVault.setDepositMaker(depositMaker.address);
    await sharesVault.connect(depositMaker).deposit(100);
    await expect(
      sharesVault.connect(notBeneficiary).withdraw()
    ).to.revertedWith("Not allowed to withdraw");
  });
});
