import { defineChain, fallback, http } from "viem";

/**
 * Network selection — ONE build-time switch for the whole app.
 *
 *   VITE_NETWORK=mainnet   Arc mainnet, v1.3 contracts, real USDC   (app.zunivo.io)
 *   VITE_NETWORK=testnet   Arc testnet, sandbox contracts            (testnet.zunivo.io)
 *
 * Chain definition, RPC gateways, explorer, contract addresses and wallet
 * chain-params all derive from it. Individual VITE_*_ADDRESS vars still
 * override (ops / local deploys) but are no longer needed to pick a network.
 */
export type NetworkName = "mainnet" | "testnet";

const raw = String(import.meta.env.VITE_NETWORK ?? "testnet").toLowerCase();
export const NETWORK: NetworkName = raw === "mainnet" ? "mainnet" : "testnet";
export const IS_MAINNET = NETWORK === "mainnet";

type NetConfig = {
  chainId: number;
  chainIdHex: `0x${string}`;
  chainName: string;
  rpcs: string[];
  ws?: string;
  explorer: string;
  explorerName: string;
  /** Circle Modular Wallets transport path segment (`${clientUrl}/<this>`). */
  circleChainPath: string;
  contracts: { router: string; names: string; sched: string; split: string; records: string };
  namesDeployBlock: string;
  /** Public URLs of THIS environment and its sibling (for the network badge). */
  appUrl: string;
  siblingAppUrl: string;
  siblingLabel: string;
};

const CONFIGS: Record<NetworkName, NetConfig> = {
  mainnet: {
    chainId: 5042,
    chainIdHex: "0x13b2",
    chainName: "Arc",
    rpcs: ["https://rpc.mainnet.arc.io"],
    explorer: "https://arc.etherscan.io",
    explorerName: "ArcScan",
    circleChainPath: "arc",
    // v1.3, deployed 2026-09-17 block 21240365, verified on arc.etherscan.io
    contracts: {
      router:  "0xAa8c293495446d04a51A32e2e4557EDE3BfC7119",
      names:   "0x824218447E8Dbf10E535dC7fB6ab7b68105c7dDa",
      sched:   "0x8d2193555Ad7C3f2EEfe66Ede0F8A3477774050c",
      split:   "0x3c07F894A14AA080191b2Cc95dd4d0BfA31E5715",
      records: "0xFE9fca63CaA64FBf0B2F089786A706f0C99dCbB1",
    },
    namesDeployBlock: "21240365",
    appUrl: "https://app.zunivo.io",
    siblingAppUrl: "https://testnet.zunivo.io",
    siblingLabel: "Testnet sandbox",
  },
  testnet: {
    chainId: 5042002,
    chainIdHex: "0x4CEF52",
    chainName: "Arc Testnet",
    rpcs: [
      "https://rpc.testnet.arc.network",
      "https://rpc.drpc.testnet.arc.io",
      "https://rpc.quicknode.testnet.arc.io",
      "https://rpc.blockdaemon.testnet.arc.io",
    ],
    ws: "wss://rpc.testnet.arc.network",
    explorer: "https://testnet.arcscan.app",
    explorerName: "ArcScan",
    circleChainPath: "arcTestnet",
    // the original sandbox set (what app.zunivo.io ran on before mainnet)
    contracts: {
      router:  "0x4210D40a9899e42b4946B9dC7E0C35d3cf14Ea55",
      names:   "0x244e0c8bE1Ed59636901F98920413d414B158cc5",
      sched:   "0xad5121668867a234Bd1f7D62eC40D09Ee3f47c02",
      split:   "0x12F21A2AC582061598445874c6C5f4F3bcE53eCF",
      records: "0x4f405f0aA04FD6FaE0838DeE6FD184B1f3cC306B",
    },
    namesDeployBlock: "55209865",
    appUrl: "https://testnet.zunivo.io",
    siblingAppUrl: "https://app.zunivo.io",
    siblingLabel: "Mainnet",
  },
};

export const NET = CONFIGS[NETWORK];

/** Optional dedicated RPC (VITE_RPC_URL) goes first; public gateways stay as fallback. */
const dedicated = (import.meta.env.VITE_RPC_URL as string | undefined)?.trim();
export const ARC_RPCS = dedicated ? [dedicated, ...NET.rpcs] : NET.rpcs;

export const arcChain = defineChain({
  id: NET.chainId,
  name: NET.chainName,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ARC_RPCS, ...(NET.ws ? { webSocket: [NET.ws] } : {}) } },
  blockExplorers: { default: { name: NET.explorerName, url: NET.explorer } },
  testnet: !IS_MAINNET,
});
/** @deprecated name kept for existing imports — this is whichever chain the build targets. */
export const arcTestnet = arcChain;

// Multi-gateway transport: races the RPC gateways, auto-fails-over on rate
// limits, and keeps using the fastest one (ranked by latency).
export const arcTransport = () =>
  fallback(ARC_RPCS.map((u) => http(u, { timeout: 6_000, retryCount: 0 })), { rank: true });

/**
 * Per-address overrides are OFF unless VITE_CONTRACT_OVERRIDES=1. Vite merges
 * `.env` into every mode, so a stray VITE_NAMES_ADDRESS from a dev .env would
 * otherwise silently pin the wrong chain's contract into a mainnet build.
 */
const OVERRIDES_ON = String(import.meta.env.VITE_CONTRACT_OVERRIDES ?? "") === "1";
const addr = (env: unknown, fallbackAddr: string): `0x${string}` => {
  const v = OVERRIDES_ON && typeof env === "string" && env.trim() ? env.trim() : fallbackAddr;
  return v as `0x${string}`;
};
export const CONTRACTS = {
  router:  addr(import.meta.env.VITE_ROUTER_ADDRESS,  NET.contracts.router),
  names:   addr(import.meta.env.VITE_NAMES_ADDRESS,   NET.contracts.names),
  sched:   addr(import.meta.env.VITE_SCHED_ADDRESS,   NET.contracts.sched),
  split:   addr(import.meta.env.VITE_SPLIT_ADDRESS,   NET.contracts.split),
  records: addr(import.meta.env.VITE_RECORDS_ADDRESS, NET.contracts.records),
};
export const ROUTER_ADDRESS = CONTRACTS.router;
export const NAMES_DEPLOY_BLOCK = BigInt(
  (OVERRIDES_ON && (import.meta.env.VITE_NAMES_DEPLOY_BLOCK as string | undefined)) || NET.namesDeployBlock,
);

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

export const EXPLORER = NET.explorer;
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;

/** EIP-3085 params for wallet_addEthereumChain / wallet_switchEthereumChain. */
export const CHAIN_PARAMS_FOR_WALLET = {
  chainId: NET.chainIdHex,
  chainName: NET.chainName,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [NET.rpcs[0]],
  blockExplorerUrls: [NET.explorer],
};

/** Human label for badges/footers: "Arc mainnet" / "Arc testnet". */
export const NETWORK_LABEL = IS_MAINNET ? "Arc mainnet" : "Arc testnet";
