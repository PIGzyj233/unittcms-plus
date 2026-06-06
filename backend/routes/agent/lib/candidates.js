import { DataTypes, Op } from 'sequelize';

import { automationStatus, priorities, templates, testTypes } from '../../../config/enums.js';
import defineAgentCaseCandidate from '../../../models/agentCaseCandidates.js';
import defineCase from '../../../models/cases.js';
import defineCaseStep from '../../../models/caseSteps.js';
import defineCaseTag from '../../../models/caseTags.js';
import defineFolder from '../../../models/folders.js';
import defineStep from '../../../models/steps.js';
import defineTag from '../../../models/tags.js';
import { findDuplicateWarnings, normalizeTitle } from './duplicates.js';
import { parseCaseEnums } from './enums.js';
import { validateObject } from './schema.js';

const acceptOperationType = 'accept-candidates';

const candidateFields = {
  required: ['title', 'folderId', 'priority', 'type', 'automationStatus', 'template'],
  optional: [
    'description',
    'preConditions',
    'expectedResults',
    'steps',
    'tagIds',
    'suggestedTags',
    'source',
    'rationale',
    'allowStrongDuplicate',
  ],
};

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateCandidateBody(body) {
  try {
    validateObject(body, candidateFields, 'candidate');
  } catch (error) {
    throw createBadRequest(error.message);
  }
}

function parseCandidateEnums(body) {
  try {
    return parseCaseEnums(body);
  } catch (error) {
    throw createBadRequest(error.message);
  }
}

function normalizeFolderId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw createBadRequest('folderId must be a positive integer');
}

function validateTextField(body, field) {
  if (body[field] !== undefined && typeof body[field] !== 'string') {
    throw createBadRequest(`${field} must be a string`);
  }
}

function normalizeArrayField(body, field) {
  if (body[field] === undefined) {
    return [];
  }

  if (!Array.isArray(body[field])) {
    throw createBadRequest(`${field} must be an array`);
  }

  return body[field];
}

function normalizePositiveInteger(value, label) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw createBadRequest(`${label} must be a positive integer`);
}

function buildAcceptPayload({ candidateIds, createMissingTags, allowPartial }) {
  if (!Array.isArray(candidateIds)) {
    throw createBadRequest('candidateIds must be an array');
  }

  return {
    candidateIds: candidateIds.map((candidateId, index) =>
      normalizePositiveInteger(candidateId, `candidateIds[${index}]`)
    ),
    createMissingTags: createMissingTags === true,
    allowPartial: allowPartial === true,
  };
}

function model(sequelize, name, defineModel) {
  return sequelize.models[name] || defineModel(sequelize, DataTypes);
}

function normalizeSteps(body) {
  return normalizeArrayField(body, 'steps').map((step, index) => {
    if (!step || Array.isArray(step) || typeof step !== 'object') {
      throw createBadRequest(`steps[${index}] must be an object`);
    }

    if (typeof step.step !== 'string') {
      throw createBadRequest(`steps[${index}].step must be a string`);
    }

    if (typeof step.result !== 'string') {
      throw createBadRequest(`steps[${index}].result must be a string`);
    }

    for (const key of Object.keys(step)) {
      if (!['step', 'result'].includes(key)) {
        throw createBadRequest(`steps[${index}].${key} is not allowed`);
      }
    }

    return { step: step.step, result: step.result };
  });
}

function normalizeTagIds(body) {
  return normalizeArrayField(body, 'tagIds').map((tagId, index) => normalizePositiveInteger(tagId, `tagIds[${index}]`));
}

function normalizeSuggestedTags(body) {
  return normalizeArrayField(body, 'suggestedTags').map((tag, index) => {
    if (typeof tag !== 'string') {
      throw createBadRequest(`suggestedTags[${index}] must be a string`);
    }

    const normalized = tag.trim().replace(/\s+/g, ' ');
    if (normalized === '') {
      throw createBadRequest(`suggestedTags[${index}] must be a non-empty string`);
    }

    return normalized;
  });
}

function normalizeCandidateBody(body) {
  validateCandidateBody(body);

  if (typeof body.title !== 'string' || body.title.trim() === '') {
    throw createBadRequest('title must be a non-empty string');
  }

  for (const field of ['description', 'preConditions', 'expectedResults', 'source', 'rationale']) {
    validateTextField(body, field);
  }

  if (body.allowStrongDuplicate !== undefined && typeof body.allowStrongDuplicate !== 'boolean') {
    throw createBadRequest('allowStrongDuplicate must be a boolean');
  }

  return {
    ...body,
    folderId: normalizeFolderId(body.folderId),
    title: body.title.trim(),
    steps: normalizeSteps(body),
    tagIds: normalizeTagIds(body),
    suggestedTags: normalizeSuggestedTags(body),
  };
}

