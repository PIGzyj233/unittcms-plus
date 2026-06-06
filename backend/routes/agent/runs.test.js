import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineAgentAuditLog from '../../models/agentAuditLogs.js';
import defineAgentIdempotencyRecord from '../../models/agentIdempotencyRecords.js';
import defineAgentOperationToken from '../../models/agentOperationTokens.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import { addCasesToRun, buildCreateRunPayload, defaultRunCaseStatus } from './lib/runs.js';
import runsRoute from './runs.js';

const middlewareCalls = vi.hoisted(() => ({ editable: [] }));

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 7;
      next();
    },
  }),
}));

vi.mock('../../middleware/verifyEditable.js', () => ({
  default: () => ({
    verifyProjectDeveloperFromProjectId: (req, res, next) => {
      middlewareCalls.editable.push('developer');
      next();
    },
    verifyProjectReporterFromProjectId: (req, res, next) => {
      middlewareCalls.editable.push('reporter');
      next();
    },
  }),
}));

describe('agent run payloads', () => {
  it('defaults run state and removes duplicate case ids', () => {
    expect(buildCreateRunPayload({ name: 'Smoke', caseIds: [1, 1, 2] })).toEqual({
      name: 'Smoke',
      configurations: '',
      description: '',
      state: 'new',
      caseIds: [1, 2],
      allowPartial: false,
    });
  });
});

