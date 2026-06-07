import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import foldersIndexRoute from './index.js';

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

describe('GET /folders Folder Scope Count', () => {
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
    app.use('/folders', foldersIndexRoute(sequelize));
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

  it('returns Folder Scope Count as the primary case count and direct count as secondary context', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    await Case.create(casePayload(parent.id, 'Parent login'));
    await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get('/folders?projectId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ id: parent.id, caseCount: 2, directCaseCount: 1 }),
      expect.objectContaining({ id: child.id, caseCount: 1, directCaseCount: 1 }),
    ]);
  });
});
