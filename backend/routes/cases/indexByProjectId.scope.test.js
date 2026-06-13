import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCase from '../../models/cases.js';
import defineComment from '../../models/comments.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import indexByProjectIdRoute from './indexByProjectId.js';

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
    verifyProjectVisibleFromProjectId: (req, res, next) => next(),
    verifyProjectVisibleFromRunId: (req, res, next) => next(),
  }),
}));

describe('GET /cases/byproject Folder Path', () => {
  let app;
  let sequelize;
  let Case;
  let Folder;
  let Run;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    Run = defineRun(sequelize, DataTypes);
    defineRunCase(sequelize, DataTypes);
    defineComment(sequelize, DataTypes);

    app = express();
    app.use(express.json());
    app.use('/cases', indexByProjectIdRoute(sequelize));
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

  it('returns Folder Path for Test Run case selection results', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const childCase = await Case.create(casePayload(child.id, 'Mobile login'));
    await Run.create({ id: 1, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app).get('/cases/byproject?projectId=1&runId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: childCase.id, folderPath: ['Login', 'Mobile'] })]);
  });

  it('limits Test Run case selection to the selected Test Case Folder Scope', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const sibling = await Folder.create({ name: 'Checkout', projectId: 1 });
    const directCase = await Case.create(casePayload(parent.id, 'Parent login'));
    const childCase = await Case.create(casePayload(child.id, 'Mobile login'));
    await Case.create(casePayload(sibling.id, 'Checkout'));
    await Run.create({ id: 1, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app).get(`/cases/byproject?projectId=1&runId=1&folderId=${parent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.map((testcase) => testcase.id)).toEqual([directCase.id, childCase.id]);
    expect(res.body).toEqual([
      expect.objectContaining({ id: directCase.id, folderPath: ['Login'] }),
      expect.objectContaining({ id: childCase.id, folderPath: ['Login', 'Mobile'] }),
    ]);
  });

  it('limits Test Run case selection to Directly Placed Test Cases when Include Subfolders is off', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const directCase = await Case.create(casePayload(parent.id, 'Parent login'));
    await Case.create(casePayload(child.id, 'Mobile login'));
    await Run.create({ id: 1, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app).get(
      `/cases/byproject?projectId=1&runId=1&folderId=${parent.id}&includeSubfolders=false`
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: directCase.id, folderPath: ['Login'] })]);
  });

  it('rejects invalid Include Subfolders values for Test Run case selection', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    await Case.create(casePayload(parent.id, 'Parent login'));
    await Run.create({ id: 1, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app).get(
      `/cases/byproject?projectId=1&runId=1&folderId=${parent.id}&includeSubfolders=0`
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('includeSubfolders must be true or false');
  });

  it('filters Test Run case selection by Test Case priority and type', async () => {
    const folder = await Folder.create({ name: 'Login', projectId: 1 });
    const matchingCase = await Case.create({ ...casePayload(folder.id, 'Critical functional'), priority: 0, type: 4 });
    await Case.create({ ...casePayload(folder.id, 'High functional'), priority: 1, type: 4 });
    await Case.create({ ...casePayload(folder.id, 'Critical security'), priority: 0, type: 1 });
    await Run.create({ id: 1, name: 'Regression', projectId: 1, state: 0 });

    const res = await request(app).get(`/cases/byproject?projectId=1&runId=1&priority=0&type=4`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: matchingCase.id, title: 'Critical functional' })]);
  });
});
