import type { StellarNetwork } from "../x402/types.js"

/** Configuration for the Stellar wallet */
export interface WalletConfig {
  /** Stellar secret key (S... format) */
  stellarSecret: string
  /** Network to operate on */
  network: StellarNetwork
}

/** Result of signing a Soroban auth entry */
export interface SignedAuthEntry {
  /** base64-encoded XDR SorobanAuthorizationEntry */
  authEntryBase64: string
  /** G... public key of the signer */
  publicKey: string
}
