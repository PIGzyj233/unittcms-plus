import { DataTypes, Op } from 'sequelize';

import { testRunCaseStatus, testRunStatus } from '../../../config/enums.js';
import defineCase from '../../../models/cases.js';
import defineFolder from '../../../models/folders.js';
import defineRunCase from '../../../models/runCases.js';
import defineRun from '../../../models/runs.js';

const createRunWithCasesOperationType = 'create-run-with-cases';
const addCasesToRunOperationType = 'add-cases-to-run';
const runWriteLocks = new Map();

function runInputError(message, code, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function model(sequelize, name, defineModel) {
  return sequelize.models[name] || defineModel(sequelize, DataTypes);
}

function registerAssociations({ Case, Folder, Run, RunCase }) {
  if (!Case.associations.Folder) Case.belongsTo(Folder, { foreignKey: 'folderId' });
  if (!Folder.associations.Cases) Folder.hasMany(Case, { foreignKey: 'folderId' });
  if (!Run.associations.RunCases) Run.hasMany(RunCase, { foreignKey: 'runId' });
  if (!RunCase.associations.Run) RunCase.belongsTo(Run, { foreignKey: 'runId' });
  if (!RunCase.associations.Case) RunCase.belongsTo(Case, { foreignKey: 'caseId' });
}

function runModels(sequelize) {
  const Case = model(sequelize, 'Case', defineCase);
  const Folder = model(sequelize, 'Folder', defineFolder);
  const Run = model(sequelize, 'Run', defineRun);
  const RunCase = model(sequelize, 'RunCase', defineRunCase);
  registerAssociations({ Case, Folder, Run, RunCase });
  return { Case, Folder, Run, RunCase };
}

function parsePositiveSafeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw runInputError(`${label} must be a positive integer`, 'RUN_POSITIVE_INTEGER_REQUIRED');
  }
  return parsed;
}

function normalizeString(value, label, { required = false, maxLength = 255 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw runInputError(`${label} is required`, 'RUN_STRING_REQUIRED');
    return '';
  }

  const normalized = String(value).trim();
  if (required && !normalized) throw runInputError(`${label} is required`, 'RUN_STRING_REQUIRED');
  if (normalized.length > maxLength) {
    throw runInputError(`${label} must be ${maxLength} characters or less`, 'RUN_STRING_TOO_LONG');
  }
  return normalized;
}

function parseCaseIds(caseIds) {
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    throw runInputError('caseIds must contain at least one case id', 'RUN_CASE_IDS_REQUIRED');
  }

  return [...new Set(caseIds.map((caseId, index) => parsePositiveSafeInteger(caseId, `caseIds[${index}]`)))];
}

function parseRunState(state = 'new') {
  if (typeof state === 'number') {
    if (Number.isSafeInteger(state) && state >= 0 && state < testRunStatus.length) return state;
    throw runInputError(`state must be one of: ${testRunStatus.join(', ')}`, 'RUN_STATE_INVALID');
  }

  if (/^\d+$/.test(String(state))) {
    return parseRunState(Number(state));
  }

  const index = testRunStatus.findIndex((value) => value === state);
  if (index !== -1) return index;

  throw runInputError(`state must be one of: ${testRunStatus.join(', ')}`, 'RUN_STATE_INVALID');
}

function serializeRunState(state) {
  return testRunStatus[parseRunState(state)];
}

function defaultRunCaseStatus() {
  return testRunCaseStatus.indexOf('untested');
}

function buildCreateRunPayload({
  name,
  configurations = '',
  description = '',
  state = 'new',
  caseIds,
  allowPartial = false,
}) {
  return {
    name: normalizeString(name, 'name', { required: true }),
    configurations: normalizeString(configurations, 'configurations', { maxLength: 255 }),
    description: normalizeString(description, 'description', { maxLength: 255 }),
    state: serializeRunState(state),
    caseIds: parseCaseIds(caseIds),
    allowPartial: allowPartial === true,
  };
}

function buildAddCasesPayload({ caseIds, allowPartial = false }) {
  return {
    caseIds: parseCaseIds(caseIds),
    allowPartial: allowPartial === true,
  };
}

function buildCreateRunHashPayload(projectId, payload) {
  return { projectId, ...payload };
}

function buildAddCasesHashPayload(projectId, runId, payload) {
  return { projectId, runId, ...payload };
}

async function findProjectCases(sequelize, { projectId, caseIds }, options = {}) {
  const { Case, Folder } = runModels(sequelize);

  return Case.findAll({
    ...options,
    attributes: ['id'],
    where: { id: { [Op.in]: caseIds } },
    include: [{ model: Folder, attributes: ['id', 'projectId'], required: true, where: { projectId } }],
  });
}

