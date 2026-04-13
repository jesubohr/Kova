import type { StellarNetwork, PaymentRequirements } from "./x402/types.js"
import { parse402Response } from "./x402/parse-402.js"
import { buildPaymentPayload } from "./x402/build-payment.js"
import { createStellarWallet, type StellarWallet } from "./wallet/stellar.js"
import { decimalToStroops, encodePaymentHeader } from "./utils.js"

/** Budget configuration for spending limits */
export interface BudgetConfig {
  /** Max amount (decimal string) per single request */
  maxPerRequest?: string
  /** Max total amount (decimal string) per hour */
  maxPerHour?: string
  /** Max total amount (decimal string) per day */
  maxPerDay?: string
  /** Callback invoked when budget limit exceeded */
  onBudgetExceeded?: (info: { limit: string; requested: string; type: string }) => void
}

/** Options for creating a KovaClient */
export interface KovaClientOptions {
  /** Stellar secret key (S... format) */
  stellarSecret: string
  /** Stellar network */
  network: StellarNetwork
  /** Budget spending limits */
  budget?: BudgetConfig
}

/** Spending record for single payment */
interface PaymentRecord {
  amount: string
  url: string
  timestamp: number
}

/** Summary of spending activity */
export interface SpendingSummary {
  totalSpent: string
  requestsCount: number
  lastPayment: PaymentRecord | null
}

/** Error thrown when budget limit exceeded */
export class BudgetExceededError extends Error {
  constructor(
    public readonly limitType: string,
    public readonly limit: string,
    public readonly requested: string,
  ) {
    super(`Budget exceeded: ${limitType} limit is ${limit}, requested ${requested}`)
    this.name = "BudgetExceededError"
  }
}

/**
 * KovaClient — fetch wrapper that auto-pays x402 paywalls on Stellar.
 */
export class KovaClient {
  private readonly wallet: StellarWallet
  private readonly network: StellarNetwork
  private readonly budget?: BudgetConfig
  private readonly payments: PaymentRecord[] = []

  constructor(options: KovaClientOptions) {
    this.network = options.network
    this.budget = options.budget
    this.wallet = createStellarWallet({
      stellarSecret: options.stellarSecret,
      network: options.network,
    })
  }

  /**
   * Fetch a URL, auto-detecting and paying x402 paywalls.
   * If server returns 402, signs Soroban auth entry and retries.
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options)

    if (response.status !== 402) {
      return response
    }

    const body = await response.json()
    const requirements = parse402Response(body)

    this.checkBudget(requirements)

    const amount = decimalToStroops(requirements.maxAmountRequired)
    const signed = await this.wallet.signAuthEntry({
      contractId: requirements.asset.contractId,
      payTo: requirements.payTo,
      amount,
      maxLedgerOffset: requirements.maxLedgerOffset,
    })

    const payload = buildPaymentPayload(requirements, signed)
    const paymentHeader = encodePaymentHeader(payload)

    const retryHeaders: Record<string, string> = {
      ...Object.fromEntries(new Headers(options?.headers).entries()),
      "X-PAYMENT": paymentHeader,
    }

    const retryResponse = await fetch(url, {
      ...options,
      headers: retryHeaders,
    })

    this.payments.push({
      amount: requirements.maxAmountRequired,
      url,
      timestamp: Date.now(),
    })

    return retryResponse
  }

  /**
   * Fetch multiple URLs concurrently, auto-paying any 402 paywalls.
   */
  async fetchAll(urls: string[], options?: RequestInit): Promise<Response[]> {
    return Promise.all(urls.map((url) => this.fetch(url, options)))
  }

  /**
   * Get a summary of spending activity.
   */
  getSpending(): SpendingSummary {
    const totalStroops = this.payments.reduce((sum, p) => sum + decimalToStroops(p.amount), 0n)

    return {
      totalSpent: this.stroopsToDecimal(totalStroops),
      requestsCount: this.payments.length,
      lastPayment: this.payments.length > 0 ? this.payments[this.payments.length - 1] : null,
    }
  }

  private checkBudget(requirements: PaymentRequirements): void {
    if (!this.budget) return

    const requestedAmount = decimalToStroops(requirements.maxAmountRequired)

    if (this.budget.maxPerRequest) {
      const limit = decimalToStroops(this.budget.maxPerRequest)
      if (requestedAmount > limit) {
        this.budget.onBudgetExceeded?.({
          limit: this.budget.maxPerRequest,
          requested: requirements.maxAmountRequired,
          type: "maxPerRequest",
        })
        throw new BudgetExceededError("maxPerRequest", this.budget.maxPerRequest, requirements.maxAmountRequired)
      }
    }

    const now = Date.now()

    if (this.budget.maxPerHour) {
      const hourAgo = now - 3_600_000
      const hourlySpent = this.payments
        .filter((p) => p.timestamp > hourAgo)
        .reduce((sum, p) => sum + decimalToStroops(p.amount), 0n)
      const limit = decimalToStroops(this.budget.maxPerHour)
      if (hourlySpent + requestedAmount > limit) {
        this.budget.onBudgetExceeded?.({
          limit: this.budget.maxPerHour,
          requested: requirements.maxAmountRequired,
          type: "maxPerHour",
        })
        throw new BudgetExceededError("maxPerHour", this.budget.maxPerHour, requirements.maxAmountRequired)
      }
    }

    if (this.budget.maxPerDay) {
      const dayAgo = now - 86_400_000
      const dailySpent = this.payments
        .filter((p) => p.timestamp > dayAgo)
        .reduce((sum, p) => sum + decimalToStroops(p.amount), 0n)
      const limit = decimalToStroops(this.budget.maxPerDay)
      if (dailySpent + requestedAmount > limit) {
        this.budget.onBudgetExceeded?.({
          limit: this.budget.maxPerDay,
          requested: requirements.maxAmountRequired,
          type: "maxPerDay",
        })
        throw new BudgetExceededError("maxPerDay", this.budget.maxPerDay, requirements.maxAmountRequired)
      }
    }
  }

  private stroopsToDecimal(stroops: bigint): string {
    if (stroops === 0n) return "0"
    const whole = stroops / 10_000_000n
    const frac = stroops % 10_000_000n
    if (frac === 0n) return whole.toString()
    const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "")
    return `${whole}.${fracStr}`
  }
}
