import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { KovaServerOptions } from '../config.js';
import type { PaymentPayload, PaymentRequirements } from '../x402/types.js';
import { matchRoute } from '../utils.js';
import { buildPaymentRequired } from '../x402/payment-required.js';
import { verifyPayment } from '../x402/verify.js';
import { settlePayment } from '../x402/settle.js';

function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(json) as PaymentPayload;
  } catch {
    return null;
  }
}

const kovaPluginImpl: FastifyPluginAsync<KovaServerOptions> = async (fastify, options) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const route = matchRoute(request.method, request.url, options.routes);
    if (!route) return;

    const body402 = buildPaymentRequired(route, options);
    const requirements: PaymentRequirements = body402.requirements;

    const paymentHeader = request.headers['x-payment'] as string | undefined;
    if (!paymentHeader) {
      return reply.status(402).send(body402);
    }

    const payload = decodePaymentHeader(paymentHeader);
    if (!payload) {
      return reply.status(402).send(body402);
    }

    const verification = await verifyPayment(payload, requirements);
    if (!verification.valid) {
      return reply.status(402).send(body402);
    }

    // Verification passed — settle after response (fire-and-forget)
    reply.then(
      () => { settlePayment(payload, requirements); },
      () => undefined,
    );
  });
};

export const kovaPlugin = fp(kovaPluginImpl, {
  name: 'kova-plugin',
  fastify: '5.x',
});
