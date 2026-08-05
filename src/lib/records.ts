/**
 * records.ts — client for ZunivoAgentRecords, the service-discovery layer.
 * A .agent holder publishes an "agent card" (url / x402 / description) that
 * turns their name into a discoverable, callable, payable service.
 */
import { createPublicClient, createWalletClient, custom, parseAbi } from "viem";
import { arcTestnet, arcTransport, CHAIN_PARAMS_FOR_WALLET } from "./chain";
import { getEth } from "./provider";
import { API } from "./api";

export const RECORDS_ADDRESS = ((import.meta.env.VITE_RECORDS_ADDRESS as string | undefined) ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const RECORDS_ENABLED = RECORDS_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const RECORDS_ABI = parseAbi([
  "function setTexts(string label, string[] keys, string[] values) external",
  "function texts(string label, string[] keys) view returns (string[] values)",
  "function clearRecords(string label) external",
]);

/** The standard agent-card fields, in display order. */
export const AGENT_KEYS = ["url", "x402", "description"] as const;
export type AgentCard = Partial<Record<(typeof AGENT_KEYS)[number], string>>;

const pub = createPublicClient({ chain: arcTestnet, transport: arcTransport() });

export async function getAgentCard(label: string): Promise<AgentCard> {
  if (!RECORDS_ENABLED) return {};
  const values = (await pub.readContract({
    address: RECORDS_ADDRESS,
    abi: RECORDS_ABI,
    functionName: "texts",
    args: [label, [...AGENT_KEYS]],
  })) as string[];
  const card: AgentCard = {};
  AGENT_KEYS.forEach((k, i) => { if (values[i]) card[k] = values[i]; });
  return card;
}

async function walletFor(): Promise<{ wallet: any; account: `0x${string}` }> {
  const eth = getEth();
  if (!eth) throw new Error("No wallet detected — install MetaMask/Rabby to publish records.");
  const [account] = await eth.request({ method: "eth_requestAccounts" });
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS_FOR_WALLET.chainId }] });
  } catch (e: any) {
    if (e?.code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS_FOR_WALLET] });
    } else throw e;
  }
  return { wallet: createWalletClient({ chain: arcTestnet, transport: custom(eth) }), account };
}

/** Write the card in one transaction. Empty strings clear the key on-chain. */
export async function saveAgentCard(label: string, card: AgentCard): Promise<`0x${string}`> {
  if (!RECORDS_ENABLED) throw new Error("Records contract not configured (VITE_RECORDS_ADDRESS).");
  const keys = AGENT_KEYS.filter((k) => card[k] !== undefined) as string[];
  const values = keys.map((k) => card[k as keyof AgentCard] ?? "");
  if (keys.length === 0) throw new Error("Nothing to save.");
  const { wallet, account } = await walletFor();
  const hash = await wallet.writeContract({
    account,
    address: RECORDS_ADDRESS,
    abi: RECORDS_ABI,
    functionName: "setTexts",
    args: [label, keys, values],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Save reverted.");
  // fast-track the directory so the card shows up in seconds
  fetch(`${API}/api/agents/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash: hash }),
  }).catch(() => {});
  return hash;
}

export type DirectoryAgent = {
  name: string;
  label: string;
  owner: string;
  records: Record<string, string>;
  updatedAt: number;
};

export async function listAgents(): Promise<DirectoryAgent[]> {
  const r = await fetch(`${API}/api/agents`);
  if (!r.ok) throw new Error("directory unavailable");
  return (await r.json()).agents as DirectoryAgent[];
}
