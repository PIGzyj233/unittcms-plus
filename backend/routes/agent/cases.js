import express from 'express';
import { DataTypes, Op } from 'sequelize';

import {
  automationStatus,
  priorities,
  templates,
  testRunCaseStatus,
  testRunStatus,
  testTypes,
} from '../../config/enums.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import defineCaseTag from '../../models/caseTags.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import defineStep from '../../models/steps.js';
import defineTag from '../../models/tags.js';
import { folderPathFor, getFolderScope, getProjectFolderPaths } from '../lib/folderScope.js';
import { parseOptionalBooleanQuery } from '../lib/queryParams.js';

function buildCaseSearchWhere({ priority, type }) {
  const where = {};
  if (priority?.length) where.priority = { inValues: priority };
  if (type?.length) where.type = { inValues: type };
  return where;
}

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function model(sequelize, name, defineModel) {
  return sequelize.models[name] || defineModel(sequelize, DataTypes);
}

function parsePositiveSafeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createBadRequest(`${label} must be a positive integer`);
  }
  return parsed;
}

function singleQueryValue(value, label) {
  if (Array.isArray(value)) {
    throw createBadRequest(`${label} must be provided once`);
  }
  return value;
}

function parseList(value) {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePositiveIntegerList(value, label) {
  return [...new Set(parseList(value).map((entry, index) => parsePositiveSafeInteger(entry, `${label}[${index}]`)))];
}

function parseEnumList(value, allowedValues, label) {
  return [
    ...new Set(
      parseList(value).map((entry) => {
        if (/^\d+$/.test(entry)) {
          const parsed = Number(entry);
          if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed < allowedValues.length) {
            return parsed;
          }
        }

        const index = allowedValues.findIndex((allowed) => allowed === entry);
        if (index !== -1) {
          return index;
        }

        throw createBadRequest(`${label} must be one of: ${allowedValues.join(', ')}`);
      })
    ),
  ];
}

function enumUid(values, value) {
  return values[value] || String(value);
}

function sequelizeWhereFromStructuredWhere(where) {
  return Object.fromEntries(
    Object.entries(where).map(([key, value]) => {
      if (value && typeof value === 'object' && Array.isArray(value.inValues)) {
        return [key, { [Op.in]: value.inValues }];
      }
      return [key, value];
    })
  );
}

function addKeywordFilter(where, keyword) {
  if (Array.isArray(keyword)) {
    throw createBadRequest('keyword must be provided once');
  }
  const searchTerm = keyword?.trim();
  if (!searchTerm) return;
  if (searchTerm.length > 100) {
    throw createBadRequest('keyword must be 100 characters or less');
  }

  where[Op.or] = [
    { title: { [Op.like]: `%${searchTerm}%` } },
    { description: { [Op.like]: `%${searchTerm}%` } },
    { preConditions: { [Op.like]: `%${searchTerm}%` } },
    { expectedResults: { [Op.like]: `%${searchTerm}%` } },
  ];
}

function sortedSteps(testcase) {
  return [...(testcase.Steps || [])]
    .sort((left, right) => (left.caseSteps?.stepNo || 0) - (right.caseSteps?.stepNo || 0))
    .map((step) => ({
      id: step.id,
      stepNo: step.caseSteps?.stepNo || null,
      step: step.step,
      result: step.result,
    }));
}

function serializeCase(testcase) {
  const plain = testcase.get({ plain: true });
  return {
    id: plain.id,
    folderId: plain.folderId,
    projectId: plain.Folder?.projectId,
    title: plain.title,
    stateId: plain.state,
    state: enumUid(testRunStatus, plain.state),
    priorityId: plain.priority,
    priority: enumUid(priorities, plain.priority),
    typeId: plain.type,
    type: enumUid(testTypes, plain.type),
    automationStatusId: plain.automationStatus,
    automationStatus: enumUid(automationStatus, plain.automationStatus),
    description: plain.description || '',
    templateId: plain.template,
    template: enumUid(templates, plain.template),
    preConditions: plain.preConditions || '',
    expectedResults: plain.expectedResults || '',
    steps: sortedSteps(plain),
    tags: (plain.Tags || []).map((tag) => ({ id: tag.id, name: tag.name })),
    runCases: (plain.RunCases || []).map((runCase) => ({
      id: runCase.id,
      runId: runCase.runId,
      statusId: runCase.status,
      status: enumUid(testRunCaseStatus, runCase.status),
    })),
  };
}

function registerAssociations({ Case, Folder, Run, RunCase, Step, Tags }) {
  if (!Case.associations.Folder) Case.belongsTo(Folder, { foreignKey: 'folderId' });
  if (!Folder.associations.Cases) Folder.hasMany(Case, { foreignKey: 'folderId' });
  if (!Case.associations.Steps) Case.belongsToMany(Step, { through: 'caseSteps' });
  if (!Step.associations.Cases) Step.belongsToMany(Case, { through: 'caseSteps' });
  if (!Case.associations.Tags) {
    Case.belongsToMany(Tags, { through: 'caseTags', foreignKey: 'caseId', otherKey: 'tagId' });
  }
  if (!Tags.associations.Cases) {
    Tags.belongsToMany(Case, { through: 'caseTags', foreignKey: 'tagId', otherKey: 'caseId' });
  }
  if (!Case.associations.RunCases) Case.hasMany(RunCase, { foreignKey: 'caseId' });
  if (!RunCase.associations.Case) RunCase.belongsTo(Case, { foreignKey: 'caseId' });
  if (!RunCase.associations.Run) RunCase.belongsTo(Run, { foreignKey: 'runId' });
  if (!Run.associations.RunCases) Run.hasMany(RunCase, { foreignKey: 'runId' });
}

