import { DataTypes } from 'sequelize';

import defineCase from '../../../models/cases.js';
import defineFolder from '../../../models/folders.js';

const ensureFolderPathOperationType = 'ensure-folder-path';
const folderDetailMaxLength = 500;
const ensureFolderPathLocks = new Map();

function folderInputError(message, code) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

function normalizeFolderSegment(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateFolderPathSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw folderInputError('path must contain at least one segment', 'FOLDER_PATH_REQUIRED');
  }
  if (segments.length > 4) {
    throw folderInputError('folder paths are limited to four levels', 'FOLDER_PATH_TOO_DEEP');
  }

  return segments.map((segment) => {
    const normalized = normalizeFolderSegment(segment);
    if (!normalized || normalized === '.' || normalized === '..') {
      throw folderInputError('folder names must not be empty, ".", or ".."', 'FOLDER_NAME_INVALID');
    }
    if (normalized.includes('/') || normalized.includes('\\')) {
      throw folderInputError('folder names must not contain path separators', 'FOLDER_NAME_SEPARATOR');
    }
    if (normalized.length > 80) {
      throw folderInputError('folder names must be 80 characters or less', 'FOLDER_NAME_TOO_LONG');
    }
    return normalized;
  });
}

function folderModel(sequelize) {
  return sequelize.models.Folder || defineFolder(sequelize, DataTypes);
}

function caseModel(sequelize) {
  return sequelize.models.Case || defineCase(sequelize, DataTypes);
}

function serializeFolder(folder, extras = {}) {
  return {
    id: folder.id,
    name: folder.name,
    detail: folder.detail,
    parentFolderId: folder.parentFolderId,
    projectId: folder.projectId,
    ...extras,
  };
}

function normalizeFolderDetail(detail) {
  if (detail === undefined || detail === null) return null;

  const normalized = String(detail).trim();
  if (normalized.length > folderDetailMaxLength) {
    throw folderInputError('folder detail must be 500 characters or less', 'FOLDER_DETAIL_TOO_LONG');
  }
  return normalized || null;
}

function folderWhere({ projectId, parentFolderId, name }) {
  return { projectId, parentFolderId: parentFolderId ?? null, name };
}

async function withEnsureFolderPathLock(projectId, task) {
  const key = String(projectId);
  const previous = ensureFolderPathLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const lock = previous.catch(() => {}).then(() => next);
  ensureFolderPathLocks.set(key, lock);

  await previous.catch(() => {});

  try {
    return await task();
  } finally {
    release();
    if (ensureFolderPathLocks.get(key) === lock) {
      ensureFolderPathLocks.delete(key);
    }
  }
}

async function getFolderTree(sequelize, { projectId }) {
  const Folder = folderModel(sequelize);
  const Case = caseModel(sequelize);
  const folders = await Folder.findAll({
    where: { projectId },
    order: [
      ['parentFolderId', 'ASC'],
      ['name', 'ASC'],
    ],
  });
  const folderIds = folders.map((folder) => folder.id);
  const cases = folderIds.length > 0 ? await Case.findAll({ where: { folderId: folderIds } }) : [];
  const caseCounts = new Map();

  for (const testCase of cases) {
    caseCounts.set(testCase.folderId, (caseCounts.get(testCase.folderId) || 0) + 1);
  }

  return folders.map((folder) => serializeFolder(folder, { caseCount: caseCounts.get(folder.id) || 0 }));
}

async function planEnsureFolderPath(sequelize, { projectId, path }, options = {}) {
  const Folder = folderModel(sequelize);
  const normalizedPath = validateFolderPathSegments(path);
  const created = [];
  const reused = [];
  let parentFolderId = null;
  let hasMissingAncestor = false;

  for (const [index, name] of normalizedPath.entries()) {
    if (hasMissingAncestor) {
      created.push({ name, parentPath: normalizedPath.slice(0, index), parentWillBeCreated: true });
      continue;
    }

    const existing = await Folder.findOne({
      ...options,
      where: folderWhere({ projectId, parentFolderId, name }),
      order: [['id', 'ASC']],
    });

    if (existing) {
      reused.push(serializeFolder(existing));
      parentFolderId = existing.id;
      continue;
    }

    created.push({
      name,
      parentFolderId,
      parentPath: normalizedPath.slice(0, index),
      parentWillBeCreated: false,
    });
    hasMissingAncestor = true;
  }

  return { path: normalizedPath, created, reused };
}

async function findFolderByPathSegment(Folder, { projectId, parentFolderId, name }, options = {}) {
  return Folder.findOne({
    ...options,
    where: folderWhere({ projectId, parentFolderId, name }),
    order: [['id', 'ASC']],
  });
}

async function createFolderAfterRecheck(Folder, values, options = {}) {
  const existing = await findFolderByPathSegment(Folder, values, options);
  if (existing) return { folder: existing, created: false };

  try {
    return { folder: await Folder.create(values, options), created: true };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeConstraintError') {
      const raced = await findFolderByPathSegment(Folder, values, options);
      if (raced) return { folder: raced, created: false };
    }
    throw error;
  }
}

async function ensureFolderPath(sequelize, { projectId, path, detail }, options = {}) {
  const Folder = folderModel(sequelize);
  const normalizedPath = validateFolderPathSegments(path);
  const normalizedDetail = normalizeFolderDetail(detail);
  const created = [];
  const reused = [];
  let parentFolderId = null;
  let finalFolder = null;

  for (const [index, name] of normalizedPath.entries()) {
    const existing = await findFolderByPathSegment(Folder, { projectId, parentFolderId, name }, options);

    if (existing) {
      reused.push(serializeFolder(existing));
      parentFolderId = existing.id;
      finalFolder = existing;
      continue;
    }

    const { folder, created: folderWasCreated } = await createFolderAfterRecheck(
      Folder,
      {
        name,
        detail: index === normalizedPath.length - 1 ? normalizedDetail : null,
        parentFolderId,
        projectId,
      },
      options
    );
    if (folderWasCreated) {
      created.push(serializeFolder(folder));
    } else {
      reused.push(serializeFolder(folder));
    }
    parentFolderId = folder.id;
    finalFolder = folder;
  }

  return {
    path: normalizedPath,
    folder: serializeFolder(finalFolder),
    created,
    reused,
  };
}

function buildEnsureFolderPathPayload(body) {
  return {
    path: validateFolderPathSegments(body?.path),
    detail: normalizeFolderDetail(body?.detail),
  };
}

function buildEnsureFolderPathHashPayload(projectId, payload) {
  return { projectId, path: payload.path, detail: payload.detail };
}

export {
  buildEnsureFolderPathHashPayload,
  buildEnsureFolderPathPayload,
  ensureFolderPath,
  ensureFolderPathOperationType,
  getFolderTree,
  normalizeFolderDetail,
  normalizeFolderSegment,
  planEnsureFolderPath,
  validateFolderPathSegments,
  withEnsureFolderPathLock,
};
