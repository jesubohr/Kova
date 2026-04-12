import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../x402/verify.js', () => ({
  verifyPayment: vi.fn(),
}));

vi.mock('../x402/settle.js', () => ({
  settlePayment: vi.fn(),
}));

import { kovaMiddleware } from '../middleware/express.js';
import { verifyPayment } from '../x402/verify.js';
import { settlePayment } from '../x402/settle.js';
import type { KovaServerOptions } from '../config.js';

const OPTIONS: KovaServerOptions = {
  facilitatorUrl: 'http://localhost:4021',
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  network: 'testnet',
  routes: [{ method: 'GET', path: '/api/weather', price: '$0.001' }],
};

describe('kovaMiddleware (Express)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(kovaMiddleware(OPTIONS));
    app.get('/api/weather', (_req, res) => { res.json({ weather: 'sunny' }); });
    app.get('/api/free', (_req, res) => { res.json({ free: true }); });
  });

  it('returns 402 when no X-PAYMENT header on protected route', async () => {
    const res = await request(app).get('/api/weather');

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('payment_required');
    expect(res.body.requirements.maxAmountRequired).toBe('0.001');
  });

  it('passes through unprotected routes without payment', async () => {
    const res = await request(app).get('/api/free');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ free: true });
  });

  it('returns 402 when verification fails', async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: false, error: 'Bad auth' });

    const payment = Buffer.from(JSON.stringify({
      scheme: 'x402',
      network: 'testnet',
      authEntry: 'base64==',
      from: 'GABC...',
    })).toString('base64');

    const res = await request(app)
      .get('/api/weather')
      .set('X-PAYMENT', payment);

    expect(res.status).toBe(402);
  });

  it('passes through and settles when verification succeeds', async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: true });
    vi.mocked(settlePayment).mockResolvedValue(undefined);

    const payment = Buffer.from(JSON.stringify({
      scheme: 'x402',
      network: 'testnet',
      authEntry: 'base64==',
      from: 'GABC...',
    })).toString('base64');

    const res = await request(app)
      .get('/api/weather')
      .set('X-PAYMENT', payment);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ weather: 'sunny' });
    expect(verifyPayment).toHaveBeenCalledOnce();
    expect(settlePayment).toHaveBeenCalledOnce();
  });
});
