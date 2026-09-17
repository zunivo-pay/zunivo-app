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

## Networks — two deployments, one switch

| Build | `VITE_NETWORK` | Chain | Contracts | API |
|---|---|---|---|---|
| [app.zunivo.io](https://app.zunivo.io) | `mainnet` | Arc mainnet (5042) | v1.3, verified on [arc.etherscan.io](https://arc.etherscan.io) | api.zunivo.io |
| [testnet.zunivo.io](https://testnet.zunivo.io) | `testnet` | Arc testnet (5042002) | sandbox set | testnet-api.zunivo.io |

`src/lib/chain.ts` derives the chain definition, RPC gateways, explorer, wallet
chain-params and every contract address from that one variable. The header
badge shows which network you're on and links to the other. Real money on
mainnet; passkey pay there is gated until a live Circle client key is set.

## Run

```bash
npm install
npm run dev              # local (.env → testnet + localhost API)
npm run build            # mainnet bundle  (.env.production)
npm run build:testnet    # testnet bundle  (.env.testnet)
```

Key env: `VITE_NETWORK`, `VITE_API_URL`, `VITE_WC_PROJECT_ID`, `VITE_ENABLE_WC`,
`VITE_CIRCLE_CLIENT_KEY`, optional `VITE_RPC_URL` (dedicated RPC) and
`VITE_*_ADDRESS` overrides.

## Related

Contracts: [zunivo-contracts](https://github.com/zunivo-pay/zunivo-contracts) ·
API/indexer: [zunivo-server](https://github.com/zunivo-pay/zunivo-server) ·
Agent SDK: [`zunivo-x402-arc`](https://www.npmjs.com/package/zunivo-x402-arc) ·
MCP: [`zunivo-mcp`](https://www.npmjs.com/package/zunivo-mcp)
