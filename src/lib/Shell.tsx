import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ConnectModal from "./ConnectModal";
import { APPKIT_ENABLED, AppKitConnectButton } from "./appkit";
import { getEth } from "./provider";
import { useDisplayName } from "./useAccount";

const CONTRACTS = "https://zunivo.io/#trust";

export default function Shell({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  const { pathname } = useLocation();
  const [cmOpen, setCmOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const fallbackName = useDisplayName(account);
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const eth = getEth();
        if (!eth) return;
        const accs: string[] = await eth.request({ method: "eth_accounts" });
        if (accs?.[0]) setAccount(accs[0]);
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, []);
  const cls = (p: string, exact = true) =>
    (exact ? pathname === p : pathname.startsWith(p)) ? "on" : "";
  return (
    <div className={dark ? "page darkpage" : "page"}>
      <header className="appbar">
        <div className="abwrap">
          <Link to="/" className="ablogo" aria-label="Zunivo home">
            <svg width="30" height="22" viewBox="0 0 152 112" aria-hidden="true">
              <rect x="20" y="20" width="72" height="14" rx="7" fill="#3D5AFE" />
              <line x1="82" y1="41" x2="30" y2="81" stroke="#10C48B" strokeWidth="14" strokeLinecap="round" />
              <circle cx="30" cy="81" r="5" fill="#0B8F63" />
              <rect x="20" y="88" width="72" height="14" rx="7" fill="#3D5AFE" />
            </svg>
            <span>zunivo</span>
          </Link>
          <nav className="abnav">
            <Link className={cls("/")} to="/">Get paid</Link>
            <Link className={cls("/send")} to="/send">Send</Link>
            <Link className={cls("/names")} to="/names">Names</Link>
            <Link className={cls("/agents")} to="/agents">Agents</Link>
            <Link className={cls("/dashboard")} to="/dashboard">Dashboard</Link>
          </nav>
          {APPKIT_ENABLED ? (
            <AppKitConnectButton />
          ) : (
            <button className="connectbtn" onClick={() => setCmOpen(true)}>
              {account ? fallbackName ?? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect"}
            </button>
          )}
        </div>
      </header>
      <ConnectModal open={cmOpen} onClose={() => setCmOpen(false)} account={account} onAccount={setAccount} />
      <main className="abmain">{children}</main>
      <footer className="abfoot">
        <span>Powered by <b>zunivo</b> · Arc Testnet</span>
        <a href={CONTRACTS} target="_blank" rel="noreferrer">verified contracts ↗</a>
      </footer>
    </div>
  );
}
