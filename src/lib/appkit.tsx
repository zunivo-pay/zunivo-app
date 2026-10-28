/** AppKit is out of the bundle. This stub keeps the old exports.
 *
 *  Why: we shipped two copies of @reown/appkit (ours, and the one
 *  @walletconnect/ethereum-provider pins for its QR modal). Both register the
 *  same custom elements, the duplicate registration is skipped silently, and
 *  the modal ended up bound to the copy that was never initialised. Blank QR,
 *  no error. Don't import @reown anywhere in app code; the WC flow in
 *  lib/provider.ts uses the SDK's own copy. If AppKit comes back, pin it to
 *  the exact version ethereum-provider ships. */
export const APPKIT_ENABLED = false;

export function openConnectModal() {
  /* no-op: Shell's built-in ConnectModal is the only connect UI */
}

export function AppKitConnectButton(): null {
  return null;
}
