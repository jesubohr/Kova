import type { FastifyPluginAsync } from "fastify"
import { verifyAuthEntry, AuthVerificationError } from "../stellar/verify-auth.js"
import { getRpcServer } from "../stellar/client.js"
import { decimalToStroops } from "../utils.js"
import { validateApiKey } from "../auth/validate-api-key.js"
import { validateEndpoint } from "../auth/validate-endpoint.js"
import type { VerifyRequest, VerifyResponse } from "../types.js"

export const verifyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: VerifyRequest; Reply: VerifyResponse }>(
    "/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["payload", "requirements", "apiKey", "route"],
          properties: {
            payload: {
              type: "object",
              required: ["scheme", "network", "authEntry", "from"],
              properties: {
                scheme: { type: "string" },
                network: { type: "string" },
                authEntry: { type: "string" },
                from: { type: "string" },
              },
            },
            requirements: {
              type: "object",
              required: ["maxAmountRequired", "asset", "payTo", "network"],
              properties: {
                maxAmountRequired: { type: "string" },
                asset: { type: "object", required: ["contractId"], properties: { contractId: { type: "string" } } },
                payTo: { type: "string" },
                network: { type: "string" },
              },
            },
            apiKey: { type: "string" },
            route: {
              type: "object",
              required: ["method", "path"],
              properties: {
                method: { type: "string" },
                path: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { payload, requirements, apiKey, route } = request.body

      // 1. Validate API key
      const keyResult = await validateApiKey(apiKey)
      if (!keyResult.valid) {
        return reply.send({ valid: false, error: keyResult.error })
      }

      // 2. Validate endpoint + wallet match
      const endpointResult = await validateEndpoint(
        keyResult.userId!,
        requirements.payTo,
        route.method,
        route.path,
        requirements.maxAmountRequired,
      )
      if (!endpointResult.valid) {
        return reply.send({ valid: false, error: endpointResult.error })
      }

      // 3. Verify Soroban auth entry
      const server = getRpcServer(payload.network as "testnet" | "mainnet")
      const { sequence: currentLedger } = await server.getLatestLedger()

      try {
        await verifyAuthEntry({
          authEntryBase64: payload.authEntry,
          expectedContractId: requirements.asset.contractId,
          expectedPayTo: requirements.payTo,
          expectedFrom: payload.from,
          minAmount: decimalToStroops(requirements.maxAmountRequired),
          currentLedger,
        })
        return reply.send({
          valid: true,
          context: { userId: keyResult.userId!, endpointId: endpointResult.endpointId! },
        })
      } catch (err) {
        if (err instanceof AuthVerificationError) {
          return reply.send({ valid: false, error: err.message })
        }
        throw err
      }
    },
  )
}
