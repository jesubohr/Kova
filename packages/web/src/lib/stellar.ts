import { Horizon } from "@stellar/stellar-sdk";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const HORIZON_MAINNET = "https://horizon.stellar.org";
const EXPLORER_TESTNET = "https://stellar.expert/explorer/testnet";
const EXPLORER_MAINNET = "https://stellar.expert/explorer/public";

function getServer(network: "testnet" | "mainnet" = "testnet"): Horizon.Server {
  return new Horizon.Server(
    network === "mainnet" ? HORIZON_MAINNET : HORIZON_TESTNET
  );
}

export async function getStellarUSDCBalance(
  address: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<string | null> {
  try {
    const server = getServer(network);
    const account = await server.loadAccount(address);
    const usdcBalance = account.balances.find(
      (b) =>
        b.asset_type === "credit_alphanum4" &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === "USDC"
    ) as Horizon.HorizonApi.BalanceLineAsset | undefined;
    return usdcBalance?.balance ?? "0";
  } catch {
    return null;
  }
}

export function getStellarExplorerAddressUrl(
  address: string,
  network: "testnet" | "mainnet" = "testnet"
): string {
  const base = network === "mainnet" ? EXPLORER_MAINNET : EXPLORER_TESTNET;
  return `${base}/account/${address}`;
}

export function getStellarExplorerTxUrl(
  txHash: string,
  network: "testnet" | "mainnet" = "testnet"
): string {
  const base = network === "mainnet" ? EXPLORER_MAINNET : EXPLORER_TESTNET;
  return `${base}/tx/${txHash}`;
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
