import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineAgentCaseCandidate from '../../models/agentCaseCandidates.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineTag from '../../models/tags.js';
import caseCandidatesRoute from './caseCandidates.js';

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

describe('POST /agent/case-candidates', () => {
  let app;
  let sequelize;
  let Candidate;
  let Case;
  let Folder;
  let Tags;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
    Case = defineCase(sequelize, DataTypes);
    Folder = defineFolder(sequelize, DataTypes);
    Tags = defineTag(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');

    app = express();
    app.use(express.json());
    app.use('/agent/case-candidates', caseCandidatesRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  async function createProjectFolder() {
    await Folder.create({ id: 1, name: 'Root', projectId: 1 });
  }

  it('rejects unknown fields', async () => {
    const res = await request(app).post('/agent/case-candidates?projectId=1').send({ title: 'A', extra: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('extra is not allowed');
  });

  it('requires folderId and string enum UIDs', async () => {
    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        priority: 1,
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        steps: [],
        tagIds: [],
        suggestedTags: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('folderId');
  });

  it('rejects numeric enum values when folderId is valid', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1,
        priority: 1,
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('priority must be one of');
  });

  it('rejects non-string titles', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 123,
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title must be a non-empty string');
  });

  it('rejects provided non-array steps', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        steps: 'not-array',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('steps must be an array');
  });

  it('rejects malformed step objects', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        steps: [{ step: 'Open page', result: 200, extra: true }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('steps[0].result must be a string');
  });

  it('rejects invalid tag ID shapes', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        tagIds: [0],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tagIds[0] must be a positive integer');
  });

  it('rejects tag IDs from another project', async () => {
    await createProjectFolder();
    await Tags.create({ id: 1, name: 'Other project', projectId: 2 });

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        tagIds: [1],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tagIds must belong to projectId');
  });

  it('stores normalized suggested tags', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        suggestedTags: ['  Smoke   Test  ', ' Regression '],
      });

    expect(res.status).toBe(201);
    expect(res.body.candidate.suggestedTags).toEqual(['Smoke Test', 'Regression']);
  });

  it('rejects fractional folder IDs', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: 'A',
        folderId: 1.5,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('folderId must be a positive integer');
  });

  it('creates a draft candidate with normalized defaults', async () => {
    await createProjectFolder();

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: '  Login works  ',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      });

    expect(res.status).toBe(201);
    expect(res.body.candidate).toMatchObject({
      projectId: 1,
      folderId: 1,
      title: 'Login works',
      normalizedTitle: 'login works',
      description: '',
      preConditions: '',
      expectedResults: '',
      priority: 1,
      type: 4,
      automationStatus: 1,
      template: 1,
      steps: [],
      tagIds: [],
      suggestedTags: [],
      source: 'agent',
      rationale: '',
      duplicateMetadata: { blocked: false, warnings: [] },
      status: 'draft',
      duplicateAllowed: false,
      creatorUserId: 7,
    });
  });

  it('blocks exact title duplicates in project folders', async () => {
    await createProjectFolder();
    await Case.create({
      title: 'Login works',
      state: 0,
      priority: 1,
      type: 4,
      automationStatus: 1,
      description: '',
      template: 1,
      preConditions: '',
      expectedResults: '',
      folderId: 1,
    });

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: ' login   works ',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('duplicates');
    expect(res.body.duplicateMetadata).toMatchObject({
      blocked: true,
      warnings: [
        {
          strength: 'strong',
          resourceType: 'case',
          ids: [1],
          message: 'Exact title match with formal test case',
        },
      ],
    });
  });

  it('allows strong formal-case duplicates when explicitly requested and stores metadata', async () => {
    await createProjectFolder();
    await Case.create({
      title: 'Login works',
      state: 0,
      priority: 1,
      type: 4,
      automationStatus: 1,
      description: '',
      template: 1,
      preConditions: '',
      expectedResults: '',
      folderId: 1,
    });

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: ' login   works ',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        allowStrongDuplicate: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.candidate.duplicateMetadata).toMatchObject({
      blocked: true,
      warnings: [
        {
          strength: 'strong',
          resourceType: 'case',
          ids: [1],
        },
      ],
    });
  });

  it('durably prevents duplicate draft normalized titles', async () => {
    await createProjectFolder();
    const payload = {
      projectId: 1,
      folderId: 1,
      title: 'Login works',
      normalizedTitle: 'login works',
      priority: 1,
      type: 4,
      automationStatus: 1,
      template: 1,
      steps: [],
      tagIds: [],
      suggestedTags: [],
      duplicateMetadata: { blocked: false, warnings: [] },
      status: 'draft',
      duplicateAllowed: false,
      creatorUserId: 7,
    };

    await Candidate.create(payload);

    await expect(Candidate.create({ ...payload, title: ' login   works ' })).rejects.toThrow();
  });

  it('allows strong draft duplicates when explicitly requested and stores metadata', async () => {
    await createProjectFolder();
    await Candidate.create({
      projectId: 1,
      folderId: 1,
      title: 'Login works',
      normalizedTitle: 'login works',
      priority: 1,
      type: 4,
      automationStatus: 1,
      template: 1,
      steps: [],
      tagIds: [],
      suggestedTags: [],
      duplicateMetadata: { blocked: false, warnings: [] },
      status: 'draft',
      duplicateAllowed: false,
      creatorUserId: 7,
    });

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: ' login   works ',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
        allowStrongDuplicate: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.candidate.duplicateAllowed).toBe(true);
    expect(res.body.candidate.duplicateMetadata).toMatchObject({
      blocked: true,
      warnings: [
        {
          strength: 'strong',
          resourceType: 'candidate',
          ids: [1],
          message: 'Exact title match with draft candidate',
        },
      ],
    });
  });

  it('still returns 409 for non-override draft duplicates', async () => {
    await createProjectFolder();
    await Candidate.create({
      projectId: 1,
      folderId: 1,
      title: 'Login works',
      normalizedTitle: 'login works',
      priority: 1,
      type: 4,
      automationStatus: 1,
      template: 1,
      steps: [],
      tagIds: [],
      suggestedTags: [],
      duplicateMetadata: { blocked: false, warnings: [] },
      status: 'draft',
      duplicateAllowed: false,
      creatorUserId: 7,
    });

    const res = await request(app)
      .post('/agent/case-candidates?projectId=1')
      .send({
        title: ' login   works ',
        folderId: 1,
        priority: 'high',
        type: 'functional',
        automationStatus: 'automation-not-required',
        template: 'step',
      });

    expect(res.status).toBe(409);
    expect(res.body.duplicateMetadata).toMatchObject({
      blocked: true,
      warnings: [
        {
          strength: 'strong',
          resourceType: 'candidate',
          ids: [1],
        },
      ],
    });
  });
});
