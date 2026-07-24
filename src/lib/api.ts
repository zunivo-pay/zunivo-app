export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

export type OrderView = {
  id: string;
  merchant: string;
  amount: string;
  memo: string | null;
  status: "unpaid" | "paid";
  splitId?: string | null;
  createdAt: number;
  payments: { txHash: string; payer: string; gross: string; fee: string; block: number; ts: number }[];
};

export async function createOrder(merchant: string, amount: string, memo: string, splitId?: string) {
  const r = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant, amount, memo: memo || undefined, splitId }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "failed to create order");
  return (await r.json()) as { id: string };
}

export async function getOrder(id: string): Promise<OrderView> {
  const r = await fetch(`${API}/api/orders/${id}`);
  if (!r.ok) throw new Error("order not found");
  return r.json();
}

export async function getActivity(address: string): Promise<{ orders: OrderView[] }> {
  const r = await fetch(`${API}/api/merchants/${address}/activity`);
  if (!r.ok) throw new Error("failed to load activity");
  return r.json();
}

export type SentView = {
  txHash: string; amount: string; ts: number;
  orderId: string | null; to: string | null; memo: string | null; splitId: string | null;
};

export async function getSent(address: string): Promise<SentView[]> {
  const r = await fetch(`${API}/api/merchants/${address}/sent`);
  if (!r.ok) return [];
  return (await r.json()).sent ?? [];
}

/** Tell the server to ingest a mint tx immediately (no waiting for the poller). */
export async function ingestNameTx(txHash: string): Promise<void> {
  try {
    await fetch(`${API}/api/names/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    });
  } catch {}
}
