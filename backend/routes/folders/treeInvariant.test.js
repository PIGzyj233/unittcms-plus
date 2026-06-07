import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineFolder from '../../models/folders.js';
import foldersEditRoute from './edit.js';
import foldersNewRoute from './new.js';

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
    verifyProjectDeveloperFromProjectId: (req, res, next) => next(),
    verifyProjectDeveloperFromFolderId: (req, res, next) => next(),
  }),
}));

describe('Folder tree invariants', () => {
  let app;
  let sequelize;
  let Folder;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);

    app = express();
    app.use(express.json());
    app.use('/folders', foldersNewRoute(sequelize));
    app.use('/folders', foldersEditRoute(sequelize));
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('rejects creating a folder under a parent from another Project', async () => {
    const otherProjectParent = await Folder.create({ name: 'Other Project', projectId: 2 });

    const res = await request(app)
      .post('/folders?projectId=1')
      .send({ name: 'Login', parentFolderId: otherProjectParent.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('parentFolderId must belong to the same project');
  });

  it('normalizes an empty parentFolderId to a root folder when creating', async () => {
    const res = await request(app).post('/folders?projectId=1').send({ name: 'Login', parentFolderId: '' });

    expect(res.status).toBe(200);
    expect(res.body.parentFolderId).toBeNull();
  });

  it('rejects making a folder its own parent', async () => {
    const folder = await Folder.create({ name: 'Login', projectId: 1 });

    const res = await request(app)
      .put(`/folders/${folder.id}`)
      .send({ name: 'Login', detail: '', projectId: 1, parentFolderId: folder.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('parentFolderId must not be the folder itself');
  });

  it('normalizes an empty parentFolderId to a root folder when editing', async () => {
    const parent = await Folder.create({ name: 'Parent', projectId: 1 });
    const folder = await Folder.create({ name: 'Login', projectId: 1, parentFolderId: parent.id });

    const res = await request(app)
      .put(`/folders/${folder.id}`)
      .send({ name: 'Login', detail: '', projectId: 1, parentFolderId: '' });

    expect(res.status).toBe(200);
    expect(res.body.parentFolderId).toBeNull();
  });

  it('rejects making a descendant folder the new parent', async () => {
    const parent = await Folder.create({ name: 'Login', projectId: 1 });
    const child = await Folder.create({ name: 'Mobile', projectId: 1, parentFolderId: parent.id });

    const res = await request(app)
      .put(`/folders/${parent.id}`)
      .send({ name: 'Login', detail: '', projectId: 1, parentFolderId: child.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('parentFolderId must not be a descendant of the folder');
  });

  it('rejects changing a folder project while editing', async () => {
    const folder = await Folder.create({ name: 'Login', projectId: 1 });

    const res = await request(app)
      .put(`/folders/${folder.id}`)
      .send({ name: 'Login', detail: '', projectId: 2, parentFolderId: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('projectId cannot be changed');
  });
});
