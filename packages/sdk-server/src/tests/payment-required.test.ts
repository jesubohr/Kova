import { describe, it, expect } from 'vitest';
import { buildPaymentRequired } from '../x402/payment-required.js';
import type { KovaServerOptions, RouteConfig } from '../config.js';

const DEFAULT_OPTIONS: KovaServerOptions = {
  facilitatorUrl: 'http://localhost:4021',
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  network: 'testnet',
  routes: [],
};

const ROUTE: RouteConfig = {
  method: 'GET',
  path: '/api/weather',
  price: '$0.001',
};

describe('buildPaymentRequired', () => {
  it('returns correct 402 body with USDC testnet defaults', () => {
    const body = buildPaymentRequired(ROUTE, DEFAULT_OPTIONS);

    expect(body.error).toBe('payment_required');
    expect(body.requirements.scheme).toBe('x402');
    expect(body.requirements.network).toBe('testnet');
    expect(body.requirements.maxAmountRequired).toBe('0.001');
    expect(body.requirements.payTo).toBe(DEFAULT_OPTIONS.payTo);
    expect(body.requirements.facilitatorUrl).toBe('http://localhost:4021');
    expect(body.requirements.maxLedgerOffset).toBe(12);
    expect(body.requirements.asset.code).toBe('USDC');
    expect(body.requirements.asset.contractId).toBe(
      'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    );
  });

  it('uses custom asset when provided', () => {
    const customAsset = { code: 'XLM', issuer: '', contractId: 'CXLM...' };
    const body = buildPaymentRequired(ROUTE, { ...DEFAULT_OPTIONS, asset: customAsset });

    expect(body.requirements.asset).toEqual(customAsset);
  });

  it('uses custom maxLedgerOffset when provided', () => {
    const body = buildPaymentRequired(ROUTE, { ...DEFAULT_OPTIONS, maxLedgerOffset: 24 });

    expect(body.requirements.maxLedgerOffset).toBe(24);
  });

  it('uses mainnet USDC for mainnet network', () => {
    const body = buildPaymentRequired(ROUTE, { ...DEFAULT_OPTIONS, network: 'mainnet' });

    expect(body.requirements.network).toBe('mainnet');
    expect(body.requirements.asset.contractId).toBe(
      'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    );
  });
});
