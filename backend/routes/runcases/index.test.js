import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCaseTag from '../../models/caseTags.js';
import defineCase from '../../models/cases.js';
import defineComment from '../../models/comments.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import defineTag from '../../models/tags.js';
import runCaseIndexRoute from './index.js';

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 7;
      next();
    },
  }),
}));

vi.mock('../../middleware/verifyVisible.js', () => ({
  default: () => ({
    verifyProjectVisibleFromRunId: (req, res, next) => next(),
  }),
}));

describe('GET /runcases saved Run Case list', () => {
  let app;
  let sequelize;
  let Case;
  let CaseTag;
  let Comment;
  let Folder;
  let Run;
  let RunCase;
  let Tags;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    Run = defineRun(sequelize, DataTypes);
    RunCase = defineRunCase(sequelize, DataTypes);
    Tags = defineTag(sequelize, DataTypes);
    CaseTag = defineCaseTag(sequelize, DataTypes);
    Comment = defineComment(sequelize, DataTypes);

    app = express();
    app.use(express.json());
    app.use('/runcases', runCaseIndexRoute(sequelize));
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function casePayload(folderId, title, overrides = {}) {
    return {
      folderId,
      title,
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

  it('returns only saved Run Cases with Test Case context for execution', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const savedCase = await Case.create(casePayload(child.id, 'Mobile login'));
    const candidateOnlyCase = await Case.create(casePayload(parent.id, 'Candidate only'));
    const tag = await Tags.create({ name: 'smoke', projectId: 1 });
    await CaseTag.create({ caseId: savedCase.id, tagId: tag.id });
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });
    const runCase = await RunCase.create({ runId: 2, caseId: savedCase.id, status: 1 });
    await Comment.create({ commentableType: 'RunCase', commentableId: runCase.id, content: 'looks good' });

    const res = await request(app).get('/runcases?runId=2');

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.caseId)).toEqual([savedCase.id]);
    expect(res.body.map((item) => item.caseId)).not.toContain(candidateOnlyCase.id);
    expect(res.body).toEqual([
      expect.objectContaining({
        id: runCase.id,
        runId: 2,
        caseId: savedCase.id,
        status: 1,
        commentCount: 1,
        Case: expect.objectContaining({
          id: savedCase.id,
          title: 'Mobile login',
          priority: 1,
          type: 4,
          folderPath: ['Login', 'Mobile'],
          Tags: [expect.objectContaining({ id: tag.id, name: 'smoke' })],
        }),
      }),
    ]);
  });

  it('filters saved Run Cases by execution search, Run Case Status, tags, priority, and type', async () => {
    const folder = await Folder.create({ name: 'Checkout', projectId: 1 });
    const smoke = await Tags.create({ name: 'smoke', projectId: 1 });
    const regression = await Tags.create({ name: 'regression', projectId: 1 });
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });

    const matchingCase = await Case.create(casePayload(folder.id, 'Checkout refund path', { priority: 2, type: 4 }));
    const wrongSearchCase = await Case.create(casePayload(folder.id, 'Profile update', { priority: 2, type: 4 }));
    const wrongStatusCase = await Case.create(casePayload(folder.id, 'Checkout card path', { priority: 2, type: 4 }));
    const wrongTagCase = await Case.create(casePayload(folder.id, 'Checkout wallet path', { priority: 2, type: 4 }));
    const wrongPriorityCase = await Case.create(casePayload(folder.id, 'Checkout coupon path', { priority: 1, type: 4 }));
    const wrongTypeCase = await Case.create(casePayload(folder.id, 'Checkout guest path', { priority: 2, type: 5 }));

    await CaseTag.create({ caseId: matchingCase.id, tagId: smoke.id });
    await CaseTag.create({ caseId: wrongSearchCase.id, tagId: smoke.id });
    await CaseTag.create({ caseId: wrongStatusCase.id, tagId: smoke.id });
    await CaseTag.create({ caseId: wrongTagCase.id, tagId: regression.id });
    await CaseTag.create({ caseId: wrongPriorityCase.id, tagId: smoke.id });
    await CaseTag.create({ caseId: wrongTypeCase.id, tagId: smoke.id });

    await RunCase.create({ runId: 2, caseId: matchingCase.id, status: 1 });
    await RunCase.create({ runId: 2, caseId: wrongSearchCase.id, status: 1 });
    await RunCase.create({ runId: 2, caseId: wrongStatusCase.id, status: 2 });
    await RunCase.create({ runId: 2, caseId: wrongTagCase.id, status: 1 });
    await RunCase.create({ runId: 2, caseId: wrongPriorityCase.id, status: 1 });
    await RunCase.create({ runId: 2, caseId: wrongTypeCase.id, status: 1 });

    const res = await request(app).get(
      `/runcases?runId=2&search=checkout&status=1&tag=${smoke.id}&priority=2&type=4`
    );

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.caseId)).toEqual([matchingCase.id]);
  });

  it('filters saved Run Cases by optional execution Folder Scope with Include Subfolders on by default', async () => {
    const parent = await Folder.create({ name: 'Checkout', projectId: 1 });
    const child = await Folder.create({ name: 'Cards', projectId: 1, parentFolderId: parent.id });
    const sibling = await Folder.create({ name: 'Profile', projectId: 1 });
    const parentCase = await Case.create(casePayload(parent.id, 'Checkout summary'));
    const childCase = await Case.create(casePayload(child.id, 'Checkout card'));
    const siblingCase = await Case.create(casePayload(sibling.id, 'Profile avatar'));
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });
    await RunCase.create({ runId: 2, caseId: parentCase.id, status: 0 });
    await RunCase.create({ runId: 2, caseId: childCase.id, status: 0 });
    await RunCase.create({ runId: 2, caseId: siblingCase.id, status: 0 });

    const res = await request(app).get(`/runcases?runId=2&folderId=${parent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.caseId)).toEqual([parentCase.id, childCase.id]);
    expect(res.body.map((item) => item.Case.folderPath)).toEqual([
      ['Checkout'],
      ['Checkout', 'Cards'],
    ]);
  });

  it('narrows execution Folder Scope to directly placed saved Run Cases when Include Subfolders is false', async () => {
    const parent = await Folder.create({ name: 'Checkout', projectId: 1 });
    const child = await Folder.create({ name: 'Cards', projectId: 1, parentFolderId: parent.id });
    const parentCase = await Case.create(casePayload(parent.id, 'Checkout summary'));
    const childCase = await Case.create(casePayload(child.id, 'Checkout card'));
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });
    await RunCase.create({ runId: 2, caseId: parentCase.id, status: 0 });
    await RunCase.create({ runId: 2, caseId: childCase.id, status: 0 });

    const res = await request(app).get(`/runcases?runId=2&folderId=${parent.id}&includeSubfolders=false`);

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.caseId)).toEqual([parentCase.id]);
  });

  it('rejects execution Folder Scope filters outside the Test Run project', async () => {
    const runFolder = await Folder.create({ name: 'Checkout', projectId: 1 });
    const otherProjectFolder = await Folder.create({ name: 'Other project', projectId: 9 });
    const savedCase = await Case.create(casePayload(runFolder.id, 'Checkout summary'));
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });
    await RunCase.create({ runId: 2, caseId: savedCase.id, status: 0 });

    const res = await request(app).get(`/runcases?runId=2&folderId=${otherProjectFolder.id}`);

    expect(res.status).toBe(400);
    expect(res.text).toContain('folderId must belong to projectId');
  });
});
