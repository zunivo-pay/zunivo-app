import { useState } from "react";
import { isAddress } from "viem";
import QRCode from "qrcode";
import { API, createOrder } from "../lib/api";
import { resolveName, parseHandle, displayName } from "../lib/names";
import { ZunivoMark } from "../lib/Logo";
import { createSplitOnChain } from "../lib/split";

export default function Create() {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rmode, setRmode] = useState<"single" | "split">("single");
  const [payees, setPayees] = useState<{ dest: string; pct: string }[]>([
    { dest: "", pct: "70" }, { dest: "", pct: "30" },
  ]);
  const pctTotal = payees.reduce((s, p) => s + (Number(p.pct) || 0), 0);

  const setPayee = (i: number, field: "dest" | "pct", v: string) => {
    setLink(null);
    setPayees((ps) => ps.map((p, j) => (j === i ? { ...p, [field]: v } : p)));
  };
  const addPayee = () => setPayees((ps) => [...ps, { dest: "", pct: "" }]);
  const rmPayee = (i: number) => setPayees((ps) => ps.filter((_, j) => j !== i));

  async function resolveOne(input: string): Promise<`0x${string}` | null> {
    let dest = input.trim();
    if (dest.startsWith("@") || dest.toLowerCase().endsWith(".agent")) {
      const label = parseHandle(dest);
      if (!label) return null;
      return (await resolveName(label).catch(() => null)) as `0x${string}` | null;
    }
    return isAddress(dest) ? (dest as `0x${string}`) : null;
  }

  async function generate() {
    setErr(null);
    setCopied(false);

    if (rmode === "split") {
      const amt = Number(amount);
      if (!amount || !isFinite(amt) || amt <= 0) return setErr("Enter a valid USDC amount.");
      if (payees.length < 2) return setErr("A split needs at least two recipients.");
      if (pctTotal !== 100) return setErr("Shares must add up to exactly 100%.");
      try {
        setBusy(true);
        const addrs: `0x${string}`[] = [];
        for (const p of payees) {
          const a = await resolveOne(p.dest);
          if (!a) return setErr(`Can't resolve "${p.dest || "(empty)"}" — use a 0x address or a registered .agent name.`);
          addrs.push(a);
        }
        const bps = payees.map((p) => Math.round(Number(p.pct) * 100));
        if (bps.some((b) => b <= 0)) return setErr("Every share must be greater than 0%.");
        const { splitId, creator } = await createSplitOnChain(addrs, bps);
        if (!API) return setErr("Split links need the Zunivo server running.");
        const { id } = await createOrder(creator, amount, memo || `Split payment · ${payees.length} recipients`, splitId);
        const url = `${window.location.origin}/pay?oid=${id}`;
        setLink(url);
        setQr(await QRCode.toDataURL(url, { width: 210, margin: 1, color: { dark: "#101828" } }));
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? "Failed to create the split.");
      } finally {
        setBusy(false);
      }
      return;
    }

    let dest = merchant;
    if (dest.startsWith("@") || dest.toLowerCase().endsWith(".agent")) {
      const label = parseHandle(dest);
      if (!label) return setErr("Invalid name format.");
      const resolved = await resolveName(label).catch(() => null);
      if (!resolved) return setErr(`${displayName(label)} is not registered — mint it on the Names page.`);
      dest = resolved;
    }
    if (!isAddress(dest)) return setErr("Enter a valid 0x address or a .agent name.");
    const amt = Number(amount);
    if (!amount || !isFinite(amt) || amt <= 0) return setErr("Enter a valid USDC amount.");

    try {
      setBusy(true);
      let url: string;
      if (API) {
        const { id } = await createOrder(dest, amount, memo);
        url = `${window.location.origin}/pay?oid=${id}`;
      } else {
        const oid = crypto.randomUUID();
        const params = new URLSearchParams({ to: dest, amt: amount, oid });
        if (memo.trim()) params.set("memo", memo.trim());
        url = `${window.location.origin}/pay?${params.toString()}`;
      }
      setLink(url);
      setQr(await QRCode.toDataURL(url, { width: 210, margin: 1, color: { dark: "#101828" } }));
    } catch (e: any) {
      setErr(e.message ?? "Failed to create link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const short = (a: string) =>
    a.startsWith("0x") && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "you";

  return (
    <div className="split">
      <div className="pagehead">
        <h1>Create a payment link</h1>
        <p>Share one link. Get paid in USDC on Arc, instantly — the preview shows exactly what your payer sees.</p>
      </div>

      <div className="card">
        <label style={{ marginTop: 0 }}>Who gets paid?</label>
        <div className="scenarios">
          <button type="button" className={`scenario ${rmode === "single" ? "on" : ""}`}
            onClick={() => { setRmode("single"); setLink(null); }}>
            <h4>One recipient</h4>
            <p>Everything goes to a single wallet or name.</p>
          </button>
          <button type="button" className={`scenario ${rmode === "split" ? "on" : ""}`}
            onClick={() => { setRmode("split"); setLink(null); }}>
            <h4>Split automatically</h4>
            <p>One payment, divided on-chain between 2–20 recipients.</p>
            <p className="aud">For platforms · co-creators · referral shares</p>
          </button>
        </div>

        {rmode === "single" && (<>
        <label>Your wallet address or .agent name (receives the USDC)</label>
        <input placeholder="0x… or yourname.agent" value={merchant}
          onChange={(e) => { setMerchant(e.target.value.trim()); setLink(null); }} />
        </>)}

        {rmode === "split" && (<>
          <label>Recipients &amp; shares</label>
          {payees.map((p, i) => (
            <div className="payeerow" key={i}>
              <input placeholder="0x… or name.agent" value={p.dest}
                onChange={(e) => setPayee(i, "dest", e.target.value)} />
              <input className="pct" placeholder="%" inputMode="decimal" value={p.pct}
                onChange={(e) => setPayee(i, "pct", e.target.value.trim())} />
              {payees.length > 2 && (
                <button type="button" className="rm" title="Remove" onClick={() => rmPayee(i)}>×</button>
              )}
            </div>
          ))}
          <p className={`pctsum ${pctTotal === 100 ? "ok" : "bad"}`}>
            total {pctTotal}% {pctTotal === 100 ? "✓" : "— must equal 100%"}
          </p>
          {payees.length < 20 && (
            <button type="button" className="linkbtn" onClick={addPayee}>+ add recipient</button>
          )}
          <p className="hint" style={{ marginTop: 8 }}>
            The share table is written to the chain and can never be edited — what your
            collaborators see is what will always execute. Creating it takes one wallet signature.
          </p>
        </>)}

        <label>Amount (USDC)</label>
        <input placeholder="50.00" inputMode="decimal" value={amount}
          onChange={(e) => { setAmount(e.target.value.trim()); setLink(null); }} />

        <label>Memo (optional — shown to the payer, used for reconciliation)</label>
        <input placeholder="Invoice #2026-07 · logo design" value={memo}
          onChange={(e) => { setMemo(e.target.value); setLink(null); }} />

        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy} onClick={generate}>
          {busy ? "Creating…" : "Generate link"}
        </button>
        <p className="hint" style={{ marginTop: 12 }}>
          Non-custodial: funds go straight to your wallet in one on-chain transaction.
        </p>
      </div>

      <div className="browser">
        <div className="bbar">
          <span className="bdot" /><span className="bdot" /><span className="bdot" />
          <span className="burl">{link ?? "zunivo.io/pay?oid=…"}</span>
        </div>

        {!link && (
          <div className="pv-card">
            <ZunivoMark size={34} />
            <p className="merchant-row" style={{ marginTop: 6 }}>
              {rmode === "split" ? `Payment splits ${payees.length} ways` : `Payment request from ${short(merchant)}`}
            </p>
            <div className="amount">{amount || "0.00"}<small>USDC</small></div>
            {rmode === "split" && (
              <div className="pv-split">
                {payees.map((p, i) => (
                  <div className="rrow" key={i}>
                    <span>{p.dest ? short(p.dest) : `recipient ${i + 1}`}</span>
                    <span className="mono">{p.pct || "0"}% · {(Number(amount || 0) * (Number(p.pct) || 0) / 100).toFixed(2)} USDC</span>
                  </div>
                ))}
              </div>
            )}
            {memo && <p className="memo">“{memo}”</p>}
            <button className="pv-btn" disabled>Pay {amount || "…"} USDC</button>
            <p className="pv-note">Any wallet — or no wallet at all, with a passkey.</p>
          </div>
        )}

        {link && (
          <div className="pv-card">
            {qr && <img className="qr" style={{ margin: "4px auto 6px" }} src={qr} alt="Payment QR code" />}
            <div className="linkbox" style={{ textAlign: "left" }}>{link}</div>
            <button className="btn" style={{ marginTop: 14 }} onClick={copy}>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <p className="pv-note">
              <a href={link} target="_blank" rel="noreferrer">Open the payment page ↗</a>
            </p>
          </div>
        )}

        <p className="pv-label">{link ? "ready to share" : "live payer preview"}</p>
      </div>
    </div>
  );
}
