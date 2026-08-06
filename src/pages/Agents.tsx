import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAgents, type DirectoryAgent } from "../lib/records";
import NameCard from "../lib/NameCard";

const EXPLORER = "https://testnet.arcscan.app";

/** On-chain records are attacker-controlled input — only ever link to https URLs. */
const safeHttps = (u?: string) => (u && /^https:\/\/[^\s]+$/i.test(u) ? u : null);

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

      <div className="how3">
        <div className="how-step">
          <span className="how-n">1</span>
          <b>Mint a name</b>
          <p><span className="mono">yourname.agent</span> — an NFT that routes USDC to you.</p>
        </div>
        <div className="how-step">
          <span className="how-n">2</span>
          <b>Publish your card</b>
          <p>Add your API endpoint on the name's page. It goes on-chain — and lands here.</p>
        </div>
        <div className="how-step">
          <span className="how-n">3</span>
          <b>Get paid by AI</b>
          <p>Any agent resolves your name, calls your API, and pays per request in USDC.</p>
        </div>
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

      <div className="dirgrid">
        {agents?.map((a) => (
          <div key={a.label} className="dircard">
            <div className="dirhead">
              <Link to={`/names/${a.label}`} className="dirart"><NameCard label={a.label} size={72} /></Link>
              <div style={{ minWidth: 0 }}>
                <Link to={`/names/${a.label}`} className="dirname">
                  {a.label}<span className="mint-accent">.agent</span>
                </Link>
                {a.records.description && <p className="dirdesc">{a.records.description}</p>}
              </div>
            </div>
            <div className="dirrows">
              <div className="rrow"><span>Endpoint</span><span className="mono" title={a.records.url}>{a.records.url}</span></div>
              <div className="rrow"><span>Pays</span>
                <a className="mono" href={`${EXPLORER}/address/${a.owner}`} target="_blank" rel="noreferrer">
                  {a.owner.slice(0, 8)}…{a.owner.slice(-6)} ↗
                </a>
              </div>
              {safeHttps(a.records.x402) && (
                <div className="rrow"><span>x402</span>
                  <a className="mono" href={safeHttps(a.records.x402)!} target="_blank" rel="noreferrer">manifest ↗</a>
                </div>
              )}
            </div>
            <div className="dirfoot">
              <span className="dirlive">● live on-chain</span>
              <Link className="linkbtn" to={`/names/${a.label}`}>View name →</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="npanel" style={{ marginTop: 22 }}>
        <div className="block-kicker">for agent developers</div>
        <h1 style={{ fontSize: 17 }}>Call any of these from your AI agent</h1>
        <p className="hint" style={{ margin: "4px 0 10px" }}>
          One import. The 402 quote, the USDC payment, and the on-chain receipt are all handled for you.
        </p>
        <pre className="codeblock mono">
{`npm i zunivo-x402-arc

import { connectAgent } from "zunivo-x402-arc";
const svc = await connectAgent("${agents?.[0]?.name ?? "data.agent"}", { privateKey: AGENT_PK });
const res = await svc.fetch("/v1/…");   // 402 handled — USDC paid, receipt on-chain`}
        </pre>
        <p className="hint" style={{ marginTop: 10 }}>
          Using Claude? <span className="mono">npx zunivo-mcp</span> gives your desktop agent the same
          powers — resolve, call, and pay any name here.
        </p>
      </div>
    </div>
  );
}
