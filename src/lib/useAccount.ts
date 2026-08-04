import { useEffect, useState } from "react";
import { getEth, subscribeWallets } from "./provider";
import { namesOf } from "./names";

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

/** ENS-style courtesy: if the address owns a .agent name, show the name. */
export function useDisplayName(address: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setName(null);
    if (!address) return;
    namesOf(address as `0x${string}`)
      .then((ns) => { if (alive && ns[0]) setName(`${ns[0]}.agent`); })
      .catch(() => {});
    return () => { alive = false; };
  }, [address]);
  return name;
}
