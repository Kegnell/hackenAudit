import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import 'solidity-coverage';

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  networks: {
    hardhat: {
      accounts: {
        mnemonic: "test test test spam spum spin case vold hacken welove youu alot",
        count: 500,
      },
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/beee6638496e4731b8a35e2b7116a2a6",
      accounts: [
        "df1b9162f0b2efb14f213fa94a1d53445f50b50d7d5a254153e96f53a99d8613",
      ],
    },
    bsc: {
      url: "https://bsc-dataseed1.binance.org/",
      accounts: [
        "484142da20e1034c1f306457d7f73d3ca9f82c75941801737b848100f96f9a2c",
        //"dec3653fd05f52c53bd43981b990ff7771a6022795b04b23f57fe0c389bc444a",
      ],
    },
    testnetBSC: {
      url: "https://data-seed-prebsc-2-s3.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [
        "484142da20e1034c1f306457d7f73d3ca9f82c75941801737b848100f96f9a2c",
      ],
    },
    sepolia: {
      url: "https://rpc.sepolia.org/",
      accounts: [
        "484142da20e1034c1f306457d7f73d3ca9f82c75941801737b848100f96f9a2c",
      ],
    },

  },
  etherscan: {
    apiKey:"JW3HDZAW5Q2WUYKSU8WITXPHE9NFQC48ME",
  },
};

export default config;
