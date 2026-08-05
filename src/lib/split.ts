import { createPublicClient, createWalletClient, custom, http, parseAbi, parseEther, parseEventLogs, encodeFunctionData } from "viem";
import { getEth, requestAccounts } from "./provider";
import { arcTestnet, arcTransport, CHAIN_PARAMS_FOR_WALLET } from "./chain";

export const SPLIT_ADDRESS = ((import.meta.env.VITE_SPLIT_ADDRESS as string | undefined) ??
  "0x12F21A2AC582061598445874c6C5f4F3bcE53eCF") as `0x${string}`;

export const SPLIT_ABI = parseAbi([
  "function createSplit(address[] payees, uint16[] sharesBps) returns (uint256)",
  "function pay(uint256 splitId, bytes32 orderId) payable",
  "function splitOf(uint256 splitId) view returns (address creator, address[] payees, uint16[] sharesBps)",
  "event SplitCreated(uint256 indexed splitId, address indexed creator, address[] payees, uint16[] sharesBps)",
]);

const pub = createPublicClient({ chain: arcTestnet, transport: arcTransport() });

async function walletFor() {
  const eth = getEth();
  if (!eth) throw new Error("Creating a split needs a wallet.");
  const account = await requestAccounts(eth);
  if (!account) throw new Error("No account authorized.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS_FOR_WALLET.chainId }] });
  } catch (e: any) {
    if (e?.code === 4902) await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS_FOR_WALLET] });
    else throw e;
  }
  return { wallet: createWalletClient({ chain: arcTestnet, transport: custom(eth) }), account: account as `0x${string}` };
}

/** Creates an immutable split on-chain; returns { splitId, creator }. */
export async function createSplitOnChain(
  payees: `0x${string}`[],
  sharesBps: number[]
): Promise<{ splitId: string; creator: `0x${string}` }> {
  const { wallet, account } = await walletFor();
  const hash = await wallet.writeContract({
    account,
    address: SPLIT_ADDRESS,
    abi: SPLIT_ABI,
    functionName: "createSplit",
    args: [payees, sharesBps],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Split creation reverted.");
  const logs = parseEventLogs({ abi: SPLIT_ABI, logs: receipt.logs });
  const created: any = logs.find((l: any) => l.eventName === "SplitCreated");
  if (!created) throw new Error("SplitCreated event not found.");
  return { splitId: created.args.splitId.toString(), creator: account };
}

/** Calldata for paying a split — used by both wallet and passkey paths. */
export function splitPayCall(splitId: string, orderId: `0x${string}`, amount: string) {
  return {
    to: SPLIT_ADDRESS,
    value: parseEther(amount),
    data: encodeFunctionData({ abi: SPLIT_ABI, functionName: "pay", args: [BigInt(splitId), orderId] }),
  };
}

export async function fetchSplit(splitId: string) {
  const [creator, payees, sharesBps] = (await pub.readContract({
    address: SPLIT_ADDRESS, abi: SPLIT_ABI, functionName: "splitOf", args: [BigInt(splitId)],
  })) as [string, string[], number[]];
  return { creator, payees, sharesBps };
}
