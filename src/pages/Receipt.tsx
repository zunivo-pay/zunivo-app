import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Brand } from "../lib/Logo";
import { API, getOrder, OrderView } from "../lib/api";

const EXPLORER = "https://testnet.arcscan.app";

export default function Receipt() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!API || !id) return;
    getOrder(id).then(setOrder).catch((e) => setErr(e.message));
  }, [id]);

  const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
  const fmt = (ts: number) =>
    new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="shell">
      
      <div className="card">
        <h1>Receipt</h1>
        {err && <p className="err">{err}</p>}
        {!order && !err && <p className="sub">Loading…</p>}
        {order && (
          <>
            <p className="sub">
              <span className={`chip ${order.status}`}>{order.status}</span>
            </p>
            <div className="rrow"><span>Order</span><span>{order.id}</span></div>
            <div className="rrow"><span>Amount due</span><span>{order.amount} USDC</span></div>
            {order.memo && <div className="rrow"><span>Memo</span><span>{order.memo}</span></div>}
            <div className="rrow"><span>Recipient</span><span>{short(order.merchant)}</span></div>
            <div className="rrow"><span>Created</span><span>{fmt(order.createdAt)}</span></div>
            {order.payments.map((p) => (
              <div key={p.txHash}>
                <div className="rrow"><span>Paid</span><span>{p.gross} USDC · {fmt(p.ts)}</span></div>
                <div className="rrow"><span>From</span><span>{short(p.payer)}</span></div>
                <div className="rrow"><span>Transaction</span>
                  <span><a className="txlink" href={`${EXPLORER}/tx/${p.txHash}`} target="_blank" rel="noreferrer">{short(p.txHash)} ↗</a></span>
                </div>
              </div>
            ))}
            {order.payments.length === 0 && (
              <p className="hint" style={{ marginTop: 12 }}>No on-chain payment detected yet.</p>
            )}
          </>
        )}
      </div>
      <p className="foot">Powered by <b>zunivo</b> · verified on Arc</p>
    </div>
  );
}
