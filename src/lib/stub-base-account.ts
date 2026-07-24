/** Build-time stand-in for @base-org/account (Coinbase Smart Wallet SDK).
 *  AppKit only loads it lazily when the Coinbase option is used — which we
 *  disable — but the bundler still wants to compile it, and its code requires
 *  a newer viem than Circle's passkey SDK tolerates. This stub keeps the
 *  build honest on viem 2.23 without shipping the incompatible code. */
export const createBaseAccountSDK = () => {
  throw new Error("Coinbase Smart Wallet is not enabled in this app.");
};
export default {};
