import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, describe, expect, it } from 'vitest';

import defineAgentAuditLog from '../../../models/agentAuditLogs.js';
import defineAgentIdempotencyRecord from '../../../models/agentIdempotencyRecords.js';
import defineAgentOperationToken from '../../../models/agentOperationTokens.js';
import { writeAgentAudit } from './audit.js';
import {
  findActiveIdempotencyRecord,
  idempotencyConflict,
  idempotencyExpiry,
  storeIdempotencyRecord,
} from './idempotency.js';
import {
  buildOperationTokenBody,
  consumeOperationToken,
  validateOperationTokenBinding,
  validateOperationTokenRecord,
} from './operationTokens.js';

async function createAgentSafetySequelize() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

  defineAgentOperationToken(sequelize, DataTypes);
  defineAgentIdempotencyRecord(sequelize, DataTypes);
  defineAgentAuditLog(sequelize, DataTypes);

  await sequelize.sync({ force: true });

  return sequelize;
}

async function createOperationTokenRecord(sequelize, overrides = {}) {
  return sequelize.models.AgentOperationToken.create({
    ...buildOperationTokenBody({
      now: new Date('2026-06-05T00:00:00.000Z'),
      userId: 1,
      projectId: 2,
      operationType: 'accept-candidates',
      payloadHash: 'sha256:abc',
      affectedResourceIds: [3],
      idempotencyKey: 'k1',
    }),
    ...overrides,
  });
}

function expectTokenValidationError(callback, message, status, code) {
  try {
    callback();
  } catch (error) {
    expect(error.message).toBe(message);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    return;
  }

  throw new Error(`Expected token validation error: ${message}`);
}