function canEditCandidateStatus(status) {
  return status === 'draft';
}

function candidateListWhere({ projectId, status }) {
  const where = { projectId };
  if (status) {
    where.status = status;
  }
  return where;
}

function hasProjectScope(projectId) {
  return Number.isSafeInteger(projectId);
}

function candidateLookupWhere({ candidateId, projectId }) {
  const where = { id: candidateId };
  if (hasProjectScope(projectId)) {
    where.projectId = projectId;
  }
  return where;
}

function validateCandidateUpdateBody(body) {
  try {
    validateObject(
      body,
      {
        required: [],
        optional: candidateFields.required.concat(candidateFields.optional),
      },
      'candidate'
    );
  } catch (error) {
    throw createBadRequest(error.message);
  }
}

function enumUid(values, index) {
  return values[index];
}

function normalizeUpdateEnums(candidate, body) {
  if (!['priority', 'type', 'automationStatus', 'template'].some((field) => body[field] !== undefined)) {
    return {};
  }

  const current = candidate.toJSON();
  return parseCandidateEnums({
    priority: body.priority !== undefined ? body.priority : enumUid(priorities, current.priority),
    type: body.type !== undefined ? body.type : enumUid(testTypes, current.type),
    automationStatus:
      body.automationStatus !== undefined ? body.automationStatus : enumUid(automationStatus, current.automationStatus),
    template: body.template !== undefined ? body.template : enumUid(templates, current.template),
  });
}

function normalizeCandidateUpdateBody(candidate, body) {
  validateCandidateUpdateBody(body);

  const normalizedBody = { ...body };
  for (const field of ['description', 'preConditions', 'expectedResults', 'source', 'rationale']) {
    validateTextField(normalizedBody, field);
  }

  if (normalizedBody.title !== undefined) {
    if (typeof normalizedBody.title !== 'string' || normalizedBody.title.trim() === '') {
      throw createBadRequest('title must be a non-empty string');
    }
    normalizedBody.title = normalizedBody.title.trim();
    normalizedBody.normalizedTitle = normalizeTitle(normalizedBody.title);
  }

  if (normalizedBody.folderId !== undefined) {
    normalizedBody.folderId = normalizeFolderId(normalizedBody.folderId);
  }

  if (normalizedBody.steps !== undefined) {
    normalizedBody.steps = normalizeSteps(normalizedBody);
  }

  if (normalizedBody.tagIds !== undefined) {
    normalizedBody.tagIds = normalizeTagIds(normalizedBody);
  }

  if (normalizedBody.suggestedTags !== undefined) {
    normalizedBody.suggestedTags = normalizeSuggestedTags(normalizedBody);
  }

  if (normalizedBody.allowStrongDuplicate !== undefined) {
    if (typeof normalizedBody.allowStrongDuplicate !== 'boolean') {
      throw createBadRequest('allowStrongDuplicate must be a boolean');
    }
    normalizedBody.duplicateAllowed = normalizedBody.allowStrongDuplicate;
    delete normalizedBody.allowStrongDuplicate;
  }

  return {
    ...normalizedBody,
    ...normalizeUpdateEnums(candidate, body),
  };
}

async function validateTagIdsBelongToProject(Tags, { projectId, tagIds }) {
  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length === 0) {
    return;
  }

  const tags = await Tags.findAll({ where: { id: { [Op.in]: uniqueTagIds }, projectId } });
  if (tags.length !== uniqueTagIds.length) {
    throw createBadRequest('tagIds must belong to projectId');
  }
}

function createDuplicateError(duplicateMetadata) {
  const error = new Error('Candidate title duplicates an existing case or draft candidate');
  error.status = 409;
  error.details = { duplicateMetadata };
  return error;
}

function withoutSelfDuplicateWarning(duplicateMetadata, candidateId) {
  const warnings = duplicateMetadata.warnings
    .map((warning) => {
      if (warning.resourceType !== 'candidate') {
        return warning;
      }

      return { ...warning, ids: warning.ids.filter((id) => id !== candidateId) };
    })
    .filter((warning) => warning.resourceType !== 'candidate' || warning.ids.length > 0);

  return { blocked: warnings.some((warning) => warning.strength === 'strong'), warnings };
}

function isUniqueConstraintError(error) {
  return error.name === 'SequelizeUniqueConstraintError';
}

