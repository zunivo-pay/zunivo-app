/** Reown AppKit integration — the industry-standard connect modal
 *  (injected wallets + WalletConnect QR + 590+ wallet directory).
 *  Enabled when VITE_WC_PROJECT_ID is set; otherwise Shell falls back
 *  to the built-in lightweight modal. */
import { useEffect } from "react";
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { setExternalProvider } from "./provider";
import { useDisplayName } from "./useAccount";

const projectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;
export const APPKIT_ENABLED = Boolean(projectId);

const arcNetwork = {
  id: 5042002,
  caipNetworkId: "eip155:5042002",
  chainNamespace: "eip155",
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
};

if (projectId) {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [arcNetwork as any],
    defaultNetwork: arcNetwork as any,
    projectId,
    metadata: {
      name: "Zunivo",
      description: "USDC payments & names on Arc",
      url: "https://app.zunivo.io",
      icons: ["https://zunivo.io/favicon.svg"],
    },
    features: { analytics: false, email: false, socials: false },
    enableCoinbase: false,
    themeMode: "dark",
    themeVariables: { "--w3m-accent": "#3D5AFE" },
  });
}

export function AppKitConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  useEffect(() => {
    if (walletProvider) setExternalProvider(walletProvider, "AppKit");
  }, [walletProvider]);

  const displayName = useDisplayName(isConnected ? address : null);
  return (
    <button className="connectbtn" onClick={() => open()}>
      {isConnected && address
        ? displayName ?? `${address.slice(0, 6)}…${address.slice(-4)}`
        : "Connect"}
    </button>
  );
}
