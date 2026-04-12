import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settlePayment } from '../x402/settle.js';
import type { PaymentPayload, PaymentRequirements } from '../x402/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const PAYLOAD: PaymentPayload = {
  scheme: 'x402',
  network: 'testnet',
  authEntry: 'base64xdr==',
  from: 'GABC1234567890123456789012345678901234567890123456789012',
};

const REQUIREMENTS: PaymentRequirements = {
  scheme: 'x402',
  network: 'testnet',
  maxAmountRequired: '0.001',
  asset: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  payTo: 'GPAY1234567890123456789012345678901234567890123456789012',
  facilitatorUrl: 'http://localhost:4021',
  maxLedgerOffset: 12,
};

describe('settlePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST to facilitator /settle and does not throw', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, receipt: { txHash: '0xabc' } }),
    });

    await settlePayment(PAYLOAD, REQUIREMENTS);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4021/settle',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: PAYLOAD, requirements: REQUIREMENTS }),
      }),
    );
  });

  it('does not throw when fetch fails (fire-and-forget)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(settlePayment(PAYLOAD, REQUIREMENTS)).resolves.toBeUndefined();
  });

  it('does not throw when response is not ok (fire-and-forget)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(settlePayment(PAYLOAD, REQUIREMENTS)).resolves.toBeUndefined();
  });
});
