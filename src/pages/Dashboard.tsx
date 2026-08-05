import { useState } from "react";
import { getEth, requestAccounts } from "../lib/provider";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { API, getActivity, getSent, OrderView, SentView } from "../lib/api";
import { resolveName, parseHandle, displayName, namesOf } from "../lib/names";
import { switchWallet } from "../lib/wallet";
import { fetchScheduled, releaseLock, ScheduledView } from "../lib/scheduled";

type Tab = "overview" | "payments" | "scheduled" | "sent";

export default function Dashboard() {
  const [addr, setAddr] = useState("");
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [activeAddr, setActiveAddr] = useState<string>("");
  const [sched, setSched] = useState<{ incoming: ScheduledView[]; outgoing: ScheduledView[] } | null>(null);
  const [sent, setSent] = useState<SentView[]>([]);
  const [myNames, setMyNames] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState<number | null>(null);

  async function useWallet() {
    const eth = getEth();
    if (!eth) return setErr("No wallet detected — paste your address instead.");
    const a = await requestAccounts(eth);
    if (!a) return setErr("No account authorized.");
    setAddr(a);
    load(a);
  }

  async function switchAndUse() {
    const a = await switchWallet().catch(() => null);
    if (a) { setAddr(a); load(a); }
  }

  async function load(a?: string) {
    let address = (a ?? addr).trim();
    setErr(null);
    if (address.startsWith("@") || address.toLowerCase().endsWith(".agent")) {
      const label = parseHandle(address);
      if (!label) return setErr("Invalid name format.");
      const resolved = await resolveName(label).catch(() => null);
      if (!resolved) return setErr(`${displayName(label)} is not registered.`);
      address = resolved;
    }
    if (!isAddress(address)) return setErr("Enter a valid 0x address or a .agent name.");
    setActiveAddr(address);
    try {
      setBusy(true);
      setOrders((await getActivity(address)).orders);
      fetchScheduled(address).then(setSched).catch(() => setSched(null));
      getSent(address).then(setSent).catch(() => setSent([]));
      namesOf(address as `0x${string}`).then(setMyNames).catch(() => setMyNames([]));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doRelease(id: number) {
    try {
      setReleasing(id);
      const tx = await releaseLock(id);
      setSched((prev) => prev && {
        incoming: prev.incoming.map((x) => x.id === id ? { ...x, status: "released" as const, settledTx: tx } : x),
        outgoing: prev.outgoing.map((x) => x.id === id ? { ...x, status: "released" as const, settledTx: tx } : x),
      });
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message);
    } finally {
      setReleasing(null);
    }
  }

  if (!API)
    return (
      <div className="shell">
        <div className="card"><h1>Dashboard needs the server</h1>
          <p className="sub">Set VITE_API_URL and run zunivo-server to enable reconciliation.</p></div>
      </div>
    );

  const fmt = (ts: number) => new Date(ts * 1000).toLocaleString();
  const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-6)}`;
  const paidCount = orders?.filter((o) => o.status === "paid").length ?? 0;
  const settled = orders?.filter((o) => o.status === "paid").reduce((s, o) => s + Number(o.amount), 0) ?? 0;
  const inFlight = sched?.incoming.filter((l) => l.status === "locked" || l.status === "claimable")
    .reduce((s, l) => s + Number(l.amount), 0) ?? 0;
  const committed = sched?.outgoing.filter((l) => l.status === "locked" || l.status === "claimable")
    .reduce((s, l) => s + Number(l.amount), 0) ?? 0;
  const schedCount = (sched?.incoming.length ?? 0) + (sched?.outgoing.length ?? 0);

  const statusChip = (s: string) => (
    <span className={`chip ${s === "released" || s === "paid" ? "paid" : "unpaid"}`}>{s}</span>
  );

  const recent = orders?.slice(0, 5) ?? [];

  return (
    <div className="shell wide">
      <div className="pagehead">
        <h1>Dashboard</h1>
        <p>Everything this address earns, owes, and has promised — reconciled from the chain.</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ marginTop: 0 }}>Wallet address or .agent name</label>
        <input placeholder="0x… or yourname.agent" value={addr}
          onChange={(e) => setAddr(e.target.value.trim())}
          onKeyDown={(e) => e.key === "Enter" && load()} />
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => load()}>
            {busy ? "Loading…" : "Load"}
          </button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={useWallet}>Use my wallet</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          <button className="linkbtn" onClick={switchAndUse}>Switch to another wallet…</button>
        </p>
        {err && <p className="err">{err}</p>}
      </div>

      {orders && (
        <>
          <div className="idcard">
            <div className="idavatar">{(myNames[0] ?? activeAddr.slice(2, 3)).slice(0, 1).toUpperCase()}</div>
            <div className="idmeta">
              <div className="idaddr">{short(activeAddr)}</div>
              <div className="idnames">
                {myNames.length > 0
                  ? myNames.map((n) => <span key={n} className="namechip">{n}<b>.agent</b></span>)
                  : <span className="hint">No .agent names yet — <Link to="/names">mint one</Link></span>}
              </div>
            </div>
            <a className="btn ghost" style={{ marginTop: 0, width: "auto", padding: "9px 16px" }}
              href={`${API}/api/merchants/${activeAddr}/export.csv`}>Download CSV</a>
          </div>

          <div className="tabs">
            <button className={`tab ${tab === "overview" ? "on" : ""}`} onClick={() => setTab("overview")}>Overview</button>
            <button className={`tab ${tab === "payments" ? "on" : ""}`} onClick={() => setTab("payments")}>
              Payments<span className="cnt">{orders.length}</span>
            </button>
            <button className={`tab ${tab === "scheduled" ? "on" : ""}`} onClick={() => setTab("scheduled")}>
              Scheduled<span className="cnt">{schedCount}</span>
            </button>
            <button className={`tab ${tab === "sent" ? "on" : ""}`} onClick={() => setTab("sent")}>
              Sent<span className="cnt">{sent.length}</span>
            </button>
          </div>

          {tab === "overview" && (
            <>
              <div className="tiles">
                <div className="tile"><b>{orders.length}</b><span>orders</span></div>
                <div className="tile"><b>{paidCount}</b><span>paid</span></div>
                <div className="tile"><b>{settled}</b><span>USDC settled</span></div>
                <div className="tile accent"><b>{inFlight}</b><span>USDC locked incoming</span></div>
                <div className="tile"><b>{committed}</b><span>USDC committed out</span></div>
              </div>
              {recent.length > 0 && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h1 style={{ fontSize: 16 }}>Recent activity</h1>
                  <table className="tx">
                    <tbody>
                      {recent.map((o) => (
                        <tr key={o.id}>
                          <td>{fmt(o.createdAt)}</td>
                          <td>{o.memo ?? "—"}</td>
                          <td className="mono">{o.amount} USDC</td>
                          <td>{statusChip(o.status)}</td>
                          <td><Link to={`/r/${o.id}`}>view</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "payments" && (
            <div className="card">
              <table className="tx">
                <thead><tr><th>Created</th><th>Memo</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{fmt(o.createdAt)}</td>
                      <td>{o.memo ?? "—"}</td>
                      <td className="mono">{o.amount} USDC</td>
                      <td>{statusChip(o.status)}</td>
                      <td><Link to={`/r/${o.id}`}>view</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "sent" && (
            <div className="card">
              {sent.length === 0 && (
                <p className="hint">No outgoing payments from this address yet.</p>
              )}
              {sent.length > 0 && (
                <table className="tx">
                  <thead><tr><th>When</th><th>To</th><th>Memo</th><th>Amount</th><th>Tx</th></tr></thead>
                  <tbody>
                    {sent.map((p) => (
                      <tr key={p.txHash}>
                        <td>{fmt(p.ts)}</td>
                        <td className="mono">{p.to ? short(p.to) : "—"}{p.splitId != null && <span className="chip paid" style={{ marginLeft: 6 }}>split</span>}</td>
                        <td>{p.memo ?? "—"}</td>
                        <td className="mono">{p.amount} USDC</td>
                        <td><a className="txlink" href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noreferrer">↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "scheduled" && (
            <div className="card">
              {(!sched || schedCount === 0) && (
                <p className="hint">No scheduled sends touch this address yet — make one from the <Link to="/send">Send</Link> page.</p>
              )}
              {sched && sched.incoming.length > 0 && (
                <>
                  <h1 style={{ fontSize: 16 }}>Incoming — locked for you</h1>
                  <table className="tx">
                    <thead><tr><th>Amount</th><th>Unlocks</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {sched.incoming.map((l) => (
                        <tr key={l.id}>
                          <td className="mono">{l.amount} USDC</td>
                          <td>{fmt(l.unlockAt)}</td>
                          <td>{statusChip(l.status)}</td>
                          <td>
                            {l.status === "claimable" && (
                              <button className="linkbtn" disabled={releasing === l.id} onClick={() => doRelease(l.id)}>
                                {releasing === l.id ? "releasing…" : "release now"}
                              </button>
                            )}
                            {l.settledTx && (
                              <a className="txlink" href={`https://testnet.arcscan.app/tx/${l.settledTx}`} target="_blank" rel="noreferrer"> tx ↗</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {sched && sched.outgoing.length > 0 && (
                <>
                  <h1 style={{ fontSize: 16, marginTop: 18 }}>Outgoing — your commitments</h1>
                  <table className="tx">
                    <thead><tr><th>To</th><th>Amount</th><th>Unlocks</th><th>Terms</th><th>Status</th></tr></thead>
                    <tbody>
                      {sched.outgoing.map((l) => (
                        <tr key={l.id}>
                          <td className="mono">{short(l.recipient)}</td>
                          <td className="mono">{l.amount} USDC</td>
                          <td>{fmt(l.unlockAt)}</td>
                          <td>{l.reclaimAt === 0
                            ? <span className="chip paid">committed</span>
                            : <span className="chip unpaid">refundable</span>}</td>
                          <td>{statusChip(l.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
