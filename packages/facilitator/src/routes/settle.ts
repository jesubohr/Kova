import type { FastifyPluginAsync } from 'fastify';
import { Keypair } from '@stellar/stellar-sdk';
import { verifyAuthEntry, AuthVerificationError } from '../stellar/verify-auth.js';
import { submitTx } from '../stellar/submit-tx.js';
import { getRpcServer } from '../stellar/client.js';
import { calculateFee } from '../fee/calculator.js';
import { decimalToStroops } from '../utils.js';
import { config } from '../config.js';
import type { SettleRequest, SettleResponse } from '../types.js';

function stroopsToDecimal(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = stroops % 10_000_000n;
  if (frac === 0n) return `${whole}`;
  return `${whole}.${frac.toString().padStart(7, '0').replace(/0+$/, '')}`;
}

const FEE_FLOOR_STROOPS = 1_000n;

export const settleRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: SettleRequest; Reply: SettleResponse }>('/settle', {
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
    const network = payload.network as 'testnet' | 'mainnet';

    const server = getRpcServer(network);
    const { sequence: currentLedger } = await server.getLatestLedger();
    const minAmount = decimalToStroops(requirements.maxAmountRequired);

    let verifiedAmount: bigint;
    try {
      const result = await verifyAuthEntry({
        authEntryBase64: payload.authEntry,
        expectedContractId: requirements.asset.contractId,
        expectedPayTo: requirements.payTo,
        expectedFrom: payload.from,
        minAmount,
        currentLedger,
      });
      verifiedAmount = result.amount;
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        return reply.send({ success: false, error: err.message });
      }
      throw err;
    }

    const facilitatorKeypair = Keypair.fromSecret(config.stellarSecret);
    const fee = calculateFee(verifiedAmount, config.feePercent, FEE_FLOOR_STROOPS);

    try {
      const { txHash } = await submitTx({
        authEntryBase64: payload.authEntry,
        contractId: requirements.asset.contractId,
        from: payload.from,
        payTo: requirements.payTo,
        amount: verifiedAmount,
        facilitatorKeypair,
        network,
      });

      return reply.send({
        success: true,
        receipt: {
          txHash,
          network,
          settledAt: new Date().toISOString(),
          amount: stroopsToDecimal(verifiedAmount),
          fee: stroopsToDecimal(fee),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.send({ success: false, error: message });
    }
  });
};