describe('agent dry-run safety helpers', () => {
  let sequelize;

  afterEach(async () => {
    if (sequelize) {
      await sequelize.close();
      sequelize = null;
    }
  });

  it('builds a three-hour operation token body', () => {
    const now = new Date('2026-06-05T00:00:00.000Z');
    const body = buildOperationTokenBody({
      now,
      userId: 1,
      projectId: 2,
      operationType: 'accept-candidates',
      payloadHash: 'sha256:abc',
      affectedResourceIds: [3],
      idempotencyKey: 'k1',
    });

    expect(body.expiresAt.toISOString()).toBe('2026-06-05T03:00:00.000Z');
    expect(body.token).toMatch(/^op_tok_/);
  });

  it('rejects missing, consumed, expired, and mismatched token bindings with client-safe metadata', () => {
    const now = new Date('2026-06-05T00:00:00.000Z');
    const baseRecord = {
      userId: 1,
      projectId: 2,
      operationType: 'a',
      payloadHash: 'sha256:a',
      idempotencyKey: 'k1',
      consumedAt: null,
      expiresAt: new Date('2026-06-05T01:00:00.000Z'),
    };
    const baseExpected = {
      userId: 1,
      projectId: 2,
      operationType: 'a',
      payloadHash: 'sha256:a',
      idempotencyKey: 'k1',
      now,
    };

    expectTokenValidationError(
      () => validateOperationTokenRecord({ record: null, expected: baseExpected }),
      'Operation token not found',
      404,
      'operation_token_not_found'
    );
    expectTokenValidationError(
      () => validateOperationTokenRecord({ record: { ...baseRecord, consumedAt: now }, expected: baseExpected }),
      'Operation token has already been used',
      409,
      'operation_token_used'
    );
    expectTokenValidationError(
      () =>
        validateOperationTokenRecord({
          record: { ...baseRecord, expiresAt: now },
          expected: baseExpected,
        }),
      'Operation token has expired',
      409,
      'operation_token_expired'
    );
    expectTokenValidationError(
      () =>
        validateOperationTokenRecord({
          record: { ...baseRecord, userId: 2 },
          expected: baseExpected,
        }),
      'Operation token user mismatch',
      409,
      'operation_token_user_mismatch'
    );
    expectTokenValidationError(
      () =>
        validateOperationTokenRecord({
          record: { ...baseRecord, projectId: 3 },
          expected: baseExpected,
        }),
      'Operation token project mismatch',
      409,
      'operation_token_project_mismatch'
    );
    expectTokenValidationError(
      () =>
        validateOperationTokenRecord({
          record: { ...baseRecord, operationType: 'b' },
          expected: baseExpected,
        }),
      'Operation token operation mismatch',
      409,
      'operation_token_operation_mismatch'
    );
    expectTokenValidationError(
      () =>
        validateOperationTokenRecord({
          record: { ...baseRecord, payloadHash: 'sha256:b' },
          expected: baseExpected,
        }),
      'Operation token payload mismatch',
      409,
      'operation_token_payload_mismatch'
    );
    expectTokenValidationError(
      () =>
        validateOperationTokenRecord({
          record: baseRecord,
          expected: { ...baseExpected, idempotencyKey: 'k2' },
        }),
      'Operation token idempotency key mismatch',
      409,
      'operation_token_idempotency_key_mismatch'
    );
  });

  it('rejects mismatched token bindings', () => {
    expect(() =>
      validateOperationTokenRecord({
        record: {
          userId: 1,
          projectId: 2,
          operationType: 'a',
          payloadHash: 'sha256:a',
          idempotencyKey: null,
          consumedAt: null,
          expiresAt: new Date('2026-06-05T01:00:00.000Z'),
        },
        expected: {
          userId: 1,
          projectId: 3,
          operationType: 'a',
          payloadHash: 'sha256:a',
          now: new Date('2026-06-05T00:00:00.000Z'),
        },
      })
    ).toThrow('Operation token project mismatch');
  });

  it('validates consumed token bindings without requiring consumable state for idempotency replay', () => {
    const record = {
      userId: 1,
      projectId: 2,
      operationType: 'accept-candidates',
      payloadHash: 'sha256:a',
      idempotencyKey: 'k1',
      consumedAt: new Date('2026-06-05T00:10:00.000Z'),
      expiresAt: new Date('2026-06-05T00:15:00.000Z'),
    };
    const expected = {
      userId: 1,
      projectId: 2,
      operationType: 'accept-candidates',
      payloadHash: 'sha256:a',
      idempotencyKey: 'k1',
    };

    expect(() => validateOperationTokenBinding({ record, expected })).not.toThrow();
    expect(() => validateOperationTokenBinding({ record, expected: { ...expected, projectId: 3 } })).toThrow(
      'Operation token project mismatch'
    );
  });

  it('compares token idempotency keys even when expected omits the key', () => {
    expect(() =>
      validateOperationTokenRecord({
        record: {
          userId: 1,
          projectId: 2,
          operationType: 'a',
          payloadHash: 'sha256:a',
          idempotencyKey: 'k1',
          consumedAt: null,
          expiresAt: new Date('2026-06-05T01:00:00.000Z'),
        },
        expected: {
          userId: 1,
          projectId: 2,
          operationType: 'a',
          payloadHash: 'sha256:a',
          now: new Date('2026-06-05T00:00:00.000Z'),
        },
      })
    ).toThrow('Operation token idempotency key mismatch');
  });

  it('detects idempotency hash conflicts', () => {
    expect(idempotencyConflict({ payloadHash: 'sha256:a' }, 'sha256:b')).toBe(true);
    expect(idempotencyConflict({ payloadHash: 'sha256:a' }, 'sha256:a')).toBe(false);
  });

  it('consumes operation tokens once with the expected binding', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:30:00.000Z');
    const record = await createOperationTokenRecord(sequelize);
    const expected = {
      userId: 1,
      projectId: 2,
      operationType: 'accept-candidates',
      payloadHash: 'sha256:abc',
      idempotencyKey: 'k1',
    };

    const consumed = await consumeOperationToken(sequelize, {
      token: record.token,
      expected,
      now,
    });

    expect(consumed.consumedAt.toISOString()).toBe(now.toISOString());
    await expect(
      consumeOperationToken(sequelize, {
        token: record.token,
        expected,
        now: new Date('2026-06-05T00:31:00.000Z'),
      })
    ).rejects.toMatchObject({
      message: 'Operation token has already been used',
      status: 409,
      code: 'operation_token_used',
    });
  });

  it('guards token consumption by expiration and idempotency key', async () => {
    sequelize = await createAgentSafetySequelize();
    const token = 'op_tok_guarded';
    await createOperationTokenRecord(sequelize, { token, expiresAt: new Date('2026-06-05T00:15:00.000Z') });

    await expect(
      consumeOperationToken(sequelize, {
        token,
        expected: {
          userId: 1,
          projectId: 2,
          operationType: 'accept-candidates',
          payloadHash: 'sha256:abc',
          idempotencyKey: 'k1',
        },
        now: new Date('2026-06-05T00:30:00.000Z'),
      })
    ).rejects.toMatchObject({
      message: 'Operation token has expired',
      status: 409,
      code: 'operation_token_expired',
    });

    await sequelize.models.AgentOperationToken.destroy({ where: { token } });
    await createOperationTokenRecord(sequelize, { token });

    await expect(
      consumeOperationToken(sequelize, {
        token,
        expected: {
          userId: 1,
          projectId: 2,
          operationType: 'accept-candidates',
          payloadHash: 'sha256:abc',
          idempotencyKey: 'k2',
        },
        now: new Date('2026-06-05T00:30:00.000Z'),
      })
    ).rejects.toMatchObject({
      message: 'Operation token idempotency key mismatch',
      status: 409,
      code: 'operation_token_idempotency_key_mismatch',
    });
  });

  it('computes idempotency expiry and finds only active keyed records', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:00:00.000Z');

    expect(idempotencyExpiry(now).toISOString()).toBe('2026-06-06T00:00:00.000Z');
    expect(
      await findActiveIdempotencyRecord(sequelize, {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: null,
        now,
      })
    ).toBeNull();

    await sequelize.models.AgentIdempotencyRecord.bulkCreate([
      {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: 'active',
        payloadHash: 'sha256:active',
        responseStatus: 200,
        responseBody: { ok: true },
        expiresAt: new Date('2026-06-05T00:00:01.000Z'),
      },
      {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: 'expired',
        payloadHash: 'sha256:expired',
        responseStatus: 200,
        responseBody: { ok: false },
        expiresAt: now,
      },
    ]);

    await expect(
      findActiveIdempotencyRecord(sequelize, {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: 'expired',
        now,
      })
    ).resolves.toBeNull();

    const active = await findActiveIdempotencyRecord(sequelize, {
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'active',
      now,
    });

    expect(active.payloadHash).toBe('sha256:active');
  });

  it('stores keyed idempotency records with a 24-hour ttl', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:00:00.000Z');

    await expect(
      storeIdempotencyRecord(sequelize, {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: null,
        payloadHash: 'sha256:abc',
        responseBody: { ok: true },
        now,
      })
    ).rejects.toMatchObject({
      message: 'Idempotency key is required',
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });

    const stored = await storeIdempotencyRecord(sequelize, {
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'k1',
      payloadHash: 'sha256:abc',
      responseStatus: 201,
      responseBody: { created: [3] },
      now,
    });

    expect(stored.responseStatus).toBe(201);
    expect(stored.expiresAt.toISOString()).toBe('2026-06-06T00:00:00.000Z');
  });

  it('reuses expired idempotency keys by updating the existing row', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:00:00.000Z');
    const expired = await sequelize.models.AgentIdempotencyRecord.create({
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'reuse-me',
      payloadHash: 'sha256:old',
      responseStatus: 200,
      responseBody: { old: true },
      expiresAt: now,
    });

    const stored = await storeIdempotencyRecord(sequelize, {
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'reuse-me',
      payloadHash: 'sha256:new',
      responseStatus: 202,
      responseBody: { new: true },
      now,
    });

    expect(stored.id).toBe(expired.id);
    expect(stored.payloadHash).toBe('sha256:new');
    expect(stored.responseStatus).toBe(202);
    expect(stored.responseBody).toEqual({ new: true });
    expect(stored.expiresAt.toISOString()).toBe('2026-06-06T00:00:00.000Z');
    expect(await sequelize.models.AgentIdempotencyRecord.count()).toBe(1);
  });

  it('reconciles stale expired-row refresh attempts after another request wins the refresh', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:00:00.000Z');
    const expired = await sequelize.models.AgentIdempotencyRecord.create({
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'race-key',
      payloadHash: 'sha256:old',
      responseStatus: 200,
      responseBody: { old: true },
      expiresAt: now,
    });
    const IdempotencyRecord = sequelize.models.AgentIdempotencyRecord;
    const originalUpdate = IdempotencyRecord.update.bind(IdempotencyRecord);
    let guardedUpdateCalls = 0;

    IdempotencyRecord.update = async () => {
      guardedUpdateCalls += 1;
      await originalUpdate(
        {
          payloadHash: 'sha256:winner',
          responseStatus: 201,
          responseBody: { winner: true },
          expiresAt: idempotencyExpiry(now),
        },
        { where: { id: expired.id } }
      );
      return [0];
    };

    try {
      const stored = await storeIdempotencyRecord(sequelize, {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: 'race-key',
        payloadHash: 'sha256:winner',
        responseStatus: 202,
        responseBody: { stale: true },
        now,
      });

      expect(guardedUpdateCalls).toBe(1);
      expect(stored.id).toBe(expired.id);
      expect(stored.payloadHash).toBe('sha256:winner');
      expect(stored.responseStatus).toBe(201);
      expect(stored.responseBody).toEqual({ winner: true });

      await expect(
        storeIdempotencyRecord(sequelize, {
          userId: 1,
          operationType: 'accept-candidates',
          idempotencyKey: 'race-key',
          payloadHash: 'sha256:loser',
          responseStatus: 202,
          responseBody: { loser: true },
          now,
        })
      ).rejects.toMatchObject({
        message: 'Idempotency key payload mismatch',
        status: 409,
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      });
    } finally {
      IdempotencyRecord.update = originalUpdate;
    }
  });

  it('reuses active idempotency records with the same payload hash', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:00:00.000Z');
    const existing = await sequelize.models.AgentIdempotencyRecord.create({
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'same-key',
      payloadHash: 'sha256:same',
      responseStatus: 200,
      responseBody: { existing: true },
      expiresAt: new Date('2026-06-05T00:00:01.000Z'),
    });

    const stored = await storeIdempotencyRecord(sequelize, {
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'same-key',
      payloadHash: 'sha256:same',
      responseStatus: 202,
      responseBody: { replacement: true },
      now,
    });

    expect(stored.id).toBe(existing.id);
    expect(stored.responseStatus).toBe(200);
    expect(stored.responseBody).toEqual({ existing: true });
    expect(await sequelize.models.AgentIdempotencyRecord.count()).toBe(1);
  });

  it('rejects active idempotency records with a different payload hash', async () => {
    sequelize = await createAgentSafetySequelize();
    const now = new Date('2026-06-05T00:00:00.000Z');
    await sequelize.models.AgentIdempotencyRecord.create({
      userId: 1,
      operationType: 'accept-candidates',
      idempotencyKey: 'conflict-key',
      payloadHash: 'sha256:old',
      responseStatus: 200,
      responseBody: { existing: true },
      expiresAt: new Date('2026-06-05T00:00:01.000Z'),
    });

    await expect(
      storeIdempotencyRecord(sequelize, {
        userId: 1,
        operationType: 'accept-candidates',
        idempotencyKey: 'conflict-key',
        payloadHash: 'sha256:new',
        responseStatus: 202,
        responseBody: { replacement: true },
        now,
      })
    ).rejects.toMatchObject({
      message: 'Idempotency key payload mismatch',
      status: 409,
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });
  });

  it('persists audit logs and honors transaction options', async () => {
    sequelize = await createAgentSafetySequelize();

    const committed = await writeAgentAudit(sequelize, {
      userId: 1,
      projectId: 2,
      operationType: 'accept-candidates',
      phase: 'dry-run',
      payloadHash: 'sha256:abc',
      idempotencyKey: '',
      resultSummary: { candidates: 1 },
    });

    expect(committed.id).toEqual(expect.any(Number));
    expect(committed.idempotencyKey).toBeNull();
    expect(await sequelize.models.AgentAuditLog.count()).toBe(1);

    const transaction = await sequelize.transaction();
    await writeAgentAudit(
      sequelize,
      {
        userId: 1,
        projectId: 2,
        operationType: 'accept-candidates',
        phase: 'commit',
        payloadHash: 'sha256:abc',
        idempotencyKey: 'k1',
        resultSummary: { accepted: 1 },
      },
      { transaction }
    );
    await transaction.rollback();

    expect(await sequelize.models.AgentAuditLog.count()).toBe(1);
  });
});
