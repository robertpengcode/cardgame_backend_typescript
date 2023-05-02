import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

const ALCHEMY_MUMBAI_RPC_URL =
  process.env.ALCHEMY_MUMBAI_RPC_URL ||
  "https://polygon-mumbai.g.alchemy.com/v2/your-api-key";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x";  

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
    },
    polygonMumbai: {
      url: ALCHEMY_MUMBAI_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      chainId: 80001,
    },
  },
};

export default config;
