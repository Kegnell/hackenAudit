import { ethers } from "hardhat";

async function main() {
/*     const SharesVault = await ethers.getContractFactory("SharesVault");
    const sharesVault = await SharesVault.deploy("0x0a849F9B328f5A0EEBBEFc28668c8377e56E84d8");
    await sharesVault.deployed();
    console.log("SharesVault address:", sharesVault.address);

    const addrSharesVault = sharesVault.address */

    const addrSharesVault = "0xe8933a075B32C4042431BF045192DA238EB4B3f1"

    const PagosAutom = await ethers.getContractFactory("PagosAutomConRecompra");
    const pagosAutom = await PagosAutom.deploy(addrSharesVault);
    await pagosAutom.deployed();
    console.log("pagosAutom address:", pagosAutom.address);
    
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