async function createCandidate(sequelize, { projectId, userId, body }) {
  const normalizedBody = normalizeCandidateBody(body);
  const parsedEnums = parseCandidateEnums(normalizedBody);

  const Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);
  const folder = await Folder.findOne({ where: { id: normalizedBody.folderId, projectId } });
  if (!folder) {
    throw createBadRequest('folderId must belong to projectId');
  }

  await validateTagIdsBelongToProject(Tags, { projectId, tagIds: normalizedBody.tagIds });

  const folders = await Folder.findAll({ where: { projectId } });
  const duplicateCheck = {
    Candidate,
    Case,
    projectId,
    folderIds: folders.map((entry) => entry.id),
    title: normalizedBody.title,
  };
  const duplicateMetadata = await findDuplicateWarnings(duplicateCheck);
  if (duplicateMetadata.blocked && normalizedBody.allowStrongDuplicate !== true) {
    throw createDuplicateError(duplicateMetadata);
  }

  try {
    return await Candidate.create({
      projectId,
      folderId: normalizedBody.folderId,
      title: normalizedBody.title,
      normalizedTitle: normalizeTitle(normalizedBody.title),
      description: normalizedBody.description || '',
      preConditions: normalizedBody.preConditions || '',
      expectedResults: normalizedBody.expectedResults || '',
      ...parsedEnums,
      steps: normalizedBody.steps,
      tagIds: normalizedBody.tagIds,
      suggestedTags: normalizedBody.suggestedTags,
      source: normalizedBody.source || 'agent',
      rationale: normalizedBody.rationale || '',
      duplicateMetadata,
      status: 'draft',
      duplicateAllowed: normalizedBody.allowStrongDuplicate === true,
      creatorUserId: userId,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createDuplicateError(await findDuplicateWarnings(duplicateCheck));
    }
    throw error;
  }
}

async function listCandidates(sequelize, { projectId, status }) {
  const Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
  return Candidate.findAll({ where: candidateListWhere({ projectId, status }), order: [['updatedAt', 'DESC']] });
}

async function updateCandidate(sequelize, { projectId, candidateId, body }) {
  const Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);
  const candidate = await Candidate.findOne({ where: candidateLookupWhere({ candidateId, projectId }) });
  if (!candidate) {
    throw Object.assign(new Error('Candidate not found'), { status: 404 });
  }
  if (!canEditCandidateStatus(candidate.status)) {
    throw Object.assign(new Error('Only draft candidates can be edited'), { status: 409 });
  }

  const normalizedBody = normalizeCandidateUpdateBody(candidate, body);
  const validationProjectId = hasProjectScope(projectId) ? projectId : candidate.projectId;
  if (normalizedBody.folderId !== undefined) {
    const folder = await Folder.findOne({ where: { id: normalizedBody.folderId, projectId: validationProjectId } });
    if (!folder) {
      throw createBadRequest('folderId must belong to projectId');
    }
  }
  if (normalizedBody.tagIds !== undefined) {
    await validateTagIdsBelongToProject(Tags, { projectId: validationProjectId, tagIds: normalizedBody.tagIds });
  }

  const mergedTitle = normalizedBody.title ?? candidate.title;
  const folders = await Folder.findAll({ where: { projectId: validationProjectId } });
  const duplicateMetadata = withoutSelfDuplicateWarning(
    await findDuplicateWarnings({
      Candidate,
      Case,
      projectId: validationProjectId,
      folderIds: folders.map((entry) => entry.id),
      title: mergedTitle,
    }),
    candidate.id
  );
  const keepsExistingDuplicateOverride =
    normalizedBody.duplicateAllowed === undefined &&
    candidate.duplicateAllowed === true &&
    normalizeTitle(mergedTitle) === candidate.normalizedTitle;
  const duplicateAllowed = normalizedBody.duplicateAllowed === true || keepsExistingDuplicateOverride;
  if (duplicateMetadata.blocked && !duplicateAllowed) {
    throw createDuplicateError(duplicateMetadata);
  }
  normalizedBody.duplicateMetadata = duplicateMetadata;
  normalizedBody.duplicateAllowed = duplicateMetadata.blocked && duplicateAllowed;

  try {
    await candidate.update(normalizedBody);
  } catch (error) {
    if (isUniqueConstraintError(error) && normalizedBody.title) {
      throw createDuplicateError(
        withoutSelfDuplicateWarning(
          await findDuplicateWarnings({
            Candidate,
            Case,
            projectId: validationProjectId,
            folderIds: folders.map((entry) => entry.id),
            title: normalizedBody.title,
          }),
          candidate.id
        )
      );
    }
    throw error;
  }
  return candidate;
}

