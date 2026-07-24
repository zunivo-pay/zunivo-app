import { useEffect, useState } from "react";
import {
  circleEnabled, storedCredential, forgetCredential,
  passkeyRegister, passkeyLogin, smartAccountFor, smartAccountBalance, payWithPasskey, diagnoseUserOps,
} from "../lib/circle";
import { splitPayCall } from "../lib/split";
import type { SmartAccount } from "viem/account-abstraction";

type Props = {
  orderId: `0x${string}`;
  merchant: string;
  amount: string;
  splitId?: string | null;
  onPaid: (txHash: string) => void;
};

type Stage = "closed" | "auth" | "ready" | "paying";

export default function PasskeyPay({ orderId, merchant, amount, splitId, onPaid }: Props) {
  const [stage, setStage] = useState<Stage>("closed");
  const [username, setUsername] = useState("");
  const [account, setAccount] = useState<SmartAccount | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);

  const enough = balance !== null && Number(balance) >= Number(amount);

  async function loadAccount(cred: NonNullable<ReturnType<typeof storedCredential>>) {
    const acct = await smartAccountFor(cred);
    setAccount(acct);
    setStage("ready");
    setBalance(await smartAccountBalance(acct.address));
  }

  useEffect(() => {
    if (stage !== "ready" || !account || enough) return;
    const t = setInterval(async () => {
      try { setBalance(await smartAccountBalance(account.address)); } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [stage, account, enough]);

  async function open() {
    setErr(null);
    const cred = storedCredential();
    if (cred) {
      try { setBusy(true); await loadAccount(cred); return; }
      catch { forgetCredential(); }
      finally { setBusy(false); }
    }
    setStage("auth");
  }

  async function doRegister() {
    if (!username.trim()) return setErr("Pick a name for your passkey.");
    try {
      setBusy(true); setErr(null);
      await loadAccount(await passkeyRegister(username.trim()));
    } catch (e: any) {
      setErr(e?.message?.includes("InvalidState")
        ? "A passkey already exists for this site — use Sign in instead."
        : e?.message ?? "Passkey registration failed.");
    } finally { setBusy(false); }
  }

  async function doLogin() {
    try {
      setBusy(true); setErr(null);
      await loadAccount(await passkeyLogin());
    } catch (e: any) {
      setErr(e?.message ?? "Passkey sign-in failed.");
    } finally { setBusy(false); }
  }

  async function doPay() {
    if (!account) return;
    try {
      setStage("paying"); setErr(null);
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Payment is taking unusually long — it may still land on-chain. Check your dashboard in a minute before retrying, or run diagnostics.")), 90_000)
      );
      const { txHash } = await Promise.race([
        payWithPasskey(
          account, orderId, merchant as `0x${string}`, amount,
          splitId ? splitPayCall(splitId, orderId, amount) : undefined
        ),
        timeout,
      ]);
      onPaid(txHash);
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Payment failed.");
      setStage("ready");
    }
  }

  async function copyAddr() {
    if (!account) return;
    await navigator.clipboard.writeText(account.address);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  if (!circleEnabled) return null;

  if (stage === "closed")
    return (
      <button className="btn ghost" onClick={open} disabled={busy}>
        {busy ? "Checking passkey…" : "No crypto wallet? Pay with a passkey"}
      </button>
    );

  if (stage === "auth")
    return (
      <div className="pkbox">
        <p className="pk-title">Pay with a passkey</p>
        <p className="hint">Your device creates a secure wallet — no extension, no seed phrase. Face ID / Touch ID confirms it.</p>
        <label>Name for this passkey</label>
        <input placeholder="e.g. alice" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn" style={{ flex: 1, marginTop: 0 }} disabled={busy} onClick={doRegister}>
            {busy ? "Waiting…" : "Create passkey"}
          </button>
          <button className="btn ghost" style={{ flex: 1, marginTop: 0 }} disabled={busy} onClick={doLogin}>Sign in</button>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    );

  return (
    <div className="pkbox">
      <p className="pk-title">Passkey wallet ready</p>
      <p className="hint mono" style={{ overflowWrap: "anywhere" }}>
        {account?.address}{" "}
        <button className="linkbtn" onClick={copyAddr}>{copied ? "copied ✓" : "copy"}</button>
      </p>
      <p className="hint">Balance: {balance === null ? "…" : `${balance} USDC`}</p>
      {!enough && (
        <p className="hint">
          This wallet needs {amount} USDC. On testnet, fund it from{" "}
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a>{" "}
          (select Arc Testnet, paste the address above). Balance refreshes automatically.
        </p>
      )}
      <p className="hint">Gas is tiny and comes out of this wallet's USDC. When sponsorship is available, it's free.</p>
      <button className="btn" disabled={!enough || stage === "paying"} onClick={doPay}>
        {stage === "paying" ? "Paying — confirm with Face ID / Touch ID…" : `Pay ${amount} USDC`}
      </button>
      {err && <p className="err">{err}</p>}
      {err && (
        <button className="btn ghost" disabled={busy} onClick={async () => {
          setBusy(true); setDiag("Running two micro self-tests…");
          try { setDiag(await diagnoseUserOps(account!)); }
          catch (e: any) { setDiag(e?.message ?? "diagnostics failed"); }
          finally { setBusy(false); }
        }}>Run diagnostics</button>
      )}
      {diag && <p className="hint mono" style={{ whiteSpace: "pre-wrap" }}>{diag}</p>}
    </div>
  );
}
