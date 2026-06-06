import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineAgentCaseCandidate from '../../models/agentCaseCandidates.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineTag from '../../models/tags.js';
import caseCandidatesRoute from './caseCandidates.js';
import { canEditCandidateStatus, candidateListWhere, rejectCandidate, updateCandidate } from './lib/candidates.js';

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

vi.mock('../../middleware/verifyVisible.js', () => ({
  default: () => ({ verifyProjectVisibleFromProjectId: (req, res, next) => next() }),
}));

describe('candidate workflow helpers', () => {
  it('allows editing only draft candidates', () => {
    expect(canEditCandidateStatus('draft')).toBe(true);
    expect(canEditCandidateStatus('accepted')).toBe(false);
    expect(canEditCandidateStatus('rejected')).toBe(false);
  });

  it('filters candidate lists by status and project', () => {
    expect(candidateListWhere({ projectId: 9, status: 'draft' })).toEqual({ projectId: 9, status: 'draft' });
    expect(candidateListWhere({ projectId: 9 })).toEqual({ projectId: 9 });
  });
});

describe('GET/PUT/reject /agent/case-candidates', () => {
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

    await Folder.bulkCreate([
      { id: 1, name: 'Project 1 root', projectId: 1 },
      { id: 2, name: 'Project 2 root', projectId: 2 },
    ]);
    await Tags.bulkCreate([
      { id: 1, name: 'Smoke', projectId: 1 },
      { id: 2, name: 'Other project', projectId: 2 },
    ]);

    app = express();
    app.use(express.json());
    app.use('/agent/case-candidates', caseCandidatesRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  function candidatePayload(overrides = {}) {
    return {
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
      ...overrides,
    };
  }

  function casePayload(overrides = {}) {
    return {
      title: 'Existing formal case',
      state: 0,
      priority: 1,
      type: 4,
      automationStatus: 1,
      description: '',
      template: 1,
      preConditions: '',
      expectedResults: '',
      folderId: 1,
      ...overrides,
    };
  }

  it('lists candidates by project and optional status newest first', async () => {
    const olderDraft = await Candidate.create(candidatePayload({ title: 'Older', normalizedTitle: 'older' }));
    const rejected = await Candidate.create(
      candidatePayload({ title: 'Rejected', normalizedTitle: 'rejected', status: 'rejected' })
    );
    const newestDraft = await Candidate.create(candidatePayload({ title: 'Newest', normalizedTitle: 'newest' }));
    await Candidate.create(
      candidatePayload({ projectId: 2, folderId: 2, title: 'Other project', normalizedTitle: 'other project' })
    );
    await olderDraft.update({ updatedAt: new Date('2026-01-01T00:00:00Z') }, { silent: true });
    await rejected.update({ updatedAt: new Date('2026-01-02T00:00:00Z') }, { silent: true });
    await newestDraft.update({ updatedAt: new Date('2026-01-03T00:00:00Z') }, { silent: true });

    const allRes = await request(app).get('/agent/case-candidates?projectId=1');
    expect(allRes.status).toBe(200);
    expect(allRes.body.candidates.map((candidate) => candidate.title)).toEqual(['Newest', 'Rejected', 'Older']);

    const draftRes = await request(app).get('/agent/case-candidates?projectId=1&status=draft');
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.candidates.map((candidate) => candidate.title)).toEqual(['Newest', 'Older']);
  });

  it('edits draft candidates with create-style normalization', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const res = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=1`)
      .send({
        title: '  Password reset  ',
        folderId: '1',
        priority: 'high',
        steps: [{ step: 'Open reset', result: 'Form is visible' }],
        tagIds: ['1'],
        suggestedTags: ['  Reset   Flow '],
      });

    expect(res.status).toBe(200);
    expect(res.body.candidate).toMatchObject({
      title: 'Password reset',
      normalizedTitle: 'password reset',
      folderId: 1,
      priority: 1,
      steps: [{ step: 'Open reset', result: 'Form is visible' }],
      tagIds: [1],
      suggestedTags: ['Reset Flow'],
      status: 'draft',
    });
  });

  it('blocks editing draft title to duplicate an existing formal case', async () => {
    await Case.create(casePayload({ title: 'Formal duplicate' }));
    const candidate = await Candidate.create(
      candidatePayload({ title: 'Unique draft', normalizedTitle: 'unique draft' })
    );

    const res = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=1`)
      .send({ title: 'Formal duplicate' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Candidate title duplicates');
    expect(res.body.duplicateMetadata).toMatchObject({
      blocked: true,
      warnings: [{ resourceType: 'case' }],
    });

    await candidate.reload();
    expect(candidate.title).toBe('Unique draft');
    expect(candidate.duplicateMetadata).toEqual({ blocked: false, warnings: [] });
  });

  it('blocks editing draft title to duplicate another draft without override', async () => {
    await Candidate.create(candidatePayload({ title: 'Other draft', normalizedTitle: 'other draft' }));
    const candidate = await Candidate.create(
      candidatePayload({ title: 'Unique draft', normalizedTitle: 'unique draft' })
    );

    const res = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=1`)
      .send({ title: 'Other draft' });

    expect(res.status).toBe(409);
    expect(res.body.duplicateMetadata).toMatchObject({
      blocked: true,
      warnings: [{ resourceType: 'candidate' }],
    });

    await candidate.reload();
    expect(candidate.title).toBe('Unique draft');
    expect(candidate.duplicateAllowed).toBe(false);
  });

  it('allows editing draft title to duplicate another draft with override metadata', async () => {
    const existing = await Candidate.create(candidatePayload({ title: 'Other draft', normalizedTitle: 'other draft' }));
    const candidate = await Candidate.create(
      candidatePayload({ title: 'Unique draft', normalizedTitle: 'unique draft' })
    );

    const res = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=1`)
      .send({ title: 'Other draft', allowStrongDuplicate: true });

    expect(res.status).toBe(200);
    expect(res.body.candidate).toMatchObject({
      title: 'Other draft',
      normalizedTitle: 'other draft',
      duplicateAllowed: true,
      duplicateMetadata: {
        blocked: true,
        warnings: [{ resourceType: 'candidate', ids: [existing.id] }],
      },
    });
  });

  it('supports editing candidates without a projectId helper scope', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const updated = await updateCandidate(sequelize, {
      candidateId: candidate.id,
      body: { title: '  Helper update  ' },
    });

    expect(updated.title).toBe('Helper update');
    expect(updated.normalizedTitle).toBe('helper update');
  });

  it('rejects forbidden direct edit fields', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const res = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=1`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status is not allowed');
  });

  it('rejects null enum updates instead of preserving existing values', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const res = await request(app).put(`/agent/case-candidates/${candidate.id}?projectId=1`).send({ priority: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('priority must be one of');
  });

  it('rejects invalid route candidate IDs', async () => {
    const editRes = await request(app)
      .put('/agent/case-candidates/not-a-number?projectId=1')
      .send({ title: 'Invalid' });
    expect(editRes.status).toBe(400);
    expect(editRes.body.error).toContain('candidateId must be a positive integer');

    const rejectRes = await request(app).post('/agent/case-candidates/not-a-number/reject?projectId=1');
    expect(rejectRes.status).toBe(400);
    expect(rejectRes.body.error).toContain('candidateId must be a positive integer');
  });

  it('prevents edits and rejects outside the requested project', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const editRes = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=2`)
      .send({ title: 'Wrong project' });
    expect(editRes.status).toBe(404);
    expect(editRes.body.error).toContain('Candidate not found');

    const rejectRes = await request(app).post(`/agent/case-candidates/${candidate.id}/reject?projectId=2`);
    expect(rejectRes.status).toBe(404);
    expect(rejectRes.body.error).toContain('Candidate not found');
  });

  it('rejects only draft candidates and records review metadata', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const res = await request(app).post(`/agent/case-candidates/${candidate.id}/reject?projectId=1`);
    expect(res.status).toBe(200);
    expect(res.body.candidate.status).toBe('rejected');
    expect(res.body.candidate.reviewerUserId).toBe(7);
    expect(res.body.candidate.reviewedAt).toBeTruthy();

    const editRes = await request(app)
      .put(`/agent/case-candidates/${candidate.id}?projectId=1`)
      .send({ title: 'Cannot edit' });
    expect(editRes.status).toBe(409);
    expect(editRes.body.error).toContain('Only draft candidates can be edited');

    const rejectAgainRes = await request(app).post(`/agent/case-candidates/${candidate.id}/reject?projectId=1`);
    expect(rejectAgainRes.status).toBe(409);
    expect(rejectAgainRes.body.error).toContain('Only draft candidates can be rejected');
  });

  it('supports rejecting candidates without a projectId helper scope', async () => {
    const candidate = await Candidate.create(candidatePayload());

    const rejected = await rejectCandidate(sequelize, { candidateId: candidate.id, userId: 7 });

    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewerUserId).toBe(7);
    expect(rejected.reviewedAt).toBeTruthy();
  });
});
