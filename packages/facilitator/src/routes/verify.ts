import type { FastifyPluginAsync } from 'fastify';
import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';
import { getRpcServer } from '../stellar/client.js';
import { decimalToStroops } from '../utils.js';
import type { VerifyRequest, VerifyResponse } from '../types.js';

export const verifyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: VerifyRequest; Reply: VerifyResponse }>('/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['payload', 'requirements'],
        properties: {
          payload: {
            type: 'object',
            required: ['scheme', 'network', 'authEntry', 'from'],
            properties: {
              scheme: { type: 'string' },
              network: { type: 'string' },
              authEntry: { type: 'string' },
              from: { type: 'string' },
            },
          },
          requirements: {
            type: 'object',
            required: ['maxAmountRequired', 'asset', 'payTo', 'network'],
            properties: {
              maxAmountRequired: { type: 'string' },
              asset: { type: 'object', required: ['contractId'], properties: { contractId: { type: 'string' } } },
              payTo: { type: 'string' },
              network: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { payload, requirements } = request.body;

    const server = getRpcServer(payload.network as 'testnet' | 'mainnet');
    const { sequence: currentLedger } = await server.getLatestLedger();

    try {
      await verifyAuthEntry({
        authEntryBase64: payload.authEntry,
        expectedContractId: requirements.asset.contractId,
        expectedPayTo: requirements.payTo,
        expectedFrom: payload.from,
        minAmount: decimalToStroops(requirements.maxAmountRequired),
        currentLedger,
      });
      return reply.send({ valid: true });
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        return reply.send({ valid: false, error: err.message });
      }
      throw err;
    }
  });
};