import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAddress, keccak256, toHex } from "viem";
import { API, createOrder } from "../lib/api";
import { resolveName, parseHandle, displayName } from "../lib/names";
import { createScheduledSend } from "../lib/scheduled";
import { ZunivoMark } from "../lib/Logo";

export default function Send() {
  const nav = useNavigate();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState("");
  const [allowReclaim, setAllowReclaim] = useState(false);
  const [schedTx, setSchedTx] = useState<string | null>(null);

  const touch = () => setSchedTx(null);

  async function checkRecipient() {
    setResolvedHint(null);
    const t = to.trim();
    if (t.startsWith("@") || t.toLowerCase().endsWith(".agent")) {
      const label = parseHandle(t);
      if (!label) return;
      const addr = await resolveName(label).catch(() => null);
      setResolvedHint(addr ? `${displayName(label)} → ${addr.slice(0, 8)}…${addr.slice(-6)}` : `${displayName(label)} is not registered`);
    }
  }

  async function send() {
    setErr(null);
    let dest = to.trim();
    let label: string | null = null;
    if (dest.startsWith("@") || dest.toLowerCase().endsWith(".agent")) {
      label = parseHandle(dest);
      if (!label) return setErr("Invalid name format.");
      const resolved = await resolveName(label).catch(() => null);
      if (!resolved) return setErr(`${displayName(label)} is not registered.`);
      dest = resolved;
    }
    if (!isAddress(dest)) return setErr("Enter a valid 0x address or a .agent name.");
    const amt = Number(amount);
    if (!amount || !isFinite(amt) || amt <= 0) return setErr("Enter a valid USDC amount.");
    if (!API) return setErr("Sending needs the Zunivo server running.");

    if (mode === "schedule") {
      const ts = Math.floor(new Date(when).getTime() / 1000);
      if (!when || isNaN(ts)) return setErr("Pick an unlock date and time.");
      if (ts <= Math.floor(Date.now() / 1000) + 60) return setErr("Unlock time must be in the future.");
      try {
        setBusy(true);
        setSchedTx(null);
        const orderId = keccak256(toHex(crypto.randomUUID()));
        const tx = await createScheduledSend(dest as `0x${string}`, amount, ts, allowReclaim, orderId);
        setSchedTx(tx);
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? "Scheduling failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      setBusy(true);
      const memo = note.trim()
        ? `${note.trim()}${label ? ` · to ${displayName(label)}` : ""}`
        : label ? `Sent to ${displayName(label)}` : "Direct send";
      const { id } = await createOrder(dest, amount, memo);
      nav(`/pay?oid=${id}`);
    } catch (e: any) {
      setErr(e.message ?? "Failed to prepare the payment.");
    } finally {
      setBusy(false);
    }
  }

  const short = (s: string) =>
    s.startsWith("0x") && s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s || "—";
  const whenText = when ? new Date(when).toLocaleString() : "—";

  return (
    <div className="split">
      <div className="pagehead">
        <h1>Send USDC</h1>
        <p>Pay anyone by name or address — instantly, or as a locked commitment they can count on.</p>
      </div>

      <div className="card">
        <label style={{ marginTop: 0 }}>How should it arrive?</label>
        <div className="scenarios">
          <button type="button" className={`scenario ${mode === "now" ? "on" : ""}`}
            onClick={() => { setMode("now"); touch(); }}>
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="#3D5AFE"/></svg>
              Send now
            </h4>
            <p>Settles in under a second, receipt for both sides.</p>
            <p className="aud">For splitting bills · paying a freelancer · refunds</p>
          </button>
          <button type="button" className={`scenario ${mode === "schedule" ? "on" : ""}`}
            onClick={() => { setMode("schedule"); touch(); }}>
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.5" stroke="#10C48B" strokeWidth="2.4"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#10C48B" strokeWidth="2.4"/></svg>
              Schedule &amp; commit
            </h4>
            <p>Locked on-chain until a date — irrevocable once sent.</p>
            <p className="aud">For payroll · rent · milestone payments</p>
          </button>
        </div>

        <label>Recipient — .agent name or 0x address</label>
        <input placeholder="alice.agent or 0x…" value={to}
          onChange={(e) => { setTo(e.target.value); touch(); }} onBlur={checkRecipient} />
        {resolvedHint && <p className="hint">{resolvedHint}</p>}

        <label>Amount (USDC)</label>
        <input placeholder="5.00" inputMode="decimal" value={amount}
          onChange={(e) => { setAmount(e.target.value.trim()); touch(); }} />

        {mode === "now" && (
          <>
            <label>Note (optional — appears on both receipts)</label>
            <input placeholder="Dinner split · thanks!" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {mode === "schedule" && (
          <>
            <label>Unlock date &amp; time</label>
            <input type="datetime-local" value={when} onChange={(e) => { setWhen(e.target.value); touch(); }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={allowReclaim}
                onChange={(e) => { setAllowReclaim(e.target.checked); touch(); }} />
              Allow reclaim if unclaimed 30 days after unlock
            </label>
          </>
        )}

        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy} onClick={send}>
          {busy ? (mode === "schedule" ? "Locking…" : "Preparing…") : mode === "schedule" ? "Lock funds until unlock" : "Continue to pay"}
        </button>
      </div>

      <div className="cert">
        {mode === "now" ? (
          <>
            <p className="cert-kicker">instant transfer</p>
            <div className="big">{amount || "0.00"}<small>USDC</small></div>
            <div className="crow"><span>To</span><span>{short(to)}</span></div>
            {note && <div className="crow"><span>Note</span><span style={{ fontFamily: "var(--body)" }}>{note}</span></div>}
            <div className="crow"><span>Settlement</span><span>&lt; 1 second</span></div>
            <div className="crow"><span>Route</span><span>non-custodial · atomic</span></div>
            <div className="crow"><span>Fee</span><span>0%</span></div>
            <p className="foot-note">
              One on-chain transaction through the verified Zunivo router. Both of you get a
              receipt, and it lands in each dashboard automatically.
            </p>
          </>
        ) : (
          <>
            <p className="cert-kicker">commitment certificate</p>
            <div className="big">{amount || "0.00"}<small>USDC</small></div>
            <div className="crow"><span>Beneficiary</span><span>{short(to)}</span></div>
            <div className="crow"><span>Unlocks</span><span>{whenText}</span></div>
            <div className="crow"><span>Terms</span>
              <span>{allowReclaim
                ? <span className="badge refb">REFUNDABLE · 30D GRACE</span>
                : <span className="badge lockb">IRREVOCABLE</span>}</span>
            </div>
            <div className="crow"><span>Custody</span><span>keyless contract</span></div>
            {schedTx ? (
              <p className="foot-note">
                <span className="sealed">Locked on-chain ✓</span>{" "}
                <a className="txlink" href={`https://testnet.arcscan.app/tx/${schedTx}`} target="_blank" rel="noreferrer">view transaction ↗</a>
                <br />The beneficiary can already see this commitment — countdown and all — in their dashboard.
              </p>
            ) : (
              <p className="foot-note">
                {allowReclaim
                  ? "The beneficiary gets an exclusive 30-day window after unlock; only unclaimed funds can ever return to you."
                  : "Once locked, no one can take this back — not you, not Zunivo. Release is permissionless after unlock, but funds can only flow to the beneficiary."}
              </p>
            )}
            <p style={{ marginTop: 14 }}><ZunivoMark size={26} /></p>
          </>
        )}
      </div>
    </div>
  );
}