async function rejectCandidate(sequelize, { projectId, candidateId, userId }) {
  const Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
  const candidate = await Candidate.findOne({ where: candidateLookupWhere({ candidateId, projectId }) });
  if (!candidate) {
    throw Object.assign(new Error('Candidate not found'), { status: 404 });
  }
  if (!canEditCandidateStatus(candidate.status)) {
    throw Object.assign(new Error('Only draft candidates can be rejected'), { status: 409 });
  }
  await candidate.update({ status: 'rejected', reviewerUserId: userId, reviewedAt: new Date() });
  return candidate;
}

async function acceptCandidates(
  sequelize,
  { projectId, userId, candidateIds, createMissingTags = false, allowPartial = false },
  options = {}
) {
  const Candidate = model(sequelize, 'AgentCaseCandidate', defineAgentCaseCandidate);
  const Case = model(sequelize, 'Case', defineCase);
  const Step = model(sequelize, 'Step', defineStep);
  const CaseStep = model(sequelize, 'CaseStep', defineCaseStep);
  const CaseTag = model(sequelize, 'caseTags', defineCaseTag);
  const Folder = model(sequelize, 'Folder', defineFolder);
  const Tag = model(sequelize, 'Tags', defineTag);

  const acceptOne = async (candidateId, transaction) => {
    const candidate = await Candidate.findOne({ where: { id: candidateId, projectId }, transaction });
    if (!candidate) throw Object.assign(new Error(`Candidate ${candidateId} not found`), { status: 404 });
    if (candidate.status !== 'draft') {
      throw Object.assign(new Error(`Candidate ${candidateId} is not draft`), { status: 409 });
    }

    const folder = await Folder.findOne({ where: { id: candidate.folderId, projectId }, transaction });
    if (!folder) {
      throw createBadRequest('Candidate folder must belong to projectId');
    }

    const storedTagIds = [...new Set(candidate.tagIds)];
    if (storedTagIds.length > 0) {
      const tags = await Tag.findAll({ where: { id: { [Op.in]: storedTagIds }, projectId }, transaction });
      if (tags.length !== storedTagIds.length) {
        throw createBadRequest('Candidate tagIds must belong to projectId');
      }
    }

    const formalCase = await Case.create(
      {
        folderId: candidate.folderId,
        title: candidate.title,
        state: 0,
        priority: candidate.priority,
        type: candidate.type,
        automationStatus: candidate.automationStatus,
        description: candidate.description,
        template: candidate.template,
        preConditions: candidate.preConditions,
        expectedResults: candidate.expectedResults,
      },
      { transaction }
    );

    for (const [index, step] of candidate.steps.entries()) {
      const newStep = await Step.create({ step: step.step, result: step.result }, { transaction });
      await CaseStep.create({ caseId: formalCase.id, stepId: newStep.id, stepNo: index + 1 }, { transaction });
    }

    const tagIds = [...storedTagIds];
    if (createMissingTags) {
      for (const tagName of candidate.suggestedTags) {
        const [tag] = await Tag.findOrCreate({
          where: { name: tagName, projectId },
          defaults: { name: tagName, projectId },
          transaction,
        });
        tagIds.push(tag.id);
      }
    }

    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length > 0) {
      await CaseTag.bulkCreate(
        uniqueTagIds.map((tagId) => ({ caseId: formalCase.id, tagId })),
        { transaction }
      );
    }

    await candidate.update(
      { status: 'accepted', reviewerUserId: userId, acceptedCaseId: formalCase.id, reviewedAt: new Date() },
      { transaction }
    );
    return { candidateId, caseId: formalCase.id };
  };

  if (!allowPartial) {
    if (options.transaction) {
      const accepted = [];
      for (const candidateId of candidateIds) {
        accepted.push(await acceptOne(candidateId, options.transaction));
      }
      return { accepted, failed: [] };
    }

    return sequelize.transaction(async (transaction) => {
      const accepted = [];
      for (const candidateId of candidateIds) {
        accepted.push(await acceptOne(candidateId, transaction));
      }
      return { accepted, failed: [] };
    });
  }

  const accepted = [];
  const failed = [];
  for (const candidateId of candidateIds) {
    try {
      if (options.transaction) {
        accepted.push(
          await sequelize.transaction({ transaction: options.transaction }, (transaction) =>
            acceptOne(candidateId, transaction)
          )
        );
      } else {
        accepted.push(await sequelize.transaction((transaction) => acceptOne(candidateId, transaction)));
      }
    } catch (error) {
      failed.push({ candidateId, error: error.message });
    }
  }
  return { accepted, failed };
}

export {
  acceptCandidates,
  acceptOperationType,
  buildAcceptPayload,
  canEditCandidateStatus,
  candidateListWhere,
  createCandidate,
  listCandidates,
  rejectCandidate,
  updateCandidate,
};
