/** Local address book + recent recipients.
 *  Private by design: contacts live ONLY in this browser (localStorage) —
 *  never on-chain, never on our server. A contact's value is either a
 *  0x address or (nicer) a .agent name, which keeps working even if the
 *  person rotates their wallet behind the name. */

export type Contact = { id: string; nick: string; value: string; addedAt: number };
export type Recent = { value: string; at: number };

const CKEY = "zunivo_contacts_v1";
const RKEY = "zunivo_recents_v1";

function read<T>(k: string): T[] {
  try { return JSON.parse(localStorage.getItem(k) ?? "[]") as T[]; } catch { return []; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export function listContacts(): Contact[] {
  return read<Contact>(CKEY).sort((a, b) => a.nick.localeCompare(b.nick));
}

export function findContact(value: string): Contact | undefined {
  const v = value.trim().toLowerCase();
  return read<Contact>(CKEY).find((c) => c.value.toLowerCase() === v);
}

export function saveContact(nick: string, value: string): Contact {
  const list = read<Contact>(CKEY).filter((c) => c.value.toLowerCase() !== value.trim().toLowerCase());
  const c: Contact = { id: crypto.randomUUID(), nick: nick.trim(), value: value.trim(), addedAt: Date.now() };
  write(CKEY, [...list, c]);
  return c;
}

export function removeContact(id: string) {
  write(CKEY, read<Contact>(CKEY).filter((c) => c.id !== id));
}

/** Most-recent-first, deduped, capped at 6. Recorded after a successful send. */
export function listRecents(): Recent[] {
  return read<Recent>(RKEY);
}

export function recordRecent(value: string) {
  const v = value.trim();
  if (!v) return;
  const list = read<Recent>(RKEY).filter((r) => r.value.toLowerCase() !== v.toLowerCase());
  write(RKEY, [{ value: v, at: Date.now() }, ...list].slice(0, 6));
}

export const shortValue = (s: string) =>
  s.startsWith("0x") && s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
