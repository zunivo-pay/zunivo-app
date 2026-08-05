import { createPublicClient, createWalletClient, custom, http, parseAbi, isAddress } from "viem";
import { getEth, requestAccounts } from "./provider";
import { arcTestnet, arcTransport, CHAIN_PARAMS_FOR_WALLET } from "./chain";

/** Public-RPC calls from browsers get rate-limited on busy days — retry with backoff. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr;
}


export const NAMES_ADDRESS = ((import.meta.env.VITE_NAMES_ADDRESS as string | undefined) ??
  "0x83c4081Be1c85b12FF92Aa912A53700Fb994A4D8") as `0x${string}`;

export const NAMES_DEPLOY_BLOCK = BigInt(
  (import.meta.env.VITE_NAMES_DEPLOY_BLOCK as string | undefined) ?? "52962779"
);

export const NAMES_ABI = parseAbi([
  "function mint(string label) payable returns (uint256)",
  "function resolve(string label) view returns (address)",
  "function mintPrice() view returns (uint256)",
  "function setAddress(string label, address newAddress)",
  "event NameRegistered(string name, uint256 indexed tokenId, address indexed holder, uint256 pricePaid)",
]);

const pub = createPublicClient({ chain: arcTestnet, transport: arcTransport() });

export const LABEL_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;

/** Accepts "aaa.agent", "@aaa", or bare "aaa" → returns the bare label, or null. */
export function parseHandle(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith("@")) s = s.slice(1);
  if (s.endsWith(".agent")) s = s.slice(0, -6);
  return LABEL_RE.test(s) ? s : null;
}

export function displayName(label: string): string {
  return label + ".agent";
}
export function validLabel(label: string): boolean {
  return LABEL_RE.test(label);
}

export async function resolveName(label: string): Promise<`0x${string}` | null> {
  const addr = (await withRetry(() => pub.readContract({
    address: NAMES_ADDRESS,
    abi: NAMES_ABI,
    functionName: "resolve",
    args: [label],
  }))) as `0x${string}`;
  return addr === "0x0000000000000000000000000000000000000000" ? null : addr;
}

export async function getMintPrice(): Promise<bigint> {
  return withRetry(async () => (await pub.readContract({
    address: NAMES_ADDRESS, abi: NAMES_ABI, functionName: "mintPrice",
  })) as bigint);
}

export async function namesOf(holder: `0x${string}`): Promise<string[]> {
  // served by the Zunivo indexer — no public-RPC log scans from the browser
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  if (!api) return [];
  const r = await fetch(`${api}/api/names/${holder}`);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.names ?? []).map((x: { label: string }) => x.label);
}

async function walletFor(): Promise<{ wallet: any; account: `0x${string}` }> {
  const eth = getEth();
  if (!eth) throw new Error("No wallet detected — install MetaMask/Rabby to mint.");
  const account = await requestAccounts(eth);
  if (!account) throw new Error("No account authorized.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS_FOR_WALLET.chainId }] });
  } catch (e: any) {
    if (e?.code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS_FOR_WALLET] });
    } else throw e;
  }
  return { wallet: createWalletClient({ chain: arcTestnet, transport: custom(eth) }), account };
}

export async function mintName(label: string, price: bigint): Promise<`0x${string}`> {
  const { wallet, account } = await walletFor();
  const hash = await wallet.writeContract({
    account,
    address: NAMES_ADDRESS,
    abi: NAMES_ABI,
    functionName: "mint",
    args: [label],
    value: price,
  });
  const receipt = await withRetry(() => pub.waitForTransactionReceipt({ hash }), 4);
  if (receipt.status !== "success") throw new Error("Mint reverted.");
  return hash;
}

export async function setNameAddress(label: string, newAddress: string): Promise<`0x${string}`> {
  if (!isAddress(newAddress)) throw new Error("Invalid address.");
  const { wallet, account } = await walletFor();
  const hash = await wallet.writeContract({
    account,
    address: NAMES_ADDRESS,
    abi: NAMES_ABI,
    functionName: "setAddress",
    args: [label, newAddress as `0x${string}`],
  });
  const receipt = await withRetry(() => pub.waitForTransactionReceipt({ hash }), 4);
  if (receipt.status !== "success") throw new Error("Update reverted.");
  return hash;
}

import { keccak256, toHex } from "viem";
export function tokenIdOf(label: string): string {
  return BigInt(keccak256(toHex(label))).toString();
}
