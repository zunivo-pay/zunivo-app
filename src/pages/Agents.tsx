import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAgents, type DirectoryAgent } from "../lib/records";
import NameCard from "../lib/NameCard";

const EXPLORER = "https://testnet.arcscan.app";

/** The public .agent service directory — every name that published an endpoint. */
export default function Agents() {
  const [agents, setAgents] = useState<DirectoryAgent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listAgents().then(setAgents).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="shell wide">
      <div className="pagehead">
        <h1 className="grad-title">Agent directory</h1>
        <p>
          Every <span className="mint-accent">.agent</span> here is a callable, payable service —
          endpoint and payout address live on-chain, payments settle over x402 in USDC.
        </p>
      </div>

      {err && <p className="err">{err}</p>}
      {!agents && !err && <p className="hint">Loading directory…</p>}

      {agents && agents.length === 0 && (
        <div className="npanel">
          <p className="hint">
            No agents have published a service yet. Hold a name?{" "}
            <Link className="txlink" to="/names">Publish your agent card →</Link>
          </p>
        </div>
      )}

      <div className="nftgrid">
        {agents?.map((a) => (
          <div key={a.label} className="nftitem npanel" style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <NameCard label={a.label} size={110} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{a.name}</p>
                {a.records.description && (
                  <p className="hint" style={{ margin: "4px 0 8px" }}>{a.records.description}</p>
                )}
                <p className="hint mono" style={{ fontSize: 11, wordBreak: "break-all", margin: 0 }}>
                  {a.records.url}
                </p>
              </div>
            </div>
            <div className="acts" style={{ marginTop: 10 }}>
              {a.records.x402 && (
                <a className="txlink" href={a.records.x402} target="_blank" rel="noreferrer">x402 manifest ↗</a>
              )}
              <a className="txlink" href={`${EXPLORER}/address/${a.owner}`} target="_blank" rel="noreferrer">
                paid to {a.owner.slice(0, 6)}…{a.owner.slice(-4)} ↗
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="npanel" style={{ marginTop: 18 }}>
        <h1 style={{ fontSize: 16 }}>Call any of these from your AI agent</h1>
        <pre className="mono" style={{ fontSize: 12, overflowX: "auto", margin: "8px 0 0" }}>
{`npm i zunivo-x402-arc

import { connectAgent } from "zunivo-x402-arc";
const svc = await connectAgent("${agents?.[0]?.name ?? "data.agent"}", { privateKey: AGENT_PK });
const res = await svc.fetch("/v1/…");   // 402 handled — USDC paid, receipt on-chain`}
        </pre>
      </div>
    </div>
  );
}
