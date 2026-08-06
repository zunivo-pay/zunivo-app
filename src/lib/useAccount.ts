import { useEffect, useState } from "react";
import { createPublicClient, formatEther } from "viem";
import { getEth, subscribeWallets } from "./provider";
import { namesOf } from "./names";
import { arcTestnet, arcTransport } from "./chain";

/** The account already connected anywhere in the app (AppKit, modal, or a
 *  previous page) — detected silently, kept in sync on wallet/account switch. */
export function useWalletAccount(): `0x${string}` | null {
  const [acct, setAcct] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    let alive = true;
    let bound: any = null;

    const check = async () => {
      try {
        const eth = getEth();
        if (!eth) return;
        if (bound !== eth) {
          bound?.removeListener?.("accountsChanged", check);
          eth.on?.("accountsChanged", check);
          bound = eth;
        }
        const a: string[] = await eth.request({ method: "eth_accounts" });
        if (alive) setAcct((a?.[0] as `0x${string}`) ?? null);
      } catch {}
    };

    check();
    const un = subscribeWallets(check);
    return () => {
      alive = false;
      un();
      bound?.removeListener?.("accountsChanged", check);
    };
  }, []);

  return acct;
}

const pub = createPublicClient({ chain: arcTestnet, transport: arcTransport() });

/** Native balance on Arc IS the USDC balance (gas token, 18 decimals). */
export function useUsdcBalance(address: string | null | undefined): string | null {
  const [bal, setBal] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setBal(null);
    if (!address) return;
    pub.getBalance({ address: address as `0x${string}` })
      .then((b) => { if (alive) setBal(formatEther(b)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [address]);
  return bal;
}

/** The user's chosen primary name for an address — a local preference,
 *  like a default card in a wallet. Falls back to the first owned name. */
export function getPrimaryName(address: string): string | null {
  try { return localStorage.getItem(`zunivo_primary_${address.toLowerCase()}`); } catch { return null; }
}
export function setPrimaryName(address: string, label: string) {
  try { localStorage.setItem(`zunivo_primary_${address.toLowerCase()}`, label); } catch {}
}
export function pickPrimary(address: string, names: string[]): string | null {
  const stored = getPrimaryName(address);
  return stored && names.includes(stored) ? stored : names[0] ?? null;
}

/** ENS-style courtesy: if the address owns a .agent name, show the (primary) name. */
export function useDisplayName(address: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setName(null);
    if (!address) return;
    namesOf(address as `0x${string}`)
      .then((ns) => {
        const pick = pickPrimary(address, ns);
        if (alive && pick) setName(`${pick}.agent`);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [address]);
  return name;
}
