import crypto from 'crypto';
import { DataTypes, Op } from 'sequelize';

import defineAgentOperationToken from '../../../models/agentOperationTokens.js';

function agentOperationTokenModel(sequelize) {
  return sequelize.models.AgentOperationToken || defineAgentOperationToken(sequelize, DataTypes);
}

function operationTokenError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function validateOperationTokenBinding({ record, expected }) {
  if (!record) throw operationTokenError('Operation token not found', 404, 'operation_token_not_found');
  if (record.userId !== expected.userId) {
    throw operationTokenError('Operation token user mismatch', 409, 'operation_token_user_mismatch');
  }
  if (record.projectId !== expected.projectId) {
    throw operationTokenError('Operation token project mismatch', 409, 'operation_token_project_mismatch');
  }
  if (record.operationType !== expected.operationType) {
    throw operationTokenError('Operation token operation mismatch', 409, 'operation_token_operation_mismatch');
  }
  if (record.payloadHash !== expected.payloadHash) {
    throw operationTokenError('Operation token payload mismatch', 409, 'operation_token_payload_mismatch');
  }
  if ((record.idempotencyKey ?? null) !== (expected.idempotencyKey ?? null)) {
    throw operationTokenError(
      'Operation token idempotency key mismatch',
      409,
      'operation_token_idempotency_key_mismatch'
    );
  }
}

function buildOperationTokenBody({
  now = new Date(),
  userId,
  projectId,
  operationType,
  payloadHash,
  affectedResourceIds,
  idempotencyKey,
}) {
  return {
    token: `op_tok_${crypto.randomBytes(32).toString('base64url')}`,
    userId,
    projectId,
    operationType,
    payloadHash,
    affectedResourceIds,
    idempotencyKey: idempotencyKey || null,
    expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
  };
}

function validateOperationTokenRecord({ record, expected }) {
  const now = expected.now || new Date();

  if (!record) throw operationTokenError('Operation token not found', 404, 'operation_token_not_found');
  if (record.consumedAt) {
    throw operationTokenError('Operation token has already been used', 409, 'operation_token_used');
  }
  if (record.expiresAt <= now) {
    throw operationTokenError('Operation token has expired', 409, 'operation_token_expired');
  }
  validateOperationTokenBinding({ record, expected });
}

async function consumeOperationToken(sequelize, { token, expected, now }, options = {}) {
  const OperationToken = agentOperationTokenModel(sequelize);
  const consumedAt = now || expected.now || new Date();
  const expectedWithNow = { ...expected, idempotencyKey: expected.idempotencyKey ?? null, now: consumedAt };
  const [affectedCount] = await OperationToken.update(
    { consumedAt },
    {
      ...options,
      where: {
        token,
        consumedAt: null,
        expiresAt: { [Op.gt]: consumedAt },
        userId: expectedWithNow.userId,
        projectId: expectedWithNow.projectId,
        operationType: expectedWithNow.operationType,
        payloadHash: expectedWithNow.payloadHash,
        idempotencyKey: expectedWithNow.idempotencyKey,
      },
    }
  );

  const record = await OperationToken.findOne({ ...options, where: { token } });

  if (affectedCount === 1) {
    return record;
  }

  validateOperationTokenRecord({ record, expected: expectedWithNow });
  throw operationTokenError('Operation token could not be consumed', 409, 'operation_token_consume_failed');
}

export { buildOperationTokenBody, consumeOperationToken, validateOperationTokenBinding, validateOperationTokenRecord };
