import { createPublicClient, createWalletClient, custom, http, parseAbi, parseEther } from "viem";
import { getEth, requestAccounts } from "./provider";
import { arcTestnet, arcTransport, CHAIN_PARAMS_FOR_WALLET } from "./chain";
import { API } from "./api";

export const SCHED_ADDRESS = ((import.meta.env.VITE_SCHED_ADDRESS as string | undefined) ??
  "0xad5121668867a234Bd1f7D62eC40D09Ee3f47c02") as `0x${string}`;

const ABI = parseAbi([
  "function createSend(address recipient, uint64 unlockAt, uint64 reclaimGrace, bytes32 orderId) payable returns (uint256)",
  "function release(uint256 id) external",
]);

const pub = createPublicClient({ chain: arcTestnet, transport: arcTransport() });

async function walletFor() {
  const eth = getEth();
  if (!eth) throw new Error("No wallet detected — scheduling needs a wallet.");
  const account = await requestAccounts(eth);
  if (!account) throw new Error("No account authorized.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS_FOR_WALLET.chainId }] });
  } catch (e: any) {
    if (e?.code === 4902) await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS_FOR_WALLET] });
    else throw e;
  }
  return { wallet: createWalletClient({ chain: arcTestnet, transport: custom(eth) }), account };
}

export const GRACE_30D = 30n * 24n * 60n * 60n;

export async function createScheduledSend(
  recipient: `0x${string}`,
  amount: string,
  unlockAtSec: number,
  allowReclaim: boolean,
  orderId: `0x${string}`
): Promise<`0x${string}`> {
  const { wallet, account } = await walletFor();
  const hash = await wallet.writeContract({
    account,
    address: SCHED_ADDRESS,
    abi: ABI,
    functionName: "createSend",
    args: [recipient, BigInt(unlockAtSec), allowReclaim ? GRACE_30D : 0n, orderId],
    value: parseEther(amount),
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Scheduling reverted.");
  return hash;
}

export async function releaseLock(id: number): Promise<`0x${string}`> {
  const { wallet, account } = await walletFor();
  const hash = await wallet.writeContract({
    account, address: SCHED_ADDRESS, abi: ABI, functionName: "release", args: [BigInt(id)],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Release reverted.");
  return hash;
}

export type ScheduledView = {
  id: number; sender: string; recipient: string; amount: string;
  unlockAt: number; reclaimAt: number; status: "locked" | "claimable" | "released" | "reclaimed";
  createdTx?: string; settledTx?: string;
};

export async function fetchScheduled(address: string): Promise<{ incoming: ScheduledView[]; outgoing: ScheduledView[] }> {
  const r = await fetch(`${API}/api/scheduled/${address}`);
  if (!r.ok) throw new Error("failed to load scheduled sends");
  return r.json();
}
