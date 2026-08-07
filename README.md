# zunivo app — [app.zunivo.io](https://app.zunivo.io)

The human **and** agent surface of zunivo: non-custodial USDC payments on
Circle's Arc, with `.agent` names as payable, discoverable identities.

## What's inside

- **Get paid** — payment links (invoice-style), atomic on-chain splits
  (2–20 recipients), and a permanent personal **receive code** (scan → pay).
- **Send** — pay by `.agent` name or address, with a local **contact book**,
  recent recipients, live balance + MAX, recipient resolution preview, and
  **scheduled sends** (funds locked on-chain until a date, live countdowns).
- **Names** — mint `yourname.agent` (ERC-721, art 100% on-chain), premium
  per-name page: payout routing, **agent card** (endpoint/x402/description →
  on-chain service discovery), primary-name selection.
- **Agents** — the public directory of callable, payable `.agent` services.
- **Dashboard** — auto-loads your wallet: balance, settled/locked/committed
  KPIs, unified in/out activity feed, unlock countdowns, CSV export.

## Stack

React + Vite + viem (multi-RPC fallback transport) · EIP-6963 wallet
discovery + WalletConnect QR · Circle Modular Wallets passkey checkout ·
paper-light design system shared with [zunivo.io](https://zunivo.io).

## Run

```bash
npm install
npm run dev     # local
npm run build   # dist/ → any static host (SPA rewrite all routes to /index.html)
```

Key env (`.env` / `.env.production`): `VITE_API_URL`, `VITE_ROUTER_ADDRESS`,
`VITE_NAMES_ADDRESS`, `VITE_RECORDS_ADDRESS`, `VITE_WC_PROJECT_ID`,
`VITE_ENABLE_WC`, `VITE_CIRCLE_CLIENT_KEY`.

## Related

Contracts: [zunivo-contracts](https://github.com/zunivo-pay/zunivo-contracts) ·
API/indexer: [zunivo-server](https://github.com/zunivo-pay/zunivo-server) ·
Agent SDK: [`zunivo-x402-arc`](https://www.npmjs.com/package/zunivo-x402-arc) ·
MCP: [`zunivo-mcp`](https://www.npmjs.com/package/zunivo-mcp)
