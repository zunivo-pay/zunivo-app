# zunivo app

The web app at app.zunivo.io. React + Vite + viem.

Pages: payment links and splits (Get paid), send now or lock until a date (Send), mint and manage `.agent` names (Names), the directory of names that published an API endpoint (Agents), and a dashboard of what an address received, sent and has locked.

Wallets: any EIP-6963 extension, WalletConnect for mobile, or a Circle passkey wallet on the pay page.

## Networks

`VITE_NETWORK=mainnet` builds app.zunivo.io (Arc 5042, v1.3 contracts, api.zunivo.io). `VITE_NETWORK=testnet` builds testnet.zunivo.io (Arc 5042002, sandbox contracts, testnet-api.zunivo.io). `src/lib/chain.ts` derives everything else from that one variable. The header badge shows which one you're on.

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
