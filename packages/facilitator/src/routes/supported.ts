import type { FastifyPluginAsync } from 'fastify';
import { SUPPORTED_ASSETS } from '../stellar/tokens.js';
import type { SupportedResponse } from '../types.js';

export const supportedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: SupportedResponse }>('/supported', async (_req, reply) => {
    return reply.send({
      schemes: ['x402'],
      networks: ['testnet', 'mainnet'],
      assets: SUPPORTED_ASSETS,
    });
  });
};
