import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import runCaseEditRoute from './edit.js';

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

describe('POST /runcases/update stale draft handling', () => {
  let app;
  let sequelize;
  let Case;
  let Folder;
  let Run;
  let RunCase;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    Run = defineRun(sequelize, DataTypes);
    RunCase = defineRunCase(sequelize, DataTypes);

    app = express();
    app.use(express.json());
    app.use('/runcases', runCaseEditRoute(sequelize));
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function casePayload(folderId, title) {
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
    };
  }

  it('returns a conflict when saving an execution status draft for a missing Run Case', async () => {
    const folder = await Folder.create({ name: 'Checkout', projectId: 1 });
    const testCase = await Case.create(casePayload(folder.id, 'Checkout card'));
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app)
      .post('/runcases/update?runId=2')
      .send([{ id: 999, runId: 2, caseId: testCase.id, status: 2, editState: 'changed' }]);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'Run Case update conflict',
      failedRunCases: [expect.objectContaining({ id: 999, caseId: testCase.id, editState: 'changed' })],
    });
    expect(await RunCase.count()).toBe(0);
  });

  it('returns a conflict when saving a Membership removal for a missing Run Case', async () => {
    const folder = await Folder.create({ name: 'Checkout', projectId: 1 });
    const testCase = await Case.create(casePayload(folder.id, 'Checkout card'));
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app)
      .post('/runcases/update?runId=2')
      .send([{ id: 999, runId: 2, caseId: testCase.id, status: 0, editState: 'deleted' }]);

    expect(res.status).toBe(409);
    expect(res.body.failedRunCases).toEqual([expect.objectContaining({ id: 999, caseId: testCase.id, editState: 'deleted' })]);
    expect(await RunCase.count()).toBe(0);
  });

  it('returns a conflict when saving a Membership addition for a missing Test Case', async () => {
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app)
      .post('/runcases/update?runId=2')
      .send([{ id: -1, runId: 2, caseId: 999, status: 0, editState: 'new' }]);

    expect(res.status).toBe(409);
    expect(res.body.failedRunCases).toEqual([expect.objectContaining({ caseId: 999, editState: 'new' })]);
    expect(await RunCase.count()).toBe(0);
  });

  it('rejects Membership additions for Test Cases outside the Test Run project', async () => {
    const otherProjectFolder = await Folder.create({ name: 'Other project', projectId: 9 });
    const otherProjectCase = await Case.create(casePayload(otherProjectFolder.id, 'Outside project case'));
    await Run.create({ id: 2, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app)
      .post('/runcases/update?runId=2')
      .send([{ id: -1, runId: 2, caseId: otherProjectCase.id, status: 0, editState: 'new' }]);

    expect(res.status).toBe(409);
    expect(res.body.failedRunCases).toEqual([expect.objectContaining({ caseId: otherProjectCase.id, editState: 'new' })]);
    expect(await RunCase.count()).toBe(0);
  });
});
