import { createPublicClient, encodeFunctionData, parseEther, formatEther, keccak256, toHex, http } from "viem";
import {
  createBundlerClient,
  toWebAuthnAccount,
  type P256Credential,
  type SmartAccount,
} from "viem/account-abstraction";
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  encodeTransfer,
  ContractAddress,
} from "@circle-fin/modular-wallets-core";
import { arcTestnet, ROUTER_ABI, ROUTER_ADDRESS } from "./chain";

const clientKey = import.meta.env.VITE_CIRCLE_CLIENT_KEY as string | undefined;
const clientUrl = import.meta.env.VITE_CIRCLE_CLIENT_URL as string | undefined;

export const circleEnabled = Boolean(clientKey && clientUrl);

const CRED_KEY = "zunivo_passkey_credential";

/** Circle's Arc bundler enforces a 1 gwei floor on maxPriorityFeePerGas
 *  (precheck: "must be at least 1000000000"). viem's automatic estimation can
 *  dip below it when the chain is quiet, causing intermittent rejections —
 *  so we always pin fees above the floor. Gas is USDC-denominated pennies. */
const PRIORITY_FLOOR = 1_500_000_000n; // 1.5 gwei
async function bundlerFees() {
  // Price generously and query through Circle's authenticated transport —
  // the public RPC rate-limits by IP, and a failed quote used to collapse
  // our bid to the floor, leaving ops accepted but never bundled.
  const { modular } = transports();
  const client = createPublicClient({ chain: arcTestnet, transport: modular });
  let gasPrice = 0n;
  let tip = 0n;
  try { gasPrice = await client.getGasPrice(); } catch {}
  try { tip = BigInt((await client.request({ method: "eth_maxPriorityFeePerGas" as any })) as string); } catch {}
  const suggested = tip * 2n;
  const maxPriorityFeePerGas = suggested > PRIORITY_FLOOR ? suggested : PRIORITY_FLOOR * 2n;
  const base = gasPrice > 0n ? gasPrice : PRIORITY_FLOOR;
  const maxFeePerGas = base * 3n + maxPriorityFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas };
}

const rpcErrors: string[] = [];
export function lastRpcErrors(): string[] {
  return rpcErrors;
}

function withCapture(base: ReturnType<typeof toModularTransport>) {
  return ((cfg: any) => {
    const t = (base as any)(cfg);
    const origRequest = t.request.bind(t);
    t.request = async (args: any, opts: any) => {
      try {
        return await origRequest(args, opts);
      } catch (e: any) {
        const detail =
          e?.details ?? e?.cause?.details ?? e?.cause?.message ?? e?.message ?? String(e);
        rpcErrors.push(`${args?.method}: ${String(detail).slice(0, 300)}`);
        if (rpcErrors.length > 6) rpcErrors.shift();
        throw e;
      }
    };
    return t;
  }) as any;
}

function transports() {
  if (!clientKey || !clientUrl) throw new Error("Circle client key/url not configured");
  return {
    passkey: toPasskeyTransport(clientUrl, clientKey),
    modular: withCapture(toModularTransport(`${clientUrl}/arcTestnet`, clientKey)),
  };
}

export function storedCredential(): P256Credential | null {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    return raw ? (JSON.parse(raw) as P256Credential) : null;
  } catch {
    return null;
  }
}

export function forgetCredential() {
  localStorage.removeItem(CRED_KEY);
}

export async function passkeyRegister(username: string): Promise<P256Credential> {
  const { passkey } = transports();
  const credential = await toWebAuthnCredential({
    transport: passkey,
    mode: WebAuthnMode.Register,
    username,
  });
  localStorage.setItem(CRED_KEY, JSON.stringify(credential));
  return credential;
}

export async function passkeyLogin(): Promise<P256Credential> {
  const { passkey } = transports();
  const credential = await toWebAuthnCredential({
    transport: passkey,
    mode: WebAuthnMode.Login,
  });
  localStorage.setItem(CRED_KEY, JSON.stringify(credential));
  return credential;
}

