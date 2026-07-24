import { useEffect, useState } from "react";
import {
  listWallets, subscribeWallets, useInjected, useWalletConnect,
  hasWalletConnect, getEth, connectedWalletName, clearSelection, WalletInfo,
} from "./provider";
import { disconnectWallet } from "./wallet";

export default function ConnectModal({
  open, onClose, account, onAccount,
}: {
  open: boolean;
  onClose: () => void;
  account: string | null;
  onAccount: (a: string | null) => void;
}) {
  const [wallets, setWallets] = useState<WalletInfo[]>(listWallets());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => subscribeWallets(() => setWallets(listWallets())), []);
  if (!open) return null;

  async function finishConnect() {
    const eth = getEth();
    const [a] = await eth.request({ method: "eth_requestAccounts" });
    onAccount(a ?? null);
    onClose();
  }

  async function pickInjected(w: WalletInfo) {
    try {
      setErr(null); setBusy(w.rdns);
      await useInjected(w.rdns);
      await finishConnect();
    } catch (e: any) {
      setErr(e?.message ?? "Connection failed.");
    } finally { setBusy(null); }
  }

  async function pickWC() {
    try {
      setErr(null); setBusy("wc");
      await useWalletConnect();
      await finishConnect();
    } catch (e: any) {
      setErr(e?.message ?? "Connection failed.");
    } finally { setBusy(null); }
  }

  async function doDisconnect() {
    await disconnectWallet().catch(() => {});
    clearSelection();
    onAccount(null);
    onClose();
  }

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Connect a wallet</h3>
        {account && (
          <p className="cm-connected">
            Connected: <span className="mono">{account.slice(0, 6)}…{account.slice(-4)}</span>
            {connectedWalletName() && <> · {connectedWalletName()}</>}
            <button className="linkbtn" style={{ marginLeft: 10 }} onClick={doDisconnect}>disconnect</button>
          </p>
        )}
        {wallets.length === 0 && (
          <p className="hint">No extension wallets detected in this browser.</p>
        )}
        {wallets.map((w) => (
          <button key={w.rdns} className="cm-row" disabled={busy !== null} onClick={() => pickInjected(w)}>
            <img src={w.icon} alt="" width={26} height={26} />
            <span>{w.name}</span>
            <span className="cm-go">{busy === w.rdns ? "…" : "→"}</span>
          </button>
        ))}
        {hasWalletConnect() && (
          <button className="cm-row" disabled={busy !== null} onClick={pickWC}>
            <span className="cm-wc" aria-hidden="true">◈</span>
            <span>WalletConnect <small style={{ color: "var(--slate)" }}>· mobile wallets via QR</small></span>
            <span className="cm-go">{busy === "wc" ? "…" : "→"}</span>
          </button>
        )}
        {err && <p className="err">{err}</p>}
        <p className="hint" style={{ marginTop: 12 }}>
          No wallet? Every payment page also accepts a passkey — no extension needed.
        </p>
      </div>
    </div>
  );
}
