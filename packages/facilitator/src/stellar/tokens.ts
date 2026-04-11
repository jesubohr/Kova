import type { StellarNetwork, AssetInfo } from '../types.js';

/**
 * USDC contract addresses per network.
 * Testnet: Circle USDC testnet SAC (Stellar Asset Contract)
 * Mainnet: Circle USDC mainnet SAC
 */
export const USDC: Record<StellarNetwork, AssetInfo> = {
  testnet: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  mainnet: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    contractId: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  },
};

/** All supported assets per network */
export const SUPPORTED_ASSETS: Record<StellarNetwork, AssetInfo[]> = {
  testnet: [USDC.testnet],
  mainnet: [USDC.mainnet],
};
