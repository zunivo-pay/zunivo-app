import { useEffect, useState } from "react";
import { getEth, requestAccounts } from "../lib/provider";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { API, getActivity, getSent, OrderView, SentView } from "../lib/api";
import { resolveName, parseHandle, displayName, namesOf } from "../lib/names";
import { switchWallet } from "../lib/wallet";
import { fetchScheduled, releaseLock, ScheduledView } from "../lib/scheduled";
import { useWalletAccount, useUsdcBalance, pickPrimary, setPrimaryName } from "../lib/useAccount";

type Tab = "overview" | "payments" | "scheduled" | "sent";

/** 2-decimal money formatting everywhere — no floating-point tails, no bare "0". */
const usd = (n: number | string) =>
  (Math.round(Number(n) * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

/** Live clock — 1s tick so countdowns feel alive. */
function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtLeft(secs: number): string {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
    m = Math.floor((secs % 3600) / 60), s = secs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** "Unlocks in 2d 4h 12m" → "ready to claim" — the certainty, made visible. */
function Countdown({ unlockAt, status }: { unlockAt: number; status: string }) {
  const now = useNow();
  if (status === "released") return null;
  const left = unlockAt - now;
  if (left > 0) return <div className="cdown">⏳ unlocks in {fmtLeft(left)}</div>;
  return <div className="cdown ready">✓ ready to claim</div>;
}

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
  const [lookupOpen, setLookupOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [namePick, setNamePick] = useState(false);
  const [primaryPref, setPrimaryPref] = useState<string | null>(null);

  const connected = useWalletAccount();
  const balance = useUsdcBalance(activeAddr || null);

  // the dashboard should greet you loaded — pick up the app-wide connection
  useEffect(() => {
    if (connected && !activeAddr && !busy) { setAddr(connected); load(connected); }
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setLookupOpen(false);
    setPrimaryPref(null);
    setNamePick(false);
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

  async function copyAddr() {
    await navigator.clipboard.writeText(activeAddr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!API)
    return (
      <div className="shell">
        <div className="card"><h1>Dashboard needs the server</h1>
          <p className="sub">Set VITE_API_URL and run zunivo-server to enable reconciliation.</p></div>
      </div>
    );

  const paidOrders = orders?.filter((o) => o.status === "paid") ?? [];
  const settled = paidOrders.reduce((s, o) => s + Number(o.amount), 0);
  const inFlight = sched?.incoming.filter((l) => l.status === "locked" || l.status === "claimable")
    .reduce((s, l) => s + Number(l.amount), 0) ?? 0;
  const committed = sched?.outgoing.filter((l) => l.status === "locked" || l.status === "claimable")
    .reduce((s, l) => s + Number(l.amount), 0) ?? 0;
  const schedCount = (sched?.incoming.length ?? 0) + (sched?.outgoing.length ?? 0);
  const nextIn = sched?.incoming
    .filter((l) => l.status === "locked" || l.status === "claimable")
    .sort((a, b) => a.unlockAt - b.unlockAt)[0];

  const statusChip = (s: string) => (
    <span className={`chip ${s === "released" || s === "paid" ? "paid" : "unpaid"}`}>{s}</span>
  );

  /** One human feed: money in, money out, links still waiting — newest first. */
  type Act = {
    key: string; ts: number; dir: "in" | "out" | "wait";
    title: string; amount: string; chip: string; href: string; ext?: boolean;
  };
  const activity: Act[] = [
    ...(orders ?? []).map((o): Act => ({
      key: `o${o.id}`,
      ts: o.payments[0]?.ts ?? o.createdAt,
      dir: o.status === "paid" ? "in" : "wait",
      title: o.memo || "Payment link",
      amount: o.amount, chip: o.status, href: `/r/${o.id}`,
    })),
    ...sent.map((p): Act => ({
      key: `t${p.txHash}`, ts: p.ts, dir: "out",
      title: p.memo || (p.to ? `To ${short(p.to)}` : "Sent"),
      amount: p.amount, chip: p.splitId != null ? "split" : "sent",
      href: `https://testnet.arcscan.app/tx/${p.txHash}`, ext: true,
    })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 8);

  const primaryLabel = primaryPref && myNames.includes(primaryPref)
    ? primaryPref
    : pickPrimary(activeAddr || "0x", myNames);
  const primaryName = primaryLabel ? `${primaryLabel}.agent` : null;

  function choosePrimary(label: string) {
    setPrimaryName(activeAddr, label);
    setPrimaryPref(label);
    setNamePick(false);
  }

  return (
    <div className="shell wide">
      <div className="pagehead" style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1>Dashboard</h1>
          <p>Everything this address earns, owes, and has promised — reconciled from the chain.</p>
        </div>
        {activeAddr && (
          <button className="linkbtn" style={{ fontSize: 12.5, paddingBottom: 6 }}
            onClick={() => setLookupOpen(!lookupOpen)}>
            {lookupOpen ? "close" : "View another address →"}
          </button>
        )}
      </div>

      {(!activeAddr || lookupOpen) && (
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
      )}

      {busy && !orders && <p className="hint">Loading this address…</p>}

      {orders && (
        <>
          {/* identity + balance hero */}
          <div className="dhero">
            <div className="idavatar" style={{ width: 52, height: 52, fontSize: 22 }}>
              {(myNames[0] ?? activeAddr.slice(2, 3)).slice(0, 1).toUpperCase()}
            </div>
            <div className="dwho">
              <div className="dname">
                {primaryName ?? short(activeAddr)}
                {myNames.length > 1 && (
                  <button className="dnames-toggle" onClick={() => setNamePick(!namePick)}>
                    +{myNames.length - 1} ▾
                  </button>
                )}
              </div>
              <button className="daddr mono" onClick={copyAddr} title="Copy address">
                {copied ? "✓ copied" : primaryName ? `${short(activeAddr)} ⧉` : "copy address ⧉"}
              </button>
              {myNames.length === 0 && (
                <div className="hint" style={{ marginTop: 4 }}>No .agent name yet — <Link to="/names">mint one</Link></div>
              )}
              {namePick && (
                <div className="namepick">
                  <div className="namepick-kicker">primary name</div>
                  {myNames.map((n) => (
                    <button key={n} className={`namepick-row ${n === primaryLabel ? "on" : ""}`}
                      onClick={() => choosePrimary(n)}>
                      {n}<span className="mint-accent">.agent</span>
                      {n === primaryLabel && <b>✓</b>}
                    </button>
                  ))}
                  <Link to="/names" className="namepick-manage" onClick={() => setNamePick(false)}>Manage names →</Link>
                </div>
              )}
            </div>
            <div className="dbal">
              <span className="dbal-kicker">balance</span>
              <span className="dbal-num">{balance !== null ? usd(balance) : "—"}<small> USDC</small></span>
            </div>
            <div className="dacts">
              <Link className="btn" style={{ width: "auto", marginTop: 0, padding: "9px 18px", fontSize: 14 }} to="/send">Send</Link>
              <Link className="btn ghost" style={{ width: "auto", marginTop: 0, padding: "9px 18px", fontSize: 14 }} to="/">Get paid</Link>
              <a className="linkbtn" style={{ alignSelf: "center" }}
                href={`${API}/api/merchants/${activeAddr}/export.csv`}>CSV ↓</a>
            </div>
          </div>

          {/* KPI row */}
          <div className="tiles" style={{ marginTop: 14 }}>
            <div className="tile">
              <span className="tkick">received · settled</span>
              <b>{usd(settled)}</b><span>USDC across {paidOrders.length} payment{paidOrders.length === 1 ? "" : "s"}</span>
            </div>
            <div className="tile">
              <span className="tkick">payment links</span>
              <b>{orders.length - paidOrders.length}</b><span>awaiting payment</span>
            </div>
            <div className="tile accent">
              <span className="tkick">locked for you</span>
              <b>{usd(inFlight)}</b>
              {nextIn
                ? <Countdown unlockAt={nextIn.unlockAt} status={nextIn.status} />
                : <span>USDC incoming</span>}
            </div>
            <div className="tile">
              <span className="tkick">committed out</span>
              <b>{usd(committed)}</b><span>USDC in scheduled sends</span>
            </div>
          </div>

          <div className="tabs" style={{ marginTop: 18 }}>
            <button className={`tab ${tab === "overview" ? "on" : ""}`} onClick={() => setTab("overview")}>Overview</button>
            <button className={`tab ${tab === "payments" ? "on" : ""}`} onClick={() => setTab("payments")}>
              Received<span className="cnt">{orders.length}</span>
            </button>
            <button className={`tab ${tab === "sent" ? "on" : ""}`} onClick={() => setTab("sent")}>
              Sent<span className="cnt">{sent.length}</span>
            </button>
            <button className={`tab ${tab === "scheduled" ? "on" : ""}`} onClick={() => setTab("scheduled")}>
              Scheduled<span className="cnt">{schedCount}</span>
            </button>
          </div>

          {tab === "overview" && (
            <div className="card">
              <h1 style={{ fontSize: 16 }}>Latest activity</h1>
              {activity.length === 0 && (
                <div className="dempty">
                  <p>Nothing here yet.</p>
                  <p className="hint">Create a <Link to="/">payment link</Link> or <Link to="/send">send USDC</Link> — every movement lands here with an on-chain receipt.</p>
                </div>
              )}
              <div className="actlist">
                {activity.map((a) => (
                  <div className="actrow" key={a.key}>
                    <span className={`acticon ${a.dir}`}>{a.dir === "in" ? "↓" : a.dir === "out" ? "↑" : "◷"}</span>
                    <div className="actmain">
                      <span className="acttitle">{a.title}</span>
                      <span className="actsub">{fmtTime(a.ts)} · {a.chip}</span>
                    </div>
                    <span className={`actamt ${a.dir}`}>
                      {a.dir === "in" ? "+" : a.dir === "out" ? "−" : ""}{usd(a.amount)}
                    </span>
                    {a.ext
                      ? <a className="actgo" href={a.href} target="_blank" rel="noreferrer">↗</a>
                      : <Link className="actgo" to={a.href}>→</Link>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div className="card">
              <table className="tx">
                <thead><tr><th>Created</th><th>Memo</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{fmtTime(o.createdAt)}</td>
                      <td>{o.memo ?? "—"}</td>
                      <td className="mono">{usd(o.amount)} USDC</td>
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
                <div className="dempty">
                  <p>No outgoing payments from this address yet.</p>
                  <p className="hint">Pay anyone by name from the <Link to="/send">Send</Link> page.</p>
                </div>
              )}
              {sent.length > 0 && (
                <table className="tx">
                  <thead><tr><th>When</th><th>To</th><th>Memo</th><th>Amount</th><th>Tx</th></tr></thead>
                  <tbody>
                    {sent.map((p) => (
                      <tr key={p.txHash}>
                        <td>{fmtTime(p.ts)}</td>
                        <td className="mono">{p.to ? short(p.to) : "—"}{p.splitId != null && <span className="chip paid" style={{ marginLeft: 6 }}>split</span>}</td>
                        <td>{p.memo ?? "—"}</td>
                        <td className="mono">{usd(p.amount)} USDC</td>
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
                <div className="dempty">
                  <p>No scheduled sends touch this address yet.</p>
                  <p className="hint">Lock a future payment from the <Link to="/send">Send</Link> page — payroll, rent, milestones.</p>
                </div>
              )}
              {sched && sched.incoming.length > 0 && (
                <>
                  <h1 style={{ fontSize: 16 }}>Incoming — locked for you</h1>
                  <table className="tx">
                    <thead><tr><th>Amount</th><th>Unlocks</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {sched.incoming.map((l) => (
                        <tr key={l.id}>
                          <td className="mono">{usd(l.amount)} USDC</td>
                          <td>{fmtTime(l.unlockAt)}<Countdown unlockAt={l.unlockAt} status={l.status} /></td>
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
                          <td className="mono">{usd(l.amount)} USDC</td>
                          <td>{fmtTime(l.unlockAt)}<Countdown unlockAt={l.unlockAt} status={l.status} /></td>
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
