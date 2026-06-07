import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import casesIndexRoute from './index.js';

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 7;
      next();
    },
  }),
}));

vi.mock('../../middleware/verifyVisible.js', () => ({
  default: () => ({ verifyProjectVisibleFromFolderId: (req, res, next) => next() }),
}));

describe('GET /cases Folder Scope', () => {
  let app;
  let sequelize;
  let Case;
  let Folder;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    app = express();
    app.use(express.json());
    app.use('/cases', casesIndexRoute(sequelize));
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

  it('returns Test Cases from the selected Test Case Folder Scope by default', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const otherProjectFolder = await Folder.create({ name: 'Login', projectId: 2 });
    const directCase = await Case.create(casePayload(parent.id, 'Parent login'));
    const childCase = await Case.create(casePayload(child.id, 'Mobile login'));
    await Case.create(casePayload(otherProjectFolder.id, 'Other project login'));

    const res = await request(app).get(`/cases?folderId=${parent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.map((testcase) => testcase.id)).toEqual([directCase.id, childCase.id]);
    expect(res.body).toEqual([
      expect.objectContaining({ id: directCase.id, folderPath: ['Login'] }),
      expect.objectContaining({ id: childCase.id, folderPath: ['Login', 'Mobile'] }),
    ]);
  });

  it('returns only Directly Placed Test Cases when Include Subfolders is off', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const directCase = await Case.create(casePayload(parent.id, 'Parent login'));
    await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get(`/cases?folderId=${parent.id}&includeSubfolders=false`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: directCase.id, folderPath: ['Login'] })]);
  });

  it('rejects invalid Include Subfolders values instead of widening the Folder Scope', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    await Case.create(casePayload(parent.id, 'Parent login'));

    const res = await request(app).get(`/cases?folderId=${parent.id}&includeSubfolders=0`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('includeSubfolders must be true or false');
  });

  it('returns the full Folder Path when the selected Test Case Folder is nested', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const childCase = await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get(`/cases?folderId=${child.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: childCase.id, folderPath: ['Login', 'Mobile'] })]);
  });
});
