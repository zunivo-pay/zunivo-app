import { useEffect, useState } from "react";
import { useWalletAccount } from "../lib/useAccount";
import { ingestNameTx } from "../lib/api";
import { APPKIT_ENABLED, openConnectModal } from "../lib/appkit";
import { getEth } from "../lib/provider";
import { Link } from "react-router-dom";
import { formatEther } from "viem";
import { Brand } from "../lib/Logo";
import { connectWallet, switchWallet, disconnectWallet, onAccountsChanged } from "../lib/wallet";
import NameCard from "../lib/NameCard";
import {
  resolveName, getMintPrice, mintName, namesOf,
  parseHandle, displayName, tokenIdOf, NAMES_ADDRESS,
} from "../lib/names";

const EXPLORER = "https://testnet.arcscan.app";

export default function Names() {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [price, setPrice] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const globalAccount = useWalletAccount();
  useEffect(() => {
    if (globalAccount && !account) setAccount(globalAccount);
  }, [globalAccount]); // inherit the app-wide connection instead of asking again
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => {
    getMintPrice().then(setPrice).catch(() => {});
    return onAccountsChanged((accs) => {
      if (accs.length === 0) { setAccount(null); setMine([]); }
      else { setAccount(accs[0] as `0x${string}`); loadMine(accs[0] as `0x${string}`); }
    });
  }, []);

  async function loadMine(addr: `0x${string}`) {
    try { setMine(await namesOf(addr)); } catch {}
  }

  useEffect(() => {
    if (account) loadMine(account);
  }, [account]); // gallery always follows the account, however it was set

  async function connect() {
    try {
      const a = await connectWallet();
      setAccount(a);
      loadMine(a);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function doSwitch() {
    const a = await switchWallet().catch(() => null);
    if (a) { setAccount(a); setMine([]); loadMine(a); }
  }

  async function doDisconnect() {
    await disconnectWallet();
    setAccount(null);
    setMine([]);
  }

  async function check() {
    setErr(null); setTxHash(null); setMinted(null); setAvailable(false); setChecked(null);
    const label = parseHandle(query);
    if (!label) return setStatus("Invalid — 3-20 chars: a-z, 0-9, dashes (not at the ends).");
    setQuery(label);
    try {
      setBusy(true);
      const owner = await resolveName(label);
      setChecked(label);
      if (owner) setStatus(`${displayName(label)} is taken → pays ${owner.slice(0, 8)}…${owner.slice(-6)}`);
      else { setStatus(null); setAvailable(true); }
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  async function doMint() {
    if (price === null || !checked) return;
    try {
      setBusy(true); setErr(null);
      const hash = await mintName(checked, price);
      setTxHash(hash);
      setMinted(checked);
      setAvailable(false);
      // the receipt IS the proof — show the new name instantly
      setMine((prev) => (prev.includes(checked!) ? prev : [checked!, ...prev]));
      // and fast-track the server so every other surface catches up in seconds
      ingestNameTx(hash).then(() => { if (account) loadMine(account); });
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Mint failed.");
    } finally { setBusy(false); }
  }

  const tokenLink = (label: string) =>
    `${EXPLORER}/token/${NAMES_ADDRESS}/instance/${tokenIdOf(label)}`;

  return (
    <div className="shell wide">
      <div className="pagehead">
        <h1 className="grad-title">Own your payment name</h1>
        <p>
          <span className="mint-accent">yourname.agent</span> is an NFT on Arc — fully on-chain art
          and metadata, tradable, and it routes USDC to whoever holds it.
          {price !== null && <> Mint: <b style={{ color: "var(--ink)" }}>{formatEther(price)} USDC</b>.</>}
        </p>
      </div>

      <div className="npanel">
        <label style={{ marginTop: 0 }}>Search a name</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input placeholder="yourname.agent" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()} />
          <button className="btn" style={{ width: 120, marginTop: 0 }} disabled={busy} onClick={check}>Check</button>
        </div>
        {status && <p className="hint" style={{ marginTop: 10 }}>{status}</p>}
        {err && <p className="err">{err}</p>}

        {available && checked && (
          <div className="nftwrap">
            <span className="nftglow"><NameCard label={checked} size={210} /></span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p className="hint" style={{ marginBottom: 4 }}>
                <b style={{ color: "var(--mint)" }}>{displayName(checked)} is available.</b>
              </p>
              <p className="hint">This exact card is generated by the contract itself —
                what you see is what your wallet and any NFT marketplace will show.</p>
              <button className="btn mintbtn" disabled={busy} onClick={doMint}>
                {busy ? "Minting…" : `Mint ${displayName(checked)}${price !== null ? ` · ${formatEther(price)} USDC` : ""}`}
              </button>
            </div>
          </div>
        )}

        {minted && (
          <div className="nftwrap">
            <span className="nftglow"><NameCard label={minted} size={210} /></span>
            <div>
              <p className="hint"><b style={{ color: "var(--mint)" }}>{displayName(minted)} is yours.</b></p>
              {txHash && (
                <p className="hint">
                  <a className="txlink" href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">Mint transaction ↗</a>
                  {"  ·  "}
                  <a className="txlink" href={tokenLink(minted)} target="_blank" rel="noreferrer">View NFT ↗</a>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="npanel" style={{ marginTop: 18 }}>
        <h1 style={{ fontSize: 18 }}>My names</h1>
        {!account && <button className="btn ghost" onClick={() => (APPKIT_ENABLED ? openConnectModal() : connect())}>Connect wallet</button>}
        {account && (
          <p className="hint" style={{ marginBottom: 6 }}>
            Connected: <span className="mono">{account.slice(0, 8)}…{account.slice(-6)}</span>
            {"  "}<button className="linkbtn" onClick={doSwitch}>switch</button>
            {"  "}<button className="linkbtn" onClick={doDisconnect}>disconnect</button>
          </p>
        )}
        {account && mine.length === 0 && <p className="hint">No names on this wallet yet.</p>}
        <div className="nftgrid">
          {mine.map((n) => (
            <Link key={n} to={`/names/${n}`} className="nfttile">
              <NameCard label={n} size={220} />
              <span className="nfttile-open">Manage <b>→</b></span>
            </Link>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          Registry:{" "}
          <a className="txlink" href={`${EXPLORER}/address/${NAMES_ADDRESS}`} target="_blank" rel="noreferrer">
            {NAMES_ADDRESS.slice(0, 10)}… ↗
          </a>{" "}
          · art &amp; metadata 100% on-chain
        </p>
      </div>
      <p className="foot">Powered by <b>zunivo</b> · names are ERC-721 tokens on Arc Testnet</p>
    </div>
  );
}
