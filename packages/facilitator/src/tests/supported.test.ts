import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { supportedRoute } from '../routes/supported.js';

describe('GET /supported', () => {
  it('returns 200 with supported schemes, networks, and assets', async () => {
    const app = Fastify();
    await app.register(supportedRoute);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/supported' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.schemes).toContain('x402');
    expect(body.networks).toContain('testnet');
    expect(body.networks).toContain('mainnet');
    expect(body.assets.testnet[0].code).toBe('USDC');
    expect(body.assets.mainnet[0].code).toBe('USDC');
  });
});
