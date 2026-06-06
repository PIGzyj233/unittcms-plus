import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCaseStep from '../../models/caseSteps.js';
import defineCaseTag from '../../models/caseTags.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import defineStep from '../../models/steps.js';
import defineTag from '../../models/tags.js';
import casesRoute from './cases.js';
import { buildCaseSearchWhere } from './cases.js';

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 7;
      next();
    },
  }),
}));

vi.mock('../../middleware/verifyVisible.js', () => ({
  default: () => ({ verifyProjectVisibleFromProjectId: (req, res, next) => next() }),
}));

describe('agent case search', () => {
  it('builds structured filters', () => {
    expect(buildCaseSearchWhere({ folderId: 3, priority: [1], type: [4] })).toEqual({
      folderId: 3,
      priority: { inValues: [1] },
      type: { inValues: [4] },
    });
  });
});

describe('agent case routes', () => {
  let app;
  let sequelize;
  let Case;
  let CaseStep;
  let CaseTag;
  let Folder;
  let Run;
  let RunCase;
  let Step;
  let Tags;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Case = defineCase(sequelize, DataTypes);
    CaseStep = defineCaseStep(sequelize, DataTypes);
    CaseTag = defineCaseTag(sequelize, DataTypes);
    Folder = defineFolder(sequelize, DataTypes);
    Run = defineRun(sequelize, DataTypes);
    RunCase = defineRunCase(sequelize, DataTypes);
    Step = defineStep(sequelize, DataTypes);
    Tags = defineTag(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');

    app = express();
    app.use(express.json());
    app.use('/agent/cases', casesRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function casePayload(folderId, overrides = {}) {
    return {
      folderId,
      title: 'Login works',
      state: 0,
      priority: 1,
      type: 4,
      automationStatus: 1,
      description: 'Open login page',
      template: 1,
      preConditions: 'User exists',
      expectedResults: 'Dashboard opens',
      ...overrides,
    };
  }

  async function createCaseGraph() {
    const projectFolder = await Folder.create({ id: 1, name: 'Project 1 root', projectId: 1 });
    const otherFolder = await Folder.create({ id: 2, name: 'Project 2 root', projectId: 2 });
    const projectCase = await Case.create(casePayload(projectFolder.id));
    const otherCase = await Case.create(casePayload(otherFolder.id, { title: 'Other project case' }));
    const step = await Step.create({ step: 'Submit credentials', result: 'Dashboard opens' });
    await CaseStep.create({ caseId: projectCase.id, stepId: step.id, stepNo: 1 });
    const smoke = await Tags.create({ id: 1, name: 'Smoke', projectId: 1 });
    await Tags.create({ id: 2, name: 'Other project tag', projectId: 2 });
    await CaseTag.create({ caseId: projectCase.id, tagId: smoke.id });
    return { otherCase, projectCase, projectFolder, smoke };
  }

  it('searches and reads only cases in the requested project', async () => {
    const { otherCase, projectCase } = await createCaseGraph();

    const searchRes = await request(app).get('/agent/cases?projectId=1');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.cases.map((testcase) => testcase.id)).toEqual([projectCase.id]);

    const readRes = await request(app).get(`/agent/cases/${otherCase.id}?projectId=1`);
    expect(readRes.status).toBe(404);
  });

  it('serializes cases with enum UIDs, tags, and ordered steps', async () => {
    const { projectCase, smoke } = await createCaseGraph();

    const res = await request(app).get(`/agent/cases/${projectCase.id}?projectId=1`);

    expect(res.status).toBe(200);
    expect(res.body.case).toMatchObject({
      id: projectCase.id,
      projectId: 1,
      priorityId: 1,
      priority: 'high',
      typeId: 4,
      type: 'functional',
      automationStatusId: 1,
      automationStatus: 'automation-not-required',
      templateId: 1,
      template: 'step',
      tags: [{ id: smoke.id, name: 'Smoke' }],
      steps: [{ stepNo: 1, step: 'Submit credentials', result: 'Dashboard opens' }],
    });
  });

  it('binds included run filtering and serialized run cases to the requested project', async () => {
    const { projectCase } = await createCaseGraph();
    const projectRun = await Run.create({ id: 1, name: 'Project run', projectId: 1, state: 0 });
    const otherRun = await Run.create({ id: 2, name: 'Other run', projectId: 2, state: 0 });
    await RunCase.create({ runId: projectRun.id, caseId: projectCase.id, status: 1 });
    await RunCase.create({ runId: otherRun.id, caseId: projectCase.id, status: 2 });

    const crossProjectSearchRes = await request(app).get('/agent/cases?projectId=1&includedInRunId=2');
    expect(crossProjectSearchRes.status).toBe(200);
    expect(crossProjectSearchRes.body.cases).toEqual([]);

    const projectSearchRes = await request(app).get('/agent/cases?projectId=1&includedInRunId=1');
    expect(projectSearchRes.status).toBe(200);
    expect(projectSearchRes.body.cases.map((testcase) => testcase.id)).toEqual([projectCase.id]);

    const readRes = await request(app).get(`/agent/cases/${projectCase.id}?projectId=1`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.case.runCases).toEqual([{ id: 1, runId: projectRun.id, statusId: 1, status: 'passed' }]);
  });

  it('returns 400 for repeated scalar keyword params', async () => {
    await createCaseGraph();

    const res = await request(app).get('/agent/cases?projectId=1&keyword=login&keyword=checkout');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('keyword must be provided once');
  });

  it('deduplicates tag IDs before requiring all supplied tags', async () => {
    const { projectCase } = await createCaseGraph();

    const res = await request(app).get('/agent/cases?projectId=1&tagIds=1,1');

    expect(res.status).toBe(200);
    expect(res.body.cases.map((testcase) => testcase.id)).toEqual([projectCase.id]);
  });

  it('does not serialize cross-project tag associations', async () => {
    const { projectCase, smoke } = await createCaseGraph();
    await CaseTag.create({ caseId: projectCase.id, tagId: 2 });

    const readRes = await request(app).get(`/agent/cases/${projectCase.id}?projectId=1`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.case.tags).toEqual([{ id: smoke.id, name: 'Smoke' }]);

    const searchRes = await request(app).get('/agent/cases?projectId=1');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.cases[0].tags).toEqual([{ id: smoke.id, name: 'Smoke' }]);
  });

  it('does not match project cases when tagIds belong to another project', async () => {
    const { projectCase } = await createCaseGraph();
    await CaseTag.create({ caseId: projectCase.id, tagId: 2 });

    const res = await request(app).get('/agent/cases?projectId=1&tagIds=2');

    expect(res.status).toBe(200);
    expect(res.body.cases).toEqual([]);
  });
});
