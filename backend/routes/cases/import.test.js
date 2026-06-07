import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import XLSX from 'xlsx';

import defineFolder from '../../models/folders.js';
import casesImportRoute from './import.js';

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
    verifyProjectDeveloperFromFolderId: (req, res, next) => next(),
  }),
}));

describe('Cases import route', () => {
  let app;
  let sequelize;
  let Folder;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);

    app = express();
    app.use('/cases', casesImportRoute(sequelize));
    sequelize.models.CaseStep.removeAttribute('CaseId');
    sequelize.models.CaseStep.removeAttribute('StepId');
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('imports ordinary Test Cases into the requested current folder', async () => {
    const folder = await Folder.create({ name: 'Login', projectId: 1 });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        title: 'Imported login',
        priority: 'medium',
        type: 'functional',
        template: 'text',
        step: 'Open login',
        expectedStepResult: 'Login opens',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cases');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const res = await request(app)
      .post(`/cases/import?folderId=${folder.id}&includeSubfolders=false`)
      .attach('file', buffer, {
        filename: 'cases.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Imported login');
    expect(String(res.body[0].folderId)).toBe(String(folder.id));
  });
});
