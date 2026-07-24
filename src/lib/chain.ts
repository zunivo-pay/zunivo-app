import { defineChain } from "viem";

// Arc Testnet — Circle's L1 where native gas is USDC (18 decimals at native layer).
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Set after running the Foundry deploy script (see paylink-core/script/Deploy.s.sol):
//   VITE_ROUTER_ADDRESS=0x... in .env
export const ROUTER_ADDRESS = (import.meta.env.VITE_ROUTER_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const ROUTER_ABI = [
  {
    type: "function",
    name: "pay",
    stateMutability: "payable",
    inputs: [
      { name: "orderId", type: "bytes32" },
      { name: "merchant", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
      { name: "feeAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const EXPLORER = "https://testnet.arcscan.app";

export const CHAIN_PARAMS_FOR_WALLET = {
  chainId: "0x4CEF52", // 5042002
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};
