import { getEth } from "./provider";
/** Shared wallet session controls. Connection permission lives inside the
 *  wallet extension; these helpers drive it via EIP-2255 permission calls. */
function eth() {
  return getEth();
}

export async function connectWallet(): Promise<`0x${string}`> {
  const e = eth();
  if (!e) throw new Error("No wallet detected.");
  const [a] = await e.request({ method: "eth_requestAccounts" });
  return a;
}

/** Opens the wallet's account picker so the user can switch accounts. */
export async function switchWallet(): Promise<`0x${string}` | null> {
  const e = eth();
  if (!e) return null;
  await e.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  const accs: string[] = await e.request({ method: "eth_accounts" });
  return (accs[0] as `0x${string}`) ?? null;
}

/** Revokes the site's account permission (MetaMask's programmatic disconnect). */
export async function disconnectWallet(): Promise<void> {
  const e = eth();
  if (!e) return;
  try {
    await e.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
  } catch {
    /* older wallets: permission UI only — local state is cleared by the caller */
  }
}

export function onAccountsChanged(cb: (accounts: string[]) => void): () => void {
  const e = eth();
  e?.on?.("accountsChanged", cb);
  return () => e?.removeListener?.("accountsChanged", cb);
}
