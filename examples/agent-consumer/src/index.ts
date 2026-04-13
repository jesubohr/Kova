import { KovaClient } from "@onkova/sdk-client";

const WEATHER_URL =
  process.env.WEATHER_URL ?? "http://localhost:4022/api/weather";
const STELLAR_SECRET = process.env.STELLAR_SECRET ?? "";

if (!STELLAR_SECRET) {
  console.error("Error: STELLAR_SECRET env var required (S... key)");
  process.exit(1);
}

const client = new KovaClient({
  stellarSecret: STELLAR_SECRET,
  network: "testnet",
  budget: {
    maxPerRequest: "0.01",
    maxPerDay: "1.00",
  },
});

console.log("Fetching weather data (will auto-pay x402 paywall)...\n");

try {
  const response = await client.fetch(WEATHER_URL);
  const data = await response.json();

  console.log("Response:", JSON.stringify(data, null, 2));
  console.log("\nSpending summary:", client.getSpending());
} catch (error) {
  console.error("Failed to fetch:", error instanceof Error ? error.message : error);
  process.exit(1);
}