describe('agent run routes', () => {
  let app;
  let sequelize;
  let Folder;
  let Case;
  let Run;
  let RunCase;
  let OperationToken;
  let IdempotencyRecord;
  let AuditLog;

  beforeEach(async () => {
    middlewareCalls.editable = [];
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    Run = defineRun(sequelize, DataTypes);
    RunCase = defineRunCase(sequelize, DataTypes);
    OperationToken = defineAgentOperationToken(sequelize, DataTypes);
    IdempotencyRecord = defineAgentIdempotencyRecord(sequelize, DataTypes);
    AuditLog = defineAgentAuditLog(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.getQueryInterface().addIndex(RunCase.getTableName(), ['runId', 'caseId'], { unique: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');

    app = express();
    app.use(express.json());
    app.use('/agent/runs', runsRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function casePayload(folderId, overrides = {}) {
    return {
      folderId,
      title: 'Formal case',
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

  it('uses reporter-or-higher project permissions for run writes', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const testcase = await Case.create(casePayload(folder.id));

    const res = await request(app)
      .post('/agent/runs/dry-run?projectId=1')
      .send({
        name: 'Smoke',
        caseIds: [testcase.id],
      });

    expect(res.status).toBe(200);
    expect(middlewareCalls.editable).toEqual(['reporter']);
  });

  it('dry-runs and commits run creation with project-scoped formal cases and idempotency replay', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const otherFolder = await Folder.create({ name: 'Project 2', projectId: 2 });
    const firstCase = await Case.create(casePayload(folder.id, { title: 'Login works' }));
    const secondCase = await Case.create(casePayload(folder.id, { title: 'Logout works' }));
    await Case.create(casePayload(otherFolder.id, { title: 'Other project' }));

    const dryRunRes = await request(app)
      .post('/agent/runs/dry-run?projectId=1')
      .send({
        name: 'Smoke',
        caseIds: [firstCase.id, firstCase.id, secondCase.id],
        idempotencyKey: 'create-smoke-run',
      });

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.dryRun).toMatchObject({
      payloadHash: expect.stringMatching(/^sha256:/),
      summary: {
        operationType: 'create-run-with-cases',
        projectId: 1,
        name: 'Smoke',
        state: 'new',
        caseIds: [firstCase.id, secondCase.id],
      },
      warnings: [],
    });
    expect(dryRunRes.body.dryRun.operationToken).toMatch(/^op_tok_/);
    expect(await Run.count()).toBe(0);
    expect(await OperationToken.count()).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'dry-run' } })).toBe(1);

    const commitBody = {
      name: 'Smoke',
      caseIds: [firstCase.id, firstCase.id, secondCase.id],
      operationToken: dryRunRes.body.dryRun.operationToken,
      idempotencyKey: 'create-smoke-run',
    };
    const commitRes = await request(app).post('/agent/runs/commit?projectId=1').send(commitBody);

    expect(commitRes.status).toBe(200);
    expect(commitRes.body).toMatchObject({
      operationType: 'create-run-with-cases',
      projectId: 1,
      runId: expect.any(Number),
      caseIds: [firstCase.id, secondCase.id],
    });
    expect(await Run.count({ where: { projectId: 1 } })).toBe(1);
    expect(await RunCase.count()).toBe(2);
    expect(await IdempotencyRecord.count()).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'commit' } })).toBe(1);

    const replayRes = await request(app).post('/agent/runs/commit?projectId=1').send(commitBody);
    expect(replayRes.status).toBe(200);
    expect(replayRes.body).toEqual(commitRes.body);
    expect(await Run.count({ where: { projectId: 1 } })).toBe(1);
    expect(await RunCase.count()).toBe(2);
  });

  it('rejects create-run cases outside the requested project even with allowPartial', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const otherFolder = await Folder.create({ name: 'Project 2', projectId: 2 });
    const validCase = await Case.create(casePayload(folder.id, { title: 'Valid' }));
    const foreignCase = await Case.create(casePayload(otherFolder.id, { title: 'Foreign' }));

    const res = await request(app)
      .post('/agent/runs/dry-run?projectId=1')
      .send({ name: 'Smoke', caseIds: [validCase.id, foreignCase.id], allowPartial: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('All caseIds must reference formal cases in the requested project');
    expect(await OperationToken.count()).toBe(0);
  });

  it('adds cases to an existing run while reusing duplicate run-case rows', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const firstCase = await Case.create(casePayload(folder.id, { title: 'Existing run case' }));
    const secondCase = await Case.create(casePayload(folder.id, { title: 'New run case' }));
    const run = await Run.create({ name: 'Smoke', configurations: '', description: '', state: 0, projectId: 1 });
    await RunCase.create({ runId: run.id, caseId: firstCase.id, status: 0 });

    const dryRunRes = await request(app)
      .post(`/agent/runs/${run.id}/cases/dry-run?projectId=1`)
      .send({ caseIds: [firstCase.id, secondCase.id, secondCase.id], idempotencyKey: 'add-cases' });

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.dryRun.summary).toMatchObject({
      operationType: 'add-cases-to-run',
      projectId: 1,
      runId: run.id,
      addedCaseIds: [secondCase.id],
      reusedCaseIds: [firstCase.id],
    });

    const commitRes = await request(app)
      .post(`/agent/runs/${run.id}/cases/commit?projectId=1`)
      .send({
        caseIds: [firstCase.id, secondCase.id, secondCase.id],
        operationToken: dryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'add-cases',
      });

    expect(commitRes.status).toBe(200);
    expect(commitRes.body).toMatchObject({
      operationType: 'add-cases-to-run',
      projectId: 1,
      runId: run.id,
      addedCaseIds: [secondCase.id],
      reusedCaseIds: [firstCase.id],
    });
    expect(await RunCase.count({ where: { runId: run.id, caseId: firstCase.id } })).toBe(1);
    expect(await RunCase.count({ where: { runId: run.id, caseId: secondCase.id } })).toBe(1);
  });

  it('reports run cases that appear after planning as reused', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const testcase = await Case.create(casePayload(folder.id, { title: 'Late duplicate' }));
    const run = await Run.create({ name: 'Smoke', configurations: '', description: '', state: 0, projectId: 1 });
    let insertedLateDuplicate = false;
    RunCase.addHook('beforeCreate', 'insertLateDuplicateRunCase', async (row, options) => {
      if (insertedLateDuplicate || row.caseId !== testcase.id) return;

      insertedLateDuplicate = true;
      await RunCase.create(
        { runId: run.id, caseId: testcase.id, status: defaultRunCaseStatus() },
        { hooks: false, transaction: options.transaction }
      );
    });

    const result = await addCasesToRun(sequelize, {
      projectId: 1,
      runId: run.id,
      payload: { caseIds: [testcase.id], allowPartial: false },
    });

    expect(result.addedCaseIds).toEqual([]);
    expect(result.reusedCaseIds).toEqual([testcase.id]);
    expect(await RunCase.count({ where: { runId: run.id, caseId: testcase.id } })).toBe(1);
  });

  it('serializes add-cases commits so a fresh competing token reports reused cases accurately', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const testcase = await Case.create(casePayload(folder.id, { title: 'Race case' }));
    const run = await Run.create({ name: 'Smoke', configurations: '', description: '', state: 0, projectId: 1 });
    const firstDryRunRes = await request(app)
      .post(`/agent/runs/${run.id}/cases/dry-run?projectId=1`)
      .send({ caseIds: [testcase.id], idempotencyKey: 'add-race-a' });
    const secondDryRunRes = await request(app)
      .post(`/agent/runs/${run.id}/cases/dry-run?projectId=1`)
      .send({ caseIds: [testcase.id], idempotencyKey: 'add-race-b' });
    expect(firstDryRunRes.status).toBe(200);
    expect(secondDryRunRes.status).toBe(200);

    let firstCreateStarted = false;
    let releaseFirstCreate;
    const firstCreateMayFinish = new Promise((resolve) => {
      releaseFirstCreate = resolve;
    });
    RunCase.addHook('beforeCreate', 'holdFirstAddCasesCreate', async (row) => {
      if (firstCreateStarted || row.caseId !== testcase.id) return;

      firstCreateStarted = true;
      await firstCreateMayFinish;
    });

    const firstCommit = request(app)
      .post(`/agent/runs/${run.id}/cases/commit?projectId=1`)
      .send({
        caseIds: [testcase.id],
        operationToken: firstDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'add-race-a',
      });
    const firstCommitResult = firstCommit.then((res) => res);
    await vi.waitFor(() => {
      expect(firstCreateStarted).toBe(true);
    });

    const secondCommit = request(app)
      .post(`/agent/runs/${run.id}/cases/commit?projectId=1`)
      .send({
        caseIds: [testcase.id],
        operationToken: secondDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'add-race-b',
      });
    releaseFirstCreate();

    const [firstCommitRes, secondCommitRes] = await Promise.all([firstCommitResult, secondCommit]);

    expect(firstCommitRes.status).toBe(200);
    expect(secondCommitRes.status).toBe(200);
    expect(firstCommitRes.body.addedCaseIds).toEqual([testcase.id]);
    expect(secondCommitRes.body.addedCaseIds).toEqual([]);
    expect(secondCommitRes.body.reusedCaseIds).toEqual([testcase.id]);
    expect(await RunCase.count({ where: { runId: run.id, caseId: testcase.id } })).toBe(1);
    const secondAudit = await AuditLog.findOne({
      where: { operationType: 'add-cases-to-run', idempotencyKey: 'add-race-b', phase: 'commit' },
    });
    expect(secondAudit.resultSummary.addedCaseIds).toEqual([]);
    expect(secondAudit.resultSummary.reusedCaseIds).toEqual([testcase.id]);
  });

  it('rejects create-run commits without an operation token', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const testcase = await Case.create(casePayload(folder.id));

    const res = await request(app)
      .post('/agent/runs/commit?projectId=1')
      .send({
        name: 'Smoke',
        caseIds: [testcase.id],
        idempotencyKey: 'missing-create-token',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'operationToken is required', code: 'OPERATION_TOKEN_REQUIRED' });
    expect(await Run.count()).toBe(0);
  });

  it('rejects add-cases commits without an operation token', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const testcase = await Case.create(casePayload(folder.id));
    const run = await Run.create({ name: 'Smoke', configurations: '', description: '', state: 0, projectId: 1 });

    const res = await request(app)
      .post(`/agent/runs/${run.id}/cases/commit?projectId=1`)
      .send({
        caseIds: [testcase.id],
        idempotencyKey: 'missing-add-token',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'operationToken is required', code: 'OPERATION_TOKEN_REQUIRED' });
    expect(await RunCase.count()).toBe(0);
  });

  it('validates token binding before returning run idempotency replay', async () => {
    const folder = await Folder.create({ name: 'Project 1', projectId: 1 });
    const testcase = await Case.create(casePayload(folder.id));
    const wrongProjectDryRunRes = await request(app)
      .post('/agent/runs/dry-run?projectId=1')
      .send({ name: 'Smoke', caseIds: [testcase.id], idempotencyKey: 'wrong-project-run-token' });
    expect(wrongProjectDryRunRes.status).toBe(200);

    await IdempotencyRecord.create({
      userId: 7,
      operationType: 'create-run-with-cases',
      idempotencyKey: 'wrong-project-run-token',
      payloadHash: wrongProjectDryRunRes.body.dryRun.payloadHash,
      responseStatus: 200,
      responseBody: { operationType: 'create-run-with-cases', projectId: 2, runId: 99, caseIds: [testcase.id] },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/agent/runs/commit?projectId=2')
      .send({
        name: 'Smoke',
        caseIds: [testcase.id],
        operationToken: wrongProjectDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'wrong-project-run-token',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('operation_token_project_mismatch');
    expect(await Run.count()).toBe(0);
  });
});
