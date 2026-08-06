import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWalletAccount, pickPrimary, setPrimaryName } from "../lib/useAccount";
import {
  resolveName, setNameAddress, namesOf, displayName, tokenIdOf, NAMES_ADDRESS, parseHandle,
} from "../lib/names";
import { getAgentCard, saveAgentCard, RECORDS_ENABLED, RECORDS_ADDRESS, AGENT_KEYS, type AgentCard } from "../lib/records";
import NameCard from "../lib/NameCard";
import { isAddress } from "viem";

const EXPLORER = "https://testnet.arcscan.app";
const ZERO = "0x0000000000000000000000000000000000000000";

/** Premium single-name page: big NFT, payment routing, agent card, on-chain refs. */
export default function NameDetail() {
  const raw = useParams().label ?? "";
  const label = parseHandle(raw);
  const account = useWalletAccount();

  const [payout, setPayout] = useState<string | null>(null);
  const [owns, setOwns] = useState<boolean | null>(null);
  const [card, setCard] = useState<AgentCard>({});
  const [loaded, setLoaded] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (!label) return;
    resolveName(label).then(setPayout).catch(() => setPayout(null));
    if (RECORDS_ENABLED) getAgentCard(label).then(setCard).catch(() => {}).finally(() => setLoaded(true));
    else setLoaded(true);
  }, [label]);

  useEffect(() => {
    if (!label || !account) { setOwns(null); setIsPrimary(false); return; }
    namesOf(account).then((ns) => {
      setOwns(ns.includes(label));
      setIsPrimary(pickPrimary(account, ns) === label);
    }).catch(() => setOwns(null));
  }, [label, account]);

  function makePrimary() {
    if (!account || !label) return;
    setPrimaryName(account, label);
    setIsPrimary(true);
  }

  if (!label) {
    return (
      <div className="detail-wrap">
        <Link className="back-link" to="/names">← All names</Link>
        <div className="npanel" style={{ marginTop: 18 }}><p className="hint">Invalid name.</p></div>
      </div>
    );
  }

  const tokenLink = `${EXPLORER}/token/${NAMES_ADDRESS}/instance/${tokenIdOf(label)}`;
  const registered = payout !== null && payout !== ZERO;

  return (
    <div className="detail-wrap">
      <Link className="back-link" to="/names">← All names</Link>

      <div className="detail-grid">
        {/* left — the artwork */}
        <div className="detail-art">
          <span className="nftglow"><NameCard label={label} size={360} /></span>
          <a className="art-link" href={tokenLink} target="_blank" rel="noreferrer">View NFT on ArcScan ↗</a>
        </div>

        {/* right — identity + controls */}
        <div className="detail-info">
          <div className="detail-head">
            <span className="ref-kicker">zunivo names · on arc</span>
            <h1 className="detail-name">{label}<span className="mint-accent">.agent</span></h1>
            {owns === true && <span className="badge lockb">YOU HOLD THIS NAME</span>}
            {owns === true && isPrimary && <span className="badge lockb" style={{ marginLeft: 8 }}>★ PRIMARY NAME</span>}
            {owns === false && <span className="badge refb">VIEW ONLY · NOT YOUR NAME</span>}
            {owns === true && !isPrimary && (
              <div style={{ marginTop: 10 }}>
                <button className="linkbtn" style={{ fontSize: 13 }} onClick={makePrimary}>
                  ☆ Set as primary name — shown as your identity across the app
                </button>
              </div>
            )}
          </div>

          <PayoutSection label={label} payout={payout} registered={registered} canEdit={owns === true}
            onSaved={(a) => setPayout(a)} />

          {RECORDS_ENABLED && loaded && (
            <AgentCardSection label={label} card={card} canEdit={owns === true} onSaved={setCard} />
          )}

          <div className="detail-block">
            <div className="block-kicker">on-chain</div>
            <div className="rrow"><span>Registry</span>
              <a className="mono" href={`${EXPLORER}/address/${RECORDS_ENABLED ? RECORDS_ADDRESS : NAMES_ADDRESS}`} target="_blank" rel="noreferrer">
                {(NAMES_ADDRESS).slice(0, 8)}…{NAMES_ADDRESS.slice(-4)} ↗
              </a>
            </div>
            <div className="rrow"><span>Token</span><span className="mono" style={{ fontSize: 12 }}>#{tokenIdOf(label).slice(0, 10)}…</span></div>
            <p className="hint" style={{ marginTop: 12 }}>Art &amp; metadata are 100% on-chain — this exact card is what any wallet or marketplace renders.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayoutSection({ label, payout, registered, canEdit, onSaved }: {
  label: string; payout: string | null; registered: boolean; canEdit: boolean;
  onSaved: (a: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    try {
      setBusy(true); setErr(null);
      if (!isAddress(val.trim())) throw new Error("Enter a valid 0x address.");
      await setNameAddress(label, val.trim());
      onSaved(val.trim()); setEditing(false); setVal("");
    } catch (e: any) { setErr(e?.shortMessage ?? e?.message ?? "Update failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="detail-block">
      <div className="block-kicker">payment routing</div>
      {!registered && <p className="hint">This name isn't registered yet.</p>}
      {registered && (
        <>
          <div className="rrow"><span>Pays</span><span className="mono">{payout!.slice(0, 10)}…{payout!.slice(-8)}</span></div>
          {canEdit && !editing && (
            <button className="linkbtn" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Change payout address →</button>
          )}
          {canEdit && editing && (
            <div style={{ marginTop: 10 }}>
              <input placeholder="new payout 0x…" value={val} onChange={(e) => setVal(e.target.value)} />
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn" style={{ width: "auto", padding: "8px 18px", marginTop: 0 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
                <button className="linkbtn" onClick={() => { setEditing(false); setErr(null); }}>cancel</button>
              </div>
              {err && <p className="err">{err}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AgentCardSection({ label, card, canEdit, onSaved }: {
  label: string; card: AgentCard; canEdit: boolean; onSaved: (c: AgentCard) => void;
}) {
  const [form, setForm] = useState<AgentCard>(card);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const has = AGENT_KEYS.some((k) => card[k]);

  const set = (k: keyof AgentCard) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((c) => ({ ...c, [k]: e.target.value }));

  async function save() {
    try {
      setBusy(true); setErr(null); setMsg(null);
      if (form.url && !/^https:\/\//.test(form.url)) throw new Error("Endpoint must be an https:// URL.");
      if (form.x402 && !/^https:\/\//.test(form.x402)) throw new Error("x402 manifest must be an https:// URL.");
      await saveAgentCard(label, { url: form.url ?? "", x402: form.x402 ?? "", description: form.description ?? "" });
      onSaved(form); setEditing(false); setMsg("Published — this name is now discoverable in the directory.");
    } catch (e: any) { setErr(e?.shortMessage ?? e?.message ?? "Save failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="detail-block">
      <div className="block-kicker">agent card · service discovery</div>
      {!has && !editing && <p className="hint">No service published. {canEdit ? "Publish an endpoint to make this name a callable, payable agent." : ""}</p>}
      {has && !editing && (
        <>
          {card.description && <p style={{ color: "var(--ink)", fontSize: 14, margin: "2px 0 8px" }}>{card.description}</p>}
          {card.url && <div className="rrow"><span>Endpoint</span><span className="mono" style={{ fontSize: 12 }}>{card.url}</span></div>}
          {card.x402 && <div className="rrow"><span>x402</span><span className="mono" style={{ fontSize: 12 }}>{card.x402}</span></div>}
        </>
      )}
      {canEdit && !editing && (
        <button className="linkbtn" style={{ marginTop: 10 }} onClick={() => { setForm(card); setEditing(true); }}>
          {has ? "Edit agent card →" : "Publish agent card →"}
        </button>
      )}
      {canEdit && editing && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <input placeholder="service endpoint — https://api.example.com" value={form.url ?? ""} onChange={set("url")} />
          <input placeholder="x402 manifest URL (optional)" value={form.x402 ?? ""} onChange={set("x402")} />
          <input placeholder="description — what does this agent sell?" value={form.description ?? ""} onChange={set("description")} />
          <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
            <button className="btn mintbtn" style={{ width: "auto", padding: "8px 18px", marginTop: 0 }} disabled={busy} onClick={save}>{busy ? "Publishing…" : "Publish"}</button>
            <button className="linkbtn" onClick={() => { setEditing(false); setErr(null); }}>cancel</button>
          </div>
        </div>
      )}
      {msg && <p className="hint" style={{ color: "var(--mint)" }}>{msg}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
