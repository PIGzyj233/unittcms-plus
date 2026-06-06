import { DataTypes, Op } from 'sequelize';

import defineAgentIdempotencyRecord from '../../../models/agentIdempotencyRecords.js';

function agentIdempotencyRecordModel(sequelize) {
  return sequelize.models.AgentIdempotencyRecord || defineAgentIdempotencyRecord(sequelize, DataTypes);
}

function idempotencyError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function idempotencyIdentity({ userId, operationType, idempotencyKey }) {
  return { userId, operationType, idempotencyKey };
}

function isActiveIdempotencyRecord(record, now) {
  return new Date(record.expiresAt).getTime() > now.getTime();
}

function idempotencyConflict(record, payloadHash) {
  return Boolean(record && record.payloadHash !== payloadHash);
}

function idempotencyExpiry(now = new Date()) {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

async function findActiveIdempotencyRecord(
  sequelize,
  { userId, operationType, idempotencyKey, now = new Date() },
  options = {}
) {
  if (!idempotencyKey) return null;

  const IdempotencyRecord = agentIdempotencyRecordModel(sequelize);

  return IdempotencyRecord.findOne({
    ...options,
    where: {
      userId,
      operationType,
      idempotencyKey,
      expiresAt: { [Op.gt]: now },
    },
  });
}

async function storeIdempotencyRecord(
  sequelize,
  { userId, operationType, idempotencyKey, payloadHash, responseStatus = 200, responseBody, now = new Date() },
  options = {}
) {
  if (!idempotencyKey) {
    throw idempotencyError('Idempotency key is required', 400, 'IDEMPOTENCY_KEY_REQUIRED');
  }

  const IdempotencyRecord = agentIdempotencyRecordModel(sequelize);
  const where = idempotencyIdentity({ userId, operationType, idempotencyKey });
  const reconcileRecord = async (record) => {
    if (isActiveIdempotencyRecord(record, now)) {
      if (record.payloadHash === payloadHash) return record;

      throw idempotencyError('Idempotency key payload mismatch', 409, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
    }

    const [affectedCount] = await IdempotencyRecord.update(
      {
        payloadHash,
        responseStatus,
        responseBody,
        expiresAt: idempotencyExpiry(now),
      },
      {
        ...options,
        where: {
          id: record.id,
          expiresAt: { [Op.lte]: now },
        },
      }
    );

    const refreshedRecord = await IdempotencyRecord.findByPk(record.id, options);

    if (affectedCount === 1) return refreshedRecord;
    if (!refreshedRecord) throw idempotencyError('Idempotency record not found', 404, 'IDEMPOTENCY_RECORD_NOT_FOUND');

    return reconcileRecord(refreshedRecord);
  };

  const existing = await IdempotencyRecord.findOne({ ...options, where });
  if (existing) return reconcileRecord(existing);

  try {
    return await IdempotencyRecord.create(
      {
        userId,
        operationType,
        idempotencyKey,
        payloadHash,
        responseStatus,
        responseBody,
        expiresAt: idempotencyExpiry(now),
      },
      options
    );
  } catch (error) {
    if (error.name !== 'SequelizeUniqueConstraintError') throw error;

    const racedRecord = await IdempotencyRecord.findOne({ ...options, where });
    if (!racedRecord) throw error;

    return reconcileRecord(racedRecord);
  }
}

export { findActiveIdempotencyRecord, idempotencyConflict, idempotencyExpiry, storeIdempotencyRecord };