export async function smartAccountFor(credential: P256Credential): Promise<SmartAccount> {
  const { modular } = transports();
  const client = createPublicClient({ chain: arcTestnet, transport: modular });
  // type-cast: Circle SDK ships its own nested viem 2.23 typings; structurally identical at runtime
  return toCircleSmartAccount({ client: client as any, owner: toWebAuthnAccount({ credential }) });
}

export async function smartAccountBalance(address: `0x${string}`): Promise<string> {
  const { modular } = transports();
  const client = createPublicClient({ chain: arcTestnet, transport: modular });
  return formatEther(await client.getBalance({ address }));
}

/** Pay the Zunivo router from the smart account.
 *  Tries Gas Station sponsorship first; falls back to self-paid gas
 *  (gas is USDC on Arc, drawn from the same balance) if the bundler
 *  rejects the paymaster on this chain. */
export async function payWithPasskey(
  account: SmartAccount,
  orderId: `0x${string}`,
  merchant: `0x${string}`,
  amount: string,
  callOverride?: { to: `0x${string}`; value: bigint; data: `0x${string}` }
): Promise<{ txHash: `0x${string}`; gasless: boolean }> {
  const { modular } = transports();
  const bundler = createBundlerClient({ chain: arcTestnet, transport: modular });
  const calls = [
    callOverride ?? {
      to: ROUTER_ADDRESS,
      value: parseEther(amount),
      data: encodeFunctionData({ abi: ROUTER_ABI, functionName: "pay", args: [orderId, merchant] }),
    },
  ];
  const fees = await bundlerFees();
  let hash: `0x${string}`;
  let gasless = false;
  // Self-pay first: Circle's shared testnet paymaster is periodically
  // throttled by the bundler's reputation system, which leaves sponsored
  // ops accepted-but-never-included. The account pays its own tiny USDC
  // gas instead; sponsorship becomes the fallback, not the default.
  try {
    hash = await bundler.sendUserOperation({ account, calls, ...fees });
  } catch {
    gasless = true;
    hash = await bundler.sendUserOperation({ account, calls, paymaster: true, ...fees });
  }
  const { receipt } = await bundler.waitForUserOperationReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Payment reverted on-chain.");
  return { txHash: receipt.transactionHash, gasless };
}

/** Diagnostic: probe which user-op call shapes the bundler accepts on Arc.
 *  Sends two micro self-transfers (1 base unit, funds never leave the wallet). */
export async function diagnoseUserOps(account: SmartAccount): Promise<string> {
  const { modular } = transports();
  const bundler = createBundlerClient({ chain: arcTestnet, transport: modular });
  const results: string[] = [];

  const fees = await bundlerFees();
  const probe = async (label: string, calls: any[]) => {
    try {
      const h = await bundler.sendUserOperation({ account, calls, ...fees });
      await bundler.waitForUserOperationReceipt({ hash: h });
      results.push(label + ": OK");
    } catch (e: any) {
      const msg = (e && (e.shortMessage || e.message)) || "";
      results.push(label + ": REJECTED (" + String(msg).slice(0, 90) + ")");
    }
  };

  await probe("native-value call", [{ to: account.address, value: 1n }]);
  await probe("erc20-transfer call", [
    encodeTransfer(account.address, ContractAddress.ArcTestnet_USDC, 1n),
  ]);
  await probe("router-pay call (1 wei to self)", [
    {
      to: ROUTER_ADDRESS,
      value: 1n,
      data: encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "pay",
        args: [keccak256(toHex("diag-" + Date.now())), account.address],
      }),
    },
  ]);

  results.push("--- raw rpc errors ---");
  const errs = lastRpcErrors();
  if (errs.length === 0) results.push("(none captured)");
  for (const r of errs) results.push(r);
  results.push("entryPoint: " + (((account as any).entryPoint && (account as any).entryPoint.address) || "unknown"));
  return results.join("\n");
}
