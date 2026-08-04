import { useEffect, useMemo, useState } from "react";
import { getEth } from "../lib/provider";
import { Link, useSearchParams } from "react-router-dom";
import {
  createWalletClient, createPublicClient, custom, http,
  parseEther, keccak256, toHex, isAddress,
} from "viem";
import { arcTestnet, arcTransport, ROUTER_ABI, ROUTER_ADDRESS, EXPLORER, CHAIN_PARAMS_FOR_WALLET } from "../lib/chain";
import { API, getOrder } from "../lib/api";
import { splitPayCall, SPLIT_ADDRESS, SPLIT_ABI } from "../lib/split";
import { Brand, ZunivoMark } from "../lib/Logo";
import PasskeyPay from "./PasskeyPay";

type Phase = "idle" | "connecting" | "paying" | "confirming" | "done" | "error";

export default function Pay() {
  const [sp] = useSearchParams();
  const oid = sp.get("oid") ?? "";
  const legacyTo = sp.get("to") ?? "";
  const legacyAmt = sp.get("amt") ?? "";
  const legacyMemo = sp.get("memo") ?? "";

  const [merchant, setMerchant] = useState(legacyTo);
  const [amount, setAmount] = useState(legacyAmt);
  const [memo, setMemo] = useState(legacyMemo);
  const [loading, setLoading] = useState(Boolean(API && oid && !legacyTo));
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [splitId, setSplitId] = useState<string | null>(null);

  useEffect(() => {
    if (API && oid && !legacyTo) {
      getOrder(oid)
        .then((o) => { setMerchant(o.merchant); setAmount(o.amount); setMemo(o.memo ?? ""); setSplitId(o.splitId ?? null); })
        .catch(() => setErr("This payment link is invalid or expired."))
        .finally(() => setLoading(false));
    }
  }, [oid, legacyTo]);

  const valid = useMemo(
    () => isAddress(merchant) && Number(amount) > 0 && oid.length > 0,
    [merchant, amount, oid]
  );
  const orderId = useMemo(() => keccak256(toHex(oid || "x")), [oid]);
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  async function payNow() {
    setErr(null);
    const eth = getEth();
    if (!eth) {
      setErr("No wallet detected. Open this link in a wallet browser (MetaMask, Rabby…) or install a wallet extension.");
      setPhase("error");
      return;
    }
    try {
      setPhase("connecting");
      const [account] = await eth.request({ method: "eth_requestAccounts" });
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS_FOR_WALLET.chainId }] });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS_FOR_WALLET] });
        } else throw switchErr;
      }
      setPhase("paying");
      const wallet = createWalletClient({ chain: arcTestnet, transport: custom(eth) });
      const hash = splitId
        ? await wallet.writeContract({
            account,
            address: SPLIT_ADDRESS,
            abi: SPLIT_ABI,
            functionName: "pay",
            args: [BigInt(splitId), orderId],
            value: parseEther(amount),
          })
        : await wallet.writeContract({
            account,
            address: ROUTER_ADDRESS,
            abi: ROUTER_ABI,
            functionName: "pay",
            args: [orderId, merchant as `0x${string}`],
            value: parseEther(amount),
          });
      setTxHash(hash);
      setPhase("confirming");
      const pub = createPublicClient({ chain: arcTestnet, transport: arcTransport() });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      setPhase("done");
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Payment failed.");
      setPhase("error");
    }
  }

  if (loading)
    return (<div className="shell"><div className="card"><p className="sub">Loading payment…</p></div></div>);

  if (!valid)
    return (
      <div className="shell">
        <div className="card"><h1>Invalid payment link</h1>
          <p className="sub">{err ?? "This link is missing details. Ask the sender for a fresh one."}</p></div>
      </div>
    );

  if (phase === "done")
    return (
      <div className="shell">
        <div className="card success">
          <div className="check">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M4 12.5L9.5 18L20 6.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Paid {amount} USDC</h2>
          <p className="sub">Settled on Arc — funds are already in the recipient's wallet.</p>
          {txHash && (
            <p><a className="txlink" href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View on ArcScan ↗</a></p>
          )}
          {API && oid && !legacyTo && (
            <p style={{ marginTop: 10 }}><Link className="txlink" to={`/r/${oid}`}>Open your receipt →</Link></p>
          )}
        </div>
        <p className="foot">Powered by <b>zunivo</b></p>
      </div>
    );

  const busy = phase === "connecting" || phase === "paying" || phase === "confirming";
  const label =
    phase === "connecting" ? "Connecting wallet…"
    : phase === "paying" ? "Confirm in your wallet…"
    : phase === "confirming" ? "Settling on Arc…"
    : `Pay ${amount} USDC`;

  return (
    <div className="shell">
      <div className="card">
        <div style={{ textAlign: "center", marginBottom: 6 }}><ZunivoMark size={34} /></div>
        <p className="merchant-row">Payment request from {short(merchant)}</p>
        {splitId && (
              <p className="merchant-row" style={{ marginBottom: 4 }}>
                <span className="chip paid">splits automatically between recipients</span>
              </p>
            )}
            <div className="amount">{amount}<small>USDC</small></div>
        {memo && <p className="memo">“{memo}”</p>}
        <button className="btn" disabled={busy} onClick={payNow}>{label}</button>
        <PasskeyPay orderId={orderId} merchant={merchant} amount={amount} splitId={splitId}
          onPaid={(tx) => { setTxHash(tx); setPhase("done"); }} />
        {err && <p className="err">{err}</p>}
        <p className="steps">
          Non-custodial: your USDC goes straight to the recipient in one on-chain
          transaction. Gas is paid in USDC on Arc Testnet.
        </p>
      </div>
      <p className="foot">Powered by <b>zunivo</b> · Arc Testnet</p>
    </div>
  );
}
