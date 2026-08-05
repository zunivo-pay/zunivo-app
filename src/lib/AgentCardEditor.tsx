import { useEffect, useState } from "react";
import { getAgentCard, saveAgentCard, RECORDS_ENABLED, type AgentCard } from "./records";

/** Publish/edit the on-chain agent card for a name you hold. */
export default function AgentCardEditor({ label }: { label: string }) {
  const [card, setCard] = useState<AgentCard>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getAgentCard(label).then((c) => { setCard(c); setLoaded(true); }).catch(() => setLoaded(true));
  }, [label]);

  if (!RECORDS_ENABLED) {
    return <p className="hint">Agent cards are not enabled on this deployment yet.</p>;
  }
  if (!loaded) return <p className="hint">Loading agent card…</p>;

  const set = (k: keyof AgentCard) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCard((c) => ({ ...c, [k]: e.target.value }));

  async function save() {
    try {
      setBusy(true); setErr(null); setMsg(null);
      if (card.url && !/^https:\/\//.test(card.url)) throw new Error("Endpoint must be an https:// URL.");
      if (card.x402 && !/^https:\/\//.test(card.x402)) throw new Error("x402 manifest must be an https:// URL.");
      const hash = await saveAgentCard(label, {
        url: card.url ?? "",
        x402: card.x402 ?? "",
        description: card.description ?? "",
      });
      setMsg(`Published — ${label}.agent is now discoverable. tx ${hash.slice(0, 10)}…`);
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Save failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="agentcard-editor" style={{ display: "grid", gap: 6, marginTop: 8 }}>
      <input style={{ fontSize: 12 }} placeholder="service endpoint — https://api.example.com"
        value={card.url ?? ""} onChange={set("url")} />
      <input style={{ fontSize: 12 }} placeholder="x402 manifest URL (optional)"
        value={card.x402 ?? ""} onChange={set("x402")} />
      <input style={{ fontSize: 12 }} placeholder="description — what does this agent sell?"
        value={card.description ?? ""} onChange={set("description")} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="linkbtn" disabled={busy} onClick={save}>
          {busy ? "publishing…" : "publish agent card"}
        </button>
        <span className="hint" style={{ fontSize: 11 }}>one on-chain tx · shows in the directory</span>
      </div>
      {msg && <p className="hint" style={{ color: "var(--mint)" }}>{msg}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
