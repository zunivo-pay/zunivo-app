/** Single source of truth for the wallet provider.
 *  - EIP-6963: discovers every installed extension wallet (MetaMask, OKX, Rabby, …)
 *  - WalletConnect: QR pairing for mobile wallets (enabled when VITE_WC_PROJECT_ID is set)
 *  Everything else in the app asks getEth() instead of touching window.ethereum. */

export type WalletInfo = { uuid: string; name: string; icon: string; rdns: string };
type Detail = { info: WalletInfo; provider: any };

const found = new Map<string, Detail>();
let selected: any = null;
let selectedName = "";
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (e: any) => {
    const d = e.detail as Detail;
    if (d?.info?.rdns) { found.set(d.info.rdns, d); emit(); }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  // restore last explicit choice once wallets have announced
  setTimeout(() => {
    const r = localStorage.getItem("zunivo_wallet_rdns");
    if (r && !selected && found.has(r)) {
      selected = found.get(r)!.provider;
      selectedName = found.get(r)!.info.name;
      emit();
    }
  }, 400);
}

export function listWallets(): WalletInfo[] {
  return [...found.values()].map((d) => d.info);
}
export function subscribeWallets(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
/** The provider the app should use right now (explicit choice, else the browser default). */
export function getEth(): any {
  return selected ?? (window as any).ethereum ?? null;
}
export function connectedWalletName(): string {
  return selectedName || ((window as any).ethereum ? "Browser wallet" : "");
}
export function hasWalletConnect(): boolean {
  return Boolean(import.meta.env.VITE_WC_PROJECT_ID);
}

export async function useInjected(rdns: string): Promise<any> {
  const d = found.get(rdns);
  if (!d) throw new Error("Wallet not found.");
  selected = d.provider;
  selectedName = d.info.name;
  localStorage.setItem("zunivo_wallet_rdns", rdns);
  emit();
  return selected;
}

export async function useWalletConnect(): Promise<any> {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;
  if (!projectId) throw new Error("WalletConnect is not configured.");
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const p: any = await EthereumProvider.init({
    projectId,
    chains: [5042002],
    showQrModal: true,
    rpcMap: { 5042002: "https://rpc.testnet.arc.network" },
    metadata: {
      name: "Zunivo",
      description: "USDC payments & names on Arc",
      url: "https://app.zunivo.io",
      icons: ["https://zunivo.io/favicon.svg"],
    },
  });
  await p.enable();
  selected = p;
  selectedName = "WalletConnect";
  localStorage.removeItem("zunivo_wallet_rdns");
  emit();
  return p;
}

/** Used by the AppKit bridge: whatever the modal connected becomes the app-wide provider. */
export function setExternalProvider(provider: any, name: string) {
  selected = provider;
  selectedName = name;
  emit();
}

export function clearSelection() {
  selected = null;
  selectedName = "";
  localStorage.removeItem("zunivo_wallet_rdns");
  emit();
}

/** Deduped eth_requestAccounts. MetaMask allows only ONE pending connection
 *  request at a time; a second concurrent call (double-click, two components)
 *  throws "previous request is still active". This shares one in-flight promise
 *  so every caller awaits the same prompt instead of racing it. */
let inflight: Promise<`0x${string}` | null> | null = null;
export function requestAccounts(provider?: any): Promise<`0x${string}` | null> {
  const eth = provider ?? getEth();
  if (!eth) return Promise.reject(new Error("No wallet detected."));
  if (inflight) return inflight;
  const p = eth
    .request({ method: "eth_requestAccounts" })
    .then((accs: string[]) => (accs?.[0] as `0x${string}`) ?? null)
    .finally(() => { inflight = null; });
  inflight = p;
  return p;
}