async function projectTagIds(sequelize, { projectId, tagIds }) {
  if (tagIds.length === 0) return null;

  const Tags = model(sequelize, 'Tags', defineTag);
  const tags = await Tags.findAll({
    attributes: ['id'],
    where: { id: { [Op.in]: tagIds }, projectId },
  });
  if (tags.length !== tagIds.length) {
    return [];
  }
  return tags.map((tag) => tag.id);
}

async function caseIdsHavingAllTags(sequelize, { projectId, tagIds }) {
  const scopedTagIds = await projectTagIds(sequelize, { projectId, tagIds });
  if (scopedTagIds === null) return null;
  if (scopedTagIds.length === 0) return [];

  const CaseTag = model(sequelize, 'caseTags', defineCaseTag);
  const rows = await CaseTag.findAll({
    attributes: ['caseId'],
    where: { tagId: { [Op.in]: scopedTagIds } },
    group: ['caseId'],
    having: sequelize.where(
      sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('tagId'))),
      scopedTagIds.length
    ),
  });
  return rows.map((row) => row.caseId);
}

function buildIncludes({ Folder, Run, RunCase, Step, Tags, projectId, includedInRunId }) {
  const runCaseInclude = {
    model: RunCase,
    attributes: ['id', 'runId', 'status'],
    include: [
      {
        model: Run,
        attributes: ['id', 'projectId'],
        required: true,
        where: { projectId },
      },
    ],
    required: false,
  };
  if (includedInRunId) {
    runCaseInclude.required = true;
    runCaseInclude.where = { runId: includedInRunId };
  }

  return [
    {
      model: Folder,
      attributes: ['id', 'projectId'],
      required: true,
      where: { projectId },
    },
    {
      model: Step,
      attributes: ['id', 'step', 'result'],
      through: { attributes: ['stepNo'] },
    },
    {
      model: Tags,
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: false,
      where: { projectId },
    },
    runCaseInclude,
  ];
}

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);

  const Case = model(sequelize, 'Case', defineCase);
  const Folder = model(sequelize, 'Folder', defineFolder);
  const Step = model(sequelize, 'Step', defineStep);
  const Tags = model(sequelize, 'Tags', defineTag);
  const Run = model(sequelize, 'Run', defineRun);
  const RunCase = model(sequelize, 'RunCase', defineRunCase);
  registerAssociations({ Case, Folder, Run, RunCase, Step, Tags });

  router.get('/', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(singleQueryValue(req.query.projectId, 'projectId'), 'projectId');
      const priority = parseEnumList(req.query.priority, priorities, 'priority');
      const type = parseEnumList(req.query.type, testTypes, 'type');
      const tagIds = parsePositiveIntegerList(req.query.tagIds, 'tagIds');
      const includedInRunId = req.query.includedInRunId
        ? parsePositiveSafeInteger(singleQueryValue(req.query.includedInRunId, 'includedInRunId'), 'includedInRunId')
        : null;
      const folderId = req.query.folderId
        ? parsePositiveSafeInteger(singleQueryValue(req.query.folderId, 'folderId'), 'folderId')
        : null;
      const includeSubfolders = parseOptionalBooleanQuery(req.query.includeSubfolders, 'includeSubfolders');

      const structuredWhere = buildCaseSearchWhere({
        priority,
        type,
      });
      const where = sequelizeWhereFromStructuredWhere(structuredWhere);
      const scope = folderId ? await getFolderScope(sequelize, { folderId, includeSubfolders, projectId }) : null;
      if (folderId && !scope) {
        return res.json({ cases: [] });
      }
      if (scope) {
        where.folderId = { [Op.in]: scope.folderIds };
      }
      addKeywordFilter(where, req.query.keyword);

      const taggedCaseIds = await caseIdsHavingAllTags(sequelize, { projectId, tagIds });
      if (taggedCaseIds) {
        where.id = { [Op.in]: taggedCaseIds };
      }

      const cases = await Case.findAll({
        where,
        include: buildIncludes({ Folder, Run, RunCase, Step, Tags, projectId, includedInRunId }),
        order: [['id', 'ASC']],
      });

      const projectFolderPaths = scope ? null : await getProjectFolderPaths(sequelize, { projectId });
      res.json({
        cases: cases.map((testcase) => {
          const serialized = serializeCase(testcase);
          const folderPath = scope
            ? folderPathFor(scope, serialized.folderId)
            : projectFolderPaths.get(serialized.folderId) || [];
          return { ...serialized, folderPath };
        }),
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  router.get('/:caseId', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(singleQueryValue(req.query.projectId, 'projectId'), 'projectId');
      const caseId = parsePositiveSafeInteger(req.params.caseId, 'caseId');
      const testcase = await Case.findOne({
        where: { id: caseId },
        include: buildIncludes({ Folder, Run, RunCase, Step, Tags, projectId, includedInRunId: null }),
      });

      if (!testcase) {
        return res.status(404).json({ error: 'Case not found' });
      }

      return res.json({ case: serializeCase(testcase) });
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  return router;
}

export { buildCaseSearchWhere };
