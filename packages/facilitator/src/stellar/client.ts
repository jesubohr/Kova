import { rpc } from '@stellar/stellar-sdk';
import type { StellarNetwork } from '../types.js';

const RPC_URLS: Record<StellarNetwork, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
};

/** Returns a Soroban RPC server for the given network. */
export function getRpcServer(network: StellarNetwork): rpc.Server {
  return new rpc.Server(RPC_URLS[network], { allowHttp: false });
}
