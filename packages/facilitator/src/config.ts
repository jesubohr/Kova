import type { StellarNetwork } from './types.js';

function require(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  stellarSecret: require('FACILITATOR_STELLAR_SECRET'),
  port: parseInt(optional('FACILITATOR_PORT', '4021'), 10),
  network: optional('STELLAR_NETWORK', 'testnet') as StellarNetwork,
  feePercent: parseFloat(optional('KOVA_FEE_PERCENT', '1.5')),
  treasuryAddress: require('KOVA_TREASURY_ADDRESS'),
} as const;

export type Config = typeof config;
