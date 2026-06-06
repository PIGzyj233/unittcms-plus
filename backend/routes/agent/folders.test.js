import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineAgentAuditLog from '../../models/agentAuditLogs.js';
import defineAgentIdempotencyRecord from '../../models/agentIdempotencyRecords.js';
import defineAgentOperationToken from '../../models/agentOperationTokens.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import foldersRoute from './folders.js';
import {
  normalizeFolderDetail,
  normalizeFolderSegment,
  planEnsureFolderPath,
  validateFolderPathSegments,
  withEnsureFolderPathLock,
} from './lib/folders.js';

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 7;
      next();
    },
  }),
}));

vi.mock('../../middleware/verifyEditable.js', () => ({
  default: () => ({ verifyProjectDeveloperFromProjectId: (req, res, next) => next() }),
}));

vi.mock('../../middleware/verifyVisible.js', () => ({
  default: () => ({ verifyProjectVisibleFromProjectId: (req, res, next) => next() }),
}));

describe('agent folder helpers', () => {
  it('normalizes folder names', () => {
    expect(normalizeFolderSegment('  Checkout   Flow  ')).toBe('Checkout Flow');
  });

  it('rejects path separators and too many levels', () => {
    expect(() => validateFolderPathSegments(['a/b'])).toThrow('must not contain path separators');
    expect(() => validateFolderPathSegments(['a', 'b', 'c', 'd', 'e'])).toThrow('limited to four levels');
  });

  it('marks invalid folder names and overlong details as client errors', () => {
    expect(() => validateFolderPathSegments([])).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => normalizeFolderDetail(`${'a'.repeat(500)} `)).not.toThrow();
    expect(() => normalizeFolderDetail('a'.repeat(501))).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('agent folder routes', () => {
  let app;
  let sequelize;
  let Folder;
  let Case;
  let OperationToken;
  let IdempotencyRecord;
  let AuditLog;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    OperationToken = defineAgentOperationToken(sequelize, DataTypes);
    IdempotencyRecord = defineAgentIdempotencyRecord(sequelize, DataTypes);
    AuditLog = defineAgentAuditLog(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');

    app = express();
    app.use(express.json());
    app.use('/agent/folders', foldersRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function casePayload(folderId, overrides = {}) {
    return {
      folderId,
      title: 'Existing case',
      state: 0,
      priority: 1,
      type: 4,
      automationStatus: 1,
      description: '',
      template: 1,
      preConditions: '',
      expectedResults: '',
      ...overrides,
    };
  }

  it('plans descendants of missing folders as created, even if matching root names exist', async () => {
    await Folder.create({ name: 'Child', projectId: 1 });

    const plan = await planEnsureFolderPath(sequelize, { projectId: 1, path: ['New parent', 'Child'] });

    expect(plan.reused).toEqual([]);
    expect(plan.created).toEqual([
      { name: 'New parent', parentFolderId: null, parentPath: [], parentWillBeCreated: false },
      { name: 'Child', parentPath: ['New parent'], parentWillBeCreated: true },
    ]);
  });

  it('serializes ensure path critical sections by project', async () => {
    const events = [];
    let releaseFirst;
    const firstMayFinish = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = withEnsureFolderPathLock(99, async () => {
      events.push('first-start');
      await firstMayFinish;
      events.push('first-finish');
    });
    const second = withEnsureFolderPathLock(99, async () => {
      events.push('second-start');
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(events).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first-start', 'first-finish', 'second-start']);
  });

  it('returns a project-scoped folder tree with case counts', async () => {
    const parent = await Folder.create({ name: 'Payments', detail: 'Payment flows', projectId: 1 });
    const child = await Folder.create({ name: 'Card failures', projectId: 1, parentFolderId: parent.id });
    await Folder.create({ name: 'Other project', projectId: 2 });
    await Case.bulkCreate([
      casePayload(parent.id, { title: 'Payment case' }),
      casePayload(child.id, { title: 'Card case 1' }),
      casePayload(child.id, { title: 'Card case 2' }),
    ]);

    const res = await request(app).get('/agent/folders/tree?projectId=1');

    expect(res.status).toBe(200);
    expect(res.body.folders).toEqual([
      {
        id: parent.id,
        name: 'Payments',
        detail: 'Payment flows',
        parentFolderId: null,
        projectId: 1,
        caseCount: 1,
      },
      {
        id: child.id,
        name: 'Card failures',
        detail: null,
        parentFolderId: parent.id,
        projectId: 1,
        caseCount: 2,
      },
    ]);
  });

  it('dry-runs ensure path without creating folders and writes audit', async () => {
    await Folder.create({ name: 'Payments', projectId: 1 });

    const res = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({
        path: ['  Payments  ', '  Card   failures '],
        detail: 'Card payment failure scenarios',
        idempotencyKey: 'folder-payments-card-failures',
      });

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toMatchObject({
      payloadHash: expect.stringMatching(/^sha256:/),
      summary: {
        operationType: 'ensure-folder-path',
        projectId: 1,
        path: ['Payments', 'Card failures'],
        created: [{ name: 'Card failures', parentFolderId: expect.any(Number) }],
        reused: [{ name: 'Payments', parentFolderId: null }],
      },
      warnings: [],
    });
    expect(res.body.dryRun.operationToken).toMatch(/^op_tok_/);
    expect(await Folder.count()).toBe(1);
    expect(await OperationToken.count()).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'dry-run' } })).toBe(1);
  });

  it('returns 400 for invalid ensure path dry-run payloads', async () => {
    const emptyPathRes = await request(app).post('/agent/folders/ensure-path/dry-run?projectId=1').send({ path: [] });
    expect(emptyPathRes.status).toBe(400);
    expect(emptyPathRes.body.error).toContain('path must contain at least one segment');

    const tooDeepRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['a', 'b', 'c', 'd', 'e'] });
    expect(tooDeepRes.status).toBe(400);
    expect(tooDeepRes.body.error).toContain('limited to four levels');

    const separatorRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['a/b'] });
    expect(separatorRes.status).toBe(400);
    expect(separatorRes.body.error).toContain('must not contain path separators');
  });

  it('returns 400 for overlong ensure path detail payloads', async () => {
    const dryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Payments'], detail: 'a'.repeat(501) });
    expect(dryRunRes.status).toBe(400);
    expect(dryRunRes.body.error).toContain('detail must be 500 characters or less');

    const commitRes = await request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({ path: ['Payments'], detail: 'a'.repeat(501), operationToken: 'op_tok_bogus' });
    expect(commitRes.status).toBe(400);
    expect(commitRes.body.error).toContain('detail must be 500 characters or less');
  });

  it('commits ensure path by reusing existing folders, creating missing folders, and replaying idempotency', async () => {
    const existing = await Folder.create({ name: 'Payments', projectId: 1 });
    await Folder.create({ name: 'Payments', projectId: 2 });
    const dryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({
        path: ['Payments', 'Card failures'],
        detail: 'Card payment failure scenarios',
        idempotencyKey: 'folder-payments-card-failures',
      });
    expect(dryRunRes.status).toBe(200);

    const commitBody = {
      path: ['Payments', 'Card failures'],
      detail: 'Card payment failure scenarios',
      operationToken: dryRunRes.body.dryRun.operationToken,
      idempotencyKey: 'folder-payments-card-failures',
    };
    const commitRes = await request(app).post('/agent/folders/ensure-path/commit?projectId=1').send(commitBody);

    expect(commitRes.status).toBe(200);
    expect(commitRes.body).toMatchObject({
      path: ['Payments', 'Card failures'],
      folder: {
        name: 'Card failures',
        detail: 'Card payment failure scenarios',
        projectId: 1,
        parentFolderId: existing.id,
      },
      created: [{ name: 'Card failures', parentFolderId: existing.id }],
      reused: [{ id: existing.id, name: 'Payments', parentFolderId: null }],
    });
    expect(await Folder.count({ where: { projectId: 1 } })).toBe(2);
    expect(await Folder.count({ where: { projectId: 2 } })).toBe(1);
    expect(await IdempotencyRecord.count()).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'commit' } })).toBe(1);

    const replayRes = await request(app).post('/agent/folders/ensure-path/commit?projectId=1').send(commitBody);
    expect(replayRes.status).toBe(200);
    expect(replayRes.body).toEqual(commitRes.body);
    expect(await Folder.count({ where: { projectId: 1 } })).toBe(2);

    const retryDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({
        path: ['Payments', 'Card failures'],
        detail: 'Different detail',
        idempotencyKey: 'folder-payments-card-failures',
      });
    expect(retryDryRunRes.status).toBe(200);
    const conflictRes = await request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        ...commitBody,
        detail: 'Different detail',
        operationToken: retryDryRunRes.body.dryRun.operationToken,
      });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('serializes concurrent ensure path commits to avoid duplicate folder creation', async () => {
    const firstDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Race Folder'], idempotencyKey: 'race-folder-a' });
    const secondDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Race Folder'], idempotencyKey: 'race-folder-b' });
    expect(firstDryRunRes.status).toBe(200);
    expect(secondDryRunRes.status).toBe(200);

    let firstCreateStarted = false;
    let releaseFirstCreate;
    const firstCreateMayFinish = new Promise((resolve) => {
      releaseFirstCreate = resolve;
    });
    Folder.addHook('beforeCreate', 'holdFirstRaceFolderCreate', async (folder) => {
      if (folder.name !== 'Race Folder' || firstCreateStarted) return;

      firstCreateStarted = true;
      await firstCreateMayFinish;
    });

    const firstCommit = request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        path: ['Race Folder'],
        operationToken: firstDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'race-folder-a',
      });
    const firstCommitResult = firstCommit.then((res) => res);
    await vi.waitFor(() => {
      expect(firstCreateStarted).toBe(true);
    });

    const secondCommit = request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        path: ['Race Folder'],
        operationToken: secondDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'race-folder-b',
      });
    releaseFirstCreate();

    const [firstCommitRes, secondCommitRes] = await Promise.all([firstCommitResult, secondCommit]);

    expect(firstCommitRes.status).toBe(200);
    expect(secondCommitRes.status).toBe(200);
    expect(await Folder.count({ where: { projectId: 1, name: 'Race Folder' } })).toBe(1);
    expect([firstCommitRes.body.created.length, secondCommitRes.body.created.length].sort()).toEqual([0, 1]);
    expect([firstCommitRes.body.reused.length, secondCommitRes.body.reused.length].sort()).toEqual([0, 1]);
  });

  it('replays same-payload idempotency after waiting on the project lock with a fresh token', async () => {
    const firstDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Locked Replay'], idempotencyKey: 'locked-replay' });
    const secondDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Locked Replay'], idempotencyKey: 'locked-replay' });
    expect(firstDryRunRes.status).toBe(200);
    expect(secondDryRunRes.status).toBe(200);
    expect(firstDryRunRes.body.dryRun.operationToken).not.toBe(secondDryRunRes.body.dryRun.operationToken);

    let firstCommitAuditStarted = false;
    let idempotencyLookupCount = 0;
    let releaseFirstCommitAudit;
    const firstCommitAuditMayFinish = new Promise((resolve) => {
      releaseFirstCommitAudit = resolve;
    });
    IdempotencyRecord.addHook('beforeFind', 'countLockedReplayIdempotencyLookups', (options) => {
      if (options.where?.idempotencyKey === 'locked-replay') {
        idempotencyLookupCount += 1;
      }
    });
    AuditLog.addHook('beforeCreate', 'holdFirstLockedReplayCommitAudit', async (audit) => {
      if (audit.phase !== 'commit' || audit.operationType !== 'ensure-folder-path' || firstCommitAuditStarted) return;

      firstCommitAuditStarted = true;
      await firstCommitAuditMayFinish;
    });

    const firstCommit = request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        path: ['Locked Replay'],
        operationToken: firstDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'locked-replay',
      });
    const firstCommitResult = firstCommit.then((res) => res);
    await vi.waitFor(() => {
      expect(firstCommitAuditStarted).toBe(true);
    });

    const secondCommit = request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        path: ['Locked Replay'],
        operationToken: secondDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'locked-replay',
      });
    const secondCommitResult = secondCommit.then((res) => res);
    await vi.waitFor(() => {
      expect(idempotencyLookupCount).toBeGreaterThanOrEqual(2);
    });
    releaseFirstCommitAudit();

    const [firstCommitRes, secondCommitRes] = await Promise.all([firstCommitResult, secondCommitResult]);

    expect(firstCommitRes.status).toBe(200);
    expect(secondCommitRes.status).toBe(200);
    expect(secondCommitRes.body).toEqual(firstCommitRes.body);
    expect(await Folder.count({ where: { projectId: 1, name: 'Locked Replay' } })).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'commit' } })).toBe(1);
    expect(await IdempotencyRecord.count()).toBe(1);

    const firstToken = await OperationToken.findOne({ where: { token: firstDryRunRes.body.dryRun.operationToken } });
    const secondToken = await OperationToken.findOne({ where: { token: secondDryRunRes.body.dryRun.operationToken } });
    expect(firstToken.consumedAt).toBeTruthy();
    expect(secondToken.consumedAt).toBeNull();
  });

  it('does not replay idempotency when the operation token binding is for another project', async () => {
    const wrongProjectDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Payments'], idempotencyKey: 'wrong-project-token' });
    const replayProjectDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=2')
      .send({ path: ['Payments'], idempotencyKey: 'wrong-project-token' });
    expect(wrongProjectDryRunRes.status).toBe(200);
    expect(replayProjectDryRunRes.status).toBe(200);

    await IdempotencyRecord.create({
      userId: 7,
      operationType: 'ensure-folder-path',
      idempotencyKey: 'wrong-project-token',
      payloadHash: replayProjectDryRunRes.body.dryRun.payloadHash,
      responseStatus: 200,
      responseBody: { folder: { id: 99, projectId: 2, name: 'Payments' } },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/agent/folders/ensure-path/commit?projectId=2')
      .send({
        path: ['Payments'],
        operationToken: wrongProjectDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'wrong-project-token',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('operation_token_project_mismatch');
    expect(await Folder.count()).toBe(0);
  });

  it('validates token binding before returning a different-payload idempotency conflict', async () => {
    const originalDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Payments'], idempotencyKey: 'conflict-token-binding' });
    expect(originalDryRunRes.status).toBe(200);
    await IdempotencyRecord.create({
      userId: 7,
      operationType: 'ensure-folder-path',
      idempotencyKey: 'conflict-token-binding',
      payloadHash: originalDryRunRes.body.dryRun.payloadHash,
      responseStatus: 200,
      responseBody: { folder: { id: 1, projectId: 1, name: 'Payments' } },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        path: ['Refunds'],
        operationToken: originalDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'conflict-token-binding',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('operation_token_payload_mismatch');
    expect(await Folder.count()).toBe(0);
  });

  it('validates token binding before consumed-token retry different-payload conflict', async () => {
    const originalDryRunRes = await request(app)
      .post('/agent/folders/ensure-path/dry-run?projectId=1')
      .send({ path: ['Payments'], idempotencyKey: 'used-token-conflict' });
    expect(originalDryRunRes.status).toBe(200);
    await OperationToken.update(
      { consumedAt: new Date() },
      { where: { token: originalDryRunRes.body.dryRun.operationToken }, hooks: false }
    );
    let idempotencyLookupCount = 0;
    IdempotencyRecord.addHook('beforeFind', 'simulateConcurrentConflictingIdempotencyCommit', async () => {
      idempotencyLookupCount += 1;
      if (idempotencyLookupCount !== 2) {
        return;
      }
      await IdempotencyRecord.create({
        userId: 7,
        operationType: 'ensure-folder-path',
        idempotencyKey: 'used-token-conflict',
        payloadHash: originalDryRunRes.body.dryRun.payloadHash,
        responseStatus: 200,
        responseBody: { folder: { id: 1, projectId: 1, name: 'Payments' } },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    });

    const res = await request(app)
      .post('/agent/folders/ensure-path/commit?projectId=1')
      .send({
        path: ['Refunds'],
        operationToken: originalDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'used-token-conflict',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('operation_token_payload_mismatch');
    expect(await Folder.count()).toBe(0);
  });
});