async function assertProjectCaseIds(sequelize, { projectId, caseIds }, options = {}) {
  const cases = await findProjectCases(sequelize, { projectId, caseIds }, options);
  if (cases.length !== caseIds.length) {
    throw runInputError(
      'All caseIds must reference formal cases in the requested project',
      'RUN_CASE_IDS_PROJECT_MISMATCH'
    );
  }
}

async function assertProjectRun(sequelize, { projectId, runId }, options = {}) {
  const { Run } = runModels(sequelize);
  const run = await Run.findOne({ ...options, where: { id: runId, projectId } });
  if (!run) throw runInputError('Run not found', 'RUN_NOT_FOUND', 404);
  return run;
}

async function planCreateRunWithCases(sequelize, { projectId, payload }, options = {}) {
  await assertProjectCaseIds(sequelize, { projectId, caseIds: payload.caseIds }, options);
  return {
    operationType: createRunWithCasesOperationType,
    projectId,
    name: payload.name,
    state: payload.state,
    caseIds: payload.caseIds,
    allowPartial: payload.allowPartial,
  };
}

async function createRunWithCases(sequelize, { projectId, payload }, options = {}) {
  const { Run, RunCase } = runModels(sequelize);
  const status = defaultRunCaseStatus();
  const create = async (transaction) => {
    const transactionOptions = { transaction };
    await assertProjectCaseIds(sequelize, { projectId, caseIds: payload.caseIds }, transactionOptions);
    const run = await Run.create(
      {
        name: payload.name,
        configurations: payload.configurations,
        description: payload.description,
        state: parseRunState(payload.state),
        projectId,
      },
      transactionOptions
    );
    await RunCase.bulkCreate(
      payload.caseIds.map((caseId) => ({ runId: run.id, caseId, status })),
      transactionOptions
    );
    return {
      operationType: createRunWithCasesOperationType,
      projectId,
      runId: run.id,
      caseIds: payload.caseIds,
    };
  };

  if (options.transaction) return create(options.transaction);
  return sequelize.transaction((transaction) => create(transaction));
}

async function existingRunCaseIds(sequelize, { runId, caseIds }, options = {}) {
  const { RunCase } = runModels(sequelize);
  const rows = await RunCase.findAll({
    ...options,
    attributes: ['caseId'],
    where: { runId, caseId: { [Op.in]: caseIds } },
  });
  return new Set(rows.map((row) => row.caseId));
}

async function planAddCasesToRun(sequelize, { projectId, runId, payload }, options = {}) {
  await assertProjectRun(sequelize, { projectId, runId }, options);
  await assertProjectCaseIds(sequelize, { projectId, caseIds: payload.caseIds }, options);
  const reused = await existingRunCaseIds(sequelize, { runId, caseIds: payload.caseIds }, options);

  return {
    operationType: addCasesToRunOperationType,
    projectId,
    runId,
    caseIds: payload.caseIds,
    addedCaseIds: payload.caseIds.filter((caseId) => !reused.has(caseId)),
    reusedCaseIds: payload.caseIds.filter((caseId) => reused.has(caseId)),
    allowPartial: payload.allowPartial,
  };
}

async function addCasesToRun(sequelize, { projectId, runId, payload }, options = {}) {
  const { RunCase } = runModels(sequelize);
  const status = defaultRunCaseStatus();
  const add = async (transaction) => {
    const transactionOptions = { transaction };
    const plan = await planAddCasesToRun(sequelize, { projectId, runId, payload }, transactionOptions);
    const addedCaseIds = [];
    const reusedCaseIds = [...plan.reusedCaseIds];

    for (const caseId of plan.addedCaseIds) {
      try {
        await RunCase.create({ runId, caseId, status }, transactionOptions);
        addedCaseIds.push(caseId);
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError' && error.name !== 'SequelizeConstraintError') {
          throw error;
        }
        reusedCaseIds.push(caseId);
      }
    }

    return {
      ...plan,
      addedCaseIds,
      reusedCaseIds,
    };
  };

  if (options.transaction) return add(options.transaction);
  return sequelize.transaction((transaction) => add(transaction));
}

async function withRunWriteLock(key, task) {
  const previous = runWriteLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const lock = previous.catch(() => {}).then(() => next);
  runWriteLocks.set(key, lock);

  await previous.catch(() => {});

  try {
    return await task();
  } finally {
    release();
    if (runWriteLocks.get(key) === lock) {
      runWriteLocks.delete(key);
    }
  }
}

export {
  addCasesToRun,
  addCasesToRunOperationType,
  buildAddCasesHashPayload,
  buildAddCasesPayload,
  buildCreateRunHashPayload,
  buildCreateRunPayload,
  createRunWithCases,
  createRunWithCasesOperationType,
  defaultRunCaseStatus,
  parseRunState,
  planAddCasesToRun,
  planCreateRunWithCases,
  withRunWriteLock,
};
