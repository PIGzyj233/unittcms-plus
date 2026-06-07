import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineCaseStep from '../../models/caseSteps.js';
import defineCaseTag from '../../models/caseTags.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineStep from '../../models/steps.js';
import defineTag from '../../models/tags.js';
import casesDownloadRoute from './download.js';

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

describe('GET /cases/download Folder Scope', () => {
  let app;
  let sequelize;
  let Case;
  let CaseTag;
  let Folder;
  let Tags;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    CaseTag = defineCaseTag(sequelize, DataTypes);
    Tags = defineTag(sequelize, DataTypes);
    defineStep(sequelize, DataTypes);
    defineCaseStep(sequelize, DataTypes);

    app = express();
    app.use(express.json());
    app.use('/cases', casesDownloadRoute(sequelize));
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

  it('exports Test Cases from the selected Test Case Folder Scope by default', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    await Case.create(casePayload(parent.id, 'Parent login'));
    await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get(`/cases/download?folderId=${parent.id}&type=csv`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Parent login');
    expect(res.text).toContain('Mobile login');
    expect(res.text).toContain('folderPath');
    expect(res.text).toContain('Login / Mobile');
  });

  it('keeps Folder Path structured in JSON exports', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    const childCase = await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get(`/cases/download?folderId=${parent.id}&type=json`);

    expect(res.status).toBe(200);
    expect(res.body[String(childCase.id)]).toEqual(
      expect.objectContaining({ folderPath: ['Login', 'Mobile'], title: 'Mobile login' })
    );
  });

  it('exports only Directly Placed Test Cases when Include Subfolders is off', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    await Case.create(casePayload(parent.id, 'Parent login'));
    await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get(`/cases/download?folderId=${parent.id}&type=csv&includeSubfolders=false`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Parent login');
    expect(res.text).not.toContain('Mobile login');
  });

  it('rejects invalid Include Subfolders values', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    await Case.create(casePayload(parent.id, 'Parent login'));

    const res = await request(app).get(`/cases/download?folderId=${parent.id}&type=csv&includeSubfolders=0`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('includeSubfolders must be true or false');
  });

  it('exports the current filtered Folder Scope result set', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });
    await Case.create(casePayload(parent.id, 'Parent login'));
    await Case.create(casePayload(child.id, 'Mobile login'));

    const res = await request(app).get(`/cases/download?folderId=${parent.id}&type=csv&search=Mobile`);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Parent login');
    expect(res.text).toContain('Mobile login');
  });

  it('uses the same any-tag filter semantics as the visible Test Case list', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const firstTag = await Tags.create({ name: 'Smoke', projectId: 1 });
    const secondTag = await Tags.create({ name: 'Regression', projectId: 1 });
    const smokeCase = await Case.create(casePayload(parent.id, 'Smoke login'));
    const regressionCase = await Case.create(casePayload(parent.id, 'Regression login'));
    await Case.create(casePayload(parent.id, 'Untagged login'));
    await CaseTag.create({ caseId: smokeCase.id, tagId: firstTag.id });
    await CaseTag.create({ caseId: regressionCase.id, tagId: secondTag.id });

    const res = await request(app).get(
      `/cases/download?folderId=${parent.id}&type=csv&tag=${firstTag.id},${secondTag.id}`
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain('Smoke login');
    expect(res.text).toContain('Regression login');
    expect(res.text).not.toContain('Untagged login');
  });
});
