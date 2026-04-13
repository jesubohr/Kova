import type { Request, Response, NextFunction } from "express"
import type { KovaServerOptions } from "../config.js"
import type { PaymentPayload, PaymentRequirements } from "../x402/types.js"
import { matchRoute } from "../utils.js"
import { buildPaymentRequired } from "../x402/payment-required.js"
import { verifyPayment } from "../x402/verify.js"
import { settlePayment } from "../x402/settle.js"

function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, "base64").toString("utf-8")
    return JSON.parse(json) as PaymentPayload
  } catch {
    return null
  }
}

/**
 * Express middleware that enforces x402 payment on configured routes.
 */
export function kovaMiddleware(options: KovaServerOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const route = matchRoute(req.method, req.path, options.routes)
    if (!route) {
      next()
      return
    }

    const body402 = buildPaymentRequired(route, options)
    const requirements: PaymentRequirements = body402.requirements

    const paymentHeader = req.headers["x-payment"] as string | undefined
    if (!paymentHeader) {
      res.status(402).json(body402)
      return
    }

    const payload = decodePaymentHeader(paymentHeader)
    if (!payload) {
      res.status(402).json(body402)
      return
    }

    const verification = await verifyPayment(payload, requirements)
    if (!verification.valid) {
      res.status(402).json(body402)
      return
    }

    // Settle after response finishes (fire-and-forget)
    res.on("finish", () => {
      settlePayment(payload, requirements)
    })

    next()
  }
}
