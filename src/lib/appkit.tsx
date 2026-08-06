/** AppKit has been removed from the bundle — this stub keeps the old exports.
 *
 *  Root cause of the "blank WalletConnect QR" bug (2026-08): the app bundled
 *  TWO copies of @reown/appkit — ours (1.8.23, statically imported here even
 *  when the feature was disabled) and the one @walletconnect/ethereum-provider
 *  pins internally (1.8.19) to render its QR modal. Both register the same
 *  <w3m-*>/<wui-*> custom elements; Reown's registration helper silently skips
 *  duplicates, so the SDK's modal mounted OUR element classes, which subscribe
 *  to OUR never-initialized copy's state → an empty shell with no QR and no
 *  console error. Closing it made the SDK throw "Connection request reset".
 *
 *  Fix: no @reown import may exist in app code. The WalletConnect QR flow
 *  (lib/provider.ts → useWalletConnect) now uses ONLY the SDK's own copy.
 *  If AppKit is re-evaluated at mainnet, restore from git history and pin the
 *  app's @reown/appkit to the exact version ethereum-provider ships. */
export const APPKIT_ENABLED = false;

export function openConnectModal() {
  /* no-op: Shell's built-in ConnectModal is the only connect UI */
}

export function AppKitConnectButton(): null {
  return null;
}
