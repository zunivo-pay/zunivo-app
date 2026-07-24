# Zunivo app (v0.1) — payment link + pay page

Week-1 end-to-end MVP: merchant creates a link (`/`), payer opens it (`/pay`),
pays native USDC through ArcPayRouter on Arc Testnet, sees an on-chain receipt.
No backend yet — reconciliation dashboard lands in week 2.

## Run order (first time)
1. Deploy the contract (in `paylink-core/`):
   export DEPLOYER_PK=$(op read "op://<vault>/arc-deployer/private key")
   export FEE_COLLECTOR=0x<your_fee_wallet>
   forge script script/Deploy.s.sol:Deploy --rpc-url arc_testnet --broadcast
2. Copy the printed router address into `.env`:
   cp .env.example .env   # then set VITE_ROUTER_ADDRESS=0x…
3. App:
   npm install
   npm run dev            # local test
   npm run build          # dist/ → deploy to Vercel / Cloudflare Pages / any static host
   (SPA: configure the host to rewrite all routes to /index.html)

## Test flow on testnet
- Fund two wallets with test USDC: https://faucet.circle.com (select Arc Testnet)
- Open /, paste wallet A as recipient, amount 1, generate link
- Open the link in another browser/profile with wallet B, pay
- Success page links to the ArcScan receipt; wallet A balance +1 USDC

## Notes
- Amounts use native-USDC 18 decimals (`parseEther`) — correct for Arc's native layer.
- The pay page auto-adds/switches Arc Testnet in the wallet (chainId 0x4cef52).
- Payer without a wallet extension currently sees guidance; Circle Wallets
  (email login, no extension) is the week-3 integration that removes this wall.
