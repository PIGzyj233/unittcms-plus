import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineAgentAuditLog from '../../models/agentAuditLogs.js';
import defineAgentCaseCandidate from '../../models/agentCaseCandidates.js';
import defineAgentIdempotencyRecord from '../../models/agentIdempotencyRecords.js';
import defineAgentOperationToken from '../../models/agentOperationTokens.js';
import defineCase from '../../models/cases.js';
import defineCaseStep from '../../models/caseSteps.js';
import defineCaseTag from '../../models/caseTags.js';
import defineFolder from '../../models/folders.js';
import defineStep from '../../models/steps.js';
import defineTag from '../../models/tags.js';
import caseCandidatesRoute from './caseCandidates.js';
import { acceptCandidates, acceptOperationType, buildAcceptPayload } from './lib/candidates.js';

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

describe('candidate accept planning', () => {
  it('uses stable operation type and defaults', () => {
    expect(acceptOperationType).toBe('accept-candidates');
    expect(buildAcceptPayload({ candidateIds: [2], createMissingTags: undefined, allowPartial: undefined })).toEqual({
      candidateIds: [2],
      createMissingTags: false,
      allowPartial: false,
    });
  });
});

describe('candidate accept transactions', () => {
  let app;
  let sequelize;
  let Candidate;
  let Case;
  let Step;
  let CaseStep;
  let CaseTag;
  let Folder;
  let Tags;
  let OperationToken;
  let IdempotencyRecord;
  let AuditLog;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    Step = defineStep(sequelize, DataTypes);
    CaseStep = defineCaseStep(sequelize, DataTypes);
    CaseTag = defineCaseTag(sequelize, DataTypes);
    Folder = defineFolder(sequelize, DataTypes);
    Tags = defineTag(sequelize, DataTypes);
    OperationToken = defineAgentOperationToken(sequelize, DataTypes);
    IdempotencyRecord = defineAgentIdempotencyRecord(sequelize, DataTypes);
    AuditLog = defineAgentAuditLog(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');

    await Folder.bulkCreate([
      { id: 1, name: 'Project 1 root', projectId: 1 },
      { id: 2, name: 'Project 2 root', projectId: 2 },
    ]);
    await Tags.bulkCreate([
      { id: 1, name: 'Smoke', projectId: 1 },
      { id: 2, name: 'Regression', projectId: 1 },
      { id: 3, name: 'Other project', projectId: 2 },
    ]);

    app = express();
    app.use(express.json());
    app.use('/agent/case-candidates', caseCandidatesRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function candidatePayload(overrides = {}) {
    return {
      projectId: 1,
      folderId: 1,
      title: 'Login works',
      normalizedTitle: 'login works',
      description: 'Open the login page',
      preConditions: 'User exists',
      expectedResults: 'User can sign in',
      priority: 1,
      type: 4,
      automationStatus: 1,
      template: 1,
      steps: [{ step: 'Submit valid credentials', result: 'Dashboard opens' }],
      tagIds: [1],
      suggestedTags: ['Agent suggested'],
      source: 'agent',
      rationale: '',
      duplicateMetadata: { blocked: false, warnings: [] },
      status: 'draft',
      duplicateAllowed: false,
      creatorUserId: 7,
      ...overrides,
    };
  }

  it('creates the formal case graph and marks a draft candidate accepted', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const result = await acceptCandidates(sequelize, {
      projectId: 1,
      userId: 7,
      candidateIds: [candidate.id],
      createMissingTags: true,
    });

    expect(result).toEqual({ accepted: [{ candidateId: candidate.id, caseId: 1 }], failed: [] });
    await candidate.reload();
    expect(candidate.status).toBe('accepted');
    expect(candidate.reviewerUserId).toBe(7);
    expect(candidate.acceptedCaseId).toBe(1);
    expect(candidate.reviewedAt).toBeTruthy();

    const formalCase = await Case.findByPk(candidate.acceptedCaseId);
    expect(formalCase).toMatchObject({
      folderId: 1,
      title: 'Login works',
      state: 0,
      priority: 1,
      type: 4,
      automationStatus: 1,
      description: 'Open the login page',
      template: 1,
      preConditions: 'User exists',
      expectedResults: 'User can sign in',
    });
    expect(await Step.count()).toBe(1);
    expect(await CaseStep.findOne()).toMatchObject({ caseId: formalCase.id, stepId: 1, stepNo: 1 });
    expect((await Tags.findOne({ where: { name: 'Agent suggested', projectId: 1 } })).id).toBe(4);
    expect((await CaseTag.findAll({ order: [['tagId', 'ASC']] })).map((tag) => tag.tagId)).toEqual([1, 4]);
  });

  it('rolls back all candidates when all-or-nothing accept fails', async () => {
    const draft = await Candidate.create(candidatePayload({ title: 'Draft', normalizedTitle: 'draft' }));
    const rejected = await Candidate.create(
      candidatePayload({ title: 'Rejected', normalizedTitle: 'rejected', status: 'rejected' })
    );

    await expect(
      acceptCandidates(sequelize, { projectId: 1, userId: 7, candidateIds: [draft.id, rejected.id] })
    ).rejects.toThrow(`Candidate ${rejected.id} is not draft`);

    await draft.reload();
    await rejected.reload();
    expect(draft.status).toBe('draft');
    expect(rejected.status).toBe('rejected');
    expect(await Case.count()).toBe(0);
    expect(await Step.count()).toBe(0);
    expect(await CaseTag.count()).toBe(0);
  });

  it('commits with operation tokens and replays matching idempotency keys', async () => {
    const candidate = await Candidate.create(candidatePayload());
    const dryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'accept-once' });
    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.dryRun.summary).toEqual({
      operationType: 'accept-candidates',
      projectId: 1,
      affectedResourceIds: [candidate.id],
    });
    expect(await OperationToken.count()).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'dry-run' } })).toBe(1);

    const commitBody = {
      candidateIds: [candidate.id],
      operationToken: dryRunRes.body.dryRun.operationToken,
      idempotencyKey: 'accept-once',
    };
    const commitRes = await request(app).post('/agent/case-candidates/accept/commit?projectId=1').send(commitBody);
    expect(commitRes.status).toBe(200);
    expect(commitRes.body).toEqual({ accepted: [{ candidateId: candidate.id, caseId: 1 }], failed: [] });
    expect(await Case.count()).toBe(1);
    expect(await IdempotencyRecord.count()).toBe(1);

    const replayRes = await request(app).post('/agent/case-candidates/accept/commit?projectId=1').send(commitBody);
    expect(replayRes.status).toBe(200);
    expect(replayRes.body).toEqual(commitRes.body);
    expect(await Case.count()).toBe(1);

    const retryDryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'accept-once' });
    expect(retryDryRunRes.status).toBe(200);
    const freshReplayRes = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({ ...commitBody, operationToken: retryDryRunRes.body.dryRun.operationToken });
    expect(freshReplayRes.status).toBe(200);
    expect(freshReplayRes.body).toEqual(commitRes.body);
    expect(await Case.count()).toBe(1);

    const conflictRes = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({ ...commitBody, operationToken: retryDryRunRes.body.dryRun.operationToken, allowPartial: true });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('replays idempotency when a concurrent commit consumes the token after precheck', async () => {
    const candidate = await Candidate.create(candidatePayload());
    const dryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'race-replay' });
    expect(dryRunRes.status).toBe(200);
    const storedResponse = { accepted: [{ candidateId: candidate.id, caseId: 88 }], failed: [] };
    await OperationToken.update(
      { consumedAt: new Date() },
      { where: { token: dryRunRes.body.dryRun.operationToken }, hooks: false }
    );
    let idempotencyLookupCount = 0;
    IdempotencyRecord.addHook('beforeFind', 'simulateConcurrentIdempotencyCommit', async () => {
      idempotencyLookupCount += 1;
      if (idempotencyLookupCount !== 2) {
        return;
      }
      await IdempotencyRecord.create({
        userId: 7,
        operationType: 'accept-candidates',
        idempotencyKey: 'race-replay',
        payloadHash: dryRunRes.body.dryRun.payloadHash,
        responseStatus: 200,
        responseBody: storedResponse,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    });

    const res = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({
        candidateIds: [candidate.id],
        operationToken: dryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'race-replay',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(storedResponse);
    expect(await Case.count()).toBe(0);
  });

  it('does not replay idempotency when the operation token binding is for another project', async () => {
    const candidate = await Candidate.create(candidatePayload());
    const wrongProjectDryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'wrong-project-token' });
    const replayProjectDryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=2')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'wrong-project-token' });
    expect(wrongProjectDryRunRes.status).toBe(200);
    expect(replayProjectDryRunRes.status).toBe(200);

    await IdempotencyRecord.create({
      userId: 7,
      operationType: 'accept-candidates',
      idempotencyKey: 'wrong-project-token',
      payloadHash: replayProjectDryRunRes.body.dryRun.payloadHash,
      responseStatus: 200,
      responseBody: { accepted: [{ candidateId: candidate.id, caseId: 99 }], failed: [] },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await OperationToken.update(
      { consumedAt: new Date() },
      { where: { token: wrongProjectDryRunRes.body.dryRun.operationToken } }
    );

    const res = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=2')
      .send({
        candidateIds: [candidate.id],
        operationToken: wrongProjectDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'wrong-project-token',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('operation_token_project_mismatch');
    expect(await Case.count()).toBe(0);
  });

  it('rolls back all-or-nothing accept when commit audit fails', async () => {
    const candidate = await Candidate.create(candidatePayload());
    const dryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'audit-fail' });
    expect(dryRunRes.status).toBe(200);

    AuditLog.addHook('beforeCreate', 'failCommitAudit', (audit) => {
      if (audit.phase === 'commit') {
        throw new Error('audit failed');
      }
    });

    const res = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({
        candidateIds: [candidate.id],
        operationToken: dryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'audit-fail',
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('audit failed');
    await candidate.reload();
    expect(candidate.status).toBe('draft');
    expect(candidate.acceptedCaseId).toBeNull();
    expect(await Case.count()).toBe(0);
    expect(await Step.count()).toBe(0);
    expect(await IdempotencyRecord.count()).toBe(0);
  });

  it('commits partial accept results with accepted and failed candidates', async () => {
    const valid = await Candidate.create(
      candidatePayload({ title: 'Valid partial', normalizedTitle: 'valid partial' })
    );
    const rejected = await Candidate.create(
      candidatePayload({ title: 'Rejected partial', normalizedTitle: 'rejected partial', status: 'rejected' })
    );
    const dryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [valid.id, rejected.id], allowPartial: true, idempotencyKey: 'partial-success' });
    expect(dryRunRes.status).toBe(200);

    const res = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({
        candidateIds: [valid.id, rejected.id],
        allowPartial: true,
        operationToken: dryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'partial-success',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accepted: [{ candidateId: valid.id, caseId: 1 }],
      failed: [{ candidateId: rejected.id, error: `Candidate ${rejected.id} is not draft` }],
    });
    await valid.reload();
    await rejected.reload();
    expect(valid.status).toBe('accepted');
    expect(rejected.status).toBe('rejected');
    expect(await Case.count()).toBe(1);
    expect(await IdempotencyRecord.count()).toBe(1);
    expect(await AuditLog.count({ where: { phase: 'commit' } })).toBe(1);
  });

  it('rolls back partial accept mutations when commit audit fails', async () => {
    const valid = await Candidate.create(
      candidatePayload({ title: 'Valid partial rollback', normalizedTitle: 'valid partial rollback' })
    );
    const rejected = await Candidate.create(
      candidatePayload({
        title: 'Rejected partial rollback',
        normalizedTitle: 'rejected partial rollback',
        status: 'rejected',
      })
    );
    const dryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [valid.id, rejected.id], allowPartial: true, idempotencyKey: 'partial-audit-fail' });
    expect(dryRunRes.status).toBe(200);

    AuditLog.addHook('beforeCreate', 'failPartialCommitAudit', (audit) => {
      if (audit.phase === 'commit') {
        throw new Error('partial audit failed');
      }
    });

    const res = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({
        candidateIds: [valid.id, rejected.id],
        allowPartial: true,
        operationToken: dryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'partial-audit-fail',
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('partial audit failed');
    await valid.reload();
    await rejected.reload();
    expect(valid.status).toBe('draft');
    expect(valid.acceptedCaseId).toBeNull();
    expect(rejected.status).toBe('rejected');
    expect(await Case.count()).toBe(0);
    expect(await Step.count()).toBe(0);
    expect(await IdempotencyRecord.count()).toBe(0);
    expect(
      (await OperationToken.findOne({ where: { token: dryRunRes.body.dryRun.operationToken } })).consumedAt
    ).toBeNull();
  });

  it('rejects candidates whose stored folder belongs to another project', async () => {
    const candidate = await Candidate.create(candidatePayload({ folderId: 2 }));

    await expect(
      acceptCandidates(sequelize, { projectId: 1, userId: 7, candidateIds: [candidate.id] })
    ).rejects.toThrow('Candidate folder must belong to projectId');
    await candidate.reload();
    expect(candidate.status).toBe('draft');
    expect(await Case.count()).toBe(0);
  });

  it('rejects candidates whose stored tags belong to another project', async () => {
    const candidate = await Candidate.create(candidatePayload({ tagIds: [3] }));

    await expect(
      acceptCandidates(sequelize, { projectId: 1, userId: 7, candidateIds: [candidate.id] })
    ).rejects.toThrow('Candidate tagIds must belong to projectId');
    await candidate.reload();
    expect(candidate.status).toBe('draft');
    expect(await Case.count()).toBe(0);
    expect(await CaseTag.count()).toBe(0);
  });

  it('binds accept payload hashes to the requested project', async () => {
    const candidate = await Candidate.create(candidatePayload());
    const firstDryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=1')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'same-key' });
    const secondDryRunRes = await request(app)
      .post('/agent/case-candidates/accept/dry-run?projectId=2')
      .send({ candidateIds: [candidate.id], idempotencyKey: 'same-key' });
    expect(firstDryRunRes.status).toBe(200);
    expect(secondDryRunRes.status).toBe(200);
    expect(secondDryRunRes.body.dryRun.summary).toEqual({
      operationType: 'accept-candidates',
      projectId: 2,
      affectedResourceIds: [candidate.id],
    });
    expect(secondDryRunRes.body.dryRun.payloadHash).not.toBe(firstDryRunRes.body.dryRun.payloadHash);

    const commitRes = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=1')
      .send({
        candidateIds: [candidate.id],
        operationToken: firstDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'same-key',
      });
    expect(commitRes.status).toBe(200);

    const crossProjectReplayRes = await request(app)
      .post('/agent/case-candidates/accept/commit?projectId=2')
      .send({
        candidateIds: [candidate.id],
        operationToken: secondDryRunRes.body.dryRun.operationToken,
        idempotencyKey: 'same-key',
      });
    expect(crossProjectReplayRes.status).toBe(409);
    expect(crossProjectReplayRes.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await Case.count()).toBe(1);
  });
});
