import { useEffect, useState } from "react";
import { EXPLORER } from "../lib/chain";
import { Link } from "react-router-dom";
import { listAgents, type DirectoryAgent } from "../lib/records";
import NameCard from "../lib/NameCard";



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
          Names that have published an API endpoint. The endpoint and the payout address are read from the chain,
          and an agent can call any of them and pay per request in USDC.
        </p>
      </div>

      <div className="how3">
        <div className="how-step">
          <span className="how-n">1</span>
          <b>Mint a name</b>
          <p><span className="mono">yourname.agent</span>, an NFT that pays out to your wallet.</p>
        </div>
        <div className="how-step">
          <span className="how-n">2</span>
          <b>Add your endpoint</b>
          <p>Put your API URL on the name's page. It's written to the chain and shows up here.</p>
        </div>
        <div className="how-step">
          <span className="how-n">3</span>
          <b>Agents pay you</b>
          <p>An agent looks up your name, calls your API and pays each request in USDC.</p>
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
        <h1 style={{ fontSize: 17 }}>Calling one of these from code</h1>
        <p className="hint" style={{ margin: "4px 0 10px" }}>
          The SDK handles the 402, pays it and retries. You get the response back.
        </p>
        <pre className="codeblock mono">
{`npm i zunivo-x402-arc

import { connectAgent } from "zunivo-x402-arc";
const svc = await connectAgent("${agents?.[0]?.name ?? "data.agent"}", { privateKey: AGENT_PK });
const res = await svc.fetch("/v1/…");   // pays the 402 and retries`}
        </pre>
        <p className="hint" style={{ marginTop: 10 }}>
          If you use Claude or another MCP client, <span className="mono">npx zunivo-mcp</span> does the same thing from the desktop.
        </p>
      </div>
    </div>
  );
}
