import { DataTypes } from 'sequelize';

import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import { createBadRequest } from './queryParams.js';

function folderModel(sequelize) {
  return sequelize.models.Folder || defineFolder(sequelize, DataTypes);
}

function caseModel(sequelize) {
  return sequelize.models.Case || defineCase(sequelize, DataTypes);
}

function buildFolderIndexes(folders) {
  const foldersById = new Map();
  const foldersByParentId = new Map();

  for (const folder of folders) {
    foldersById.set(folder.id, folder);
    const parentId = folder.parentFolderId ?? null;
    const siblings = foldersByParentId.get(parentId) || [];
    siblings.push(folder);
    foldersByParentId.set(parentId, siblings);
  }

  return { foldersById, foldersByParentId };
}

async function getFolderScope(sequelize, { folderId, includeSubfolders = true, projectId }) {
  const Folder = folderModel(sequelize);
  const selectedFolder = await Folder.findByPk(folderId);
  if (!selectedFolder) return null;
  if (projectId !== undefined && String(selectedFolder.projectId) !== String(projectId)) {
    throw createBadRequest('folderId must belong to projectId');
  }

  const folders = await Folder.findAll({ where: { projectId: selectedFolder.projectId } });
  const { foldersById, foldersByParentId } = buildFolderIndexes(folders);
  const pathsByFolderId = new Map();

  const pathFor = (folder, visiting = new Set()) => {
    if (pathsByFolderId.has(folder.id)) {
      return pathsByFolderId.get(folder.id);
    }
    if (visiting.has(folder.id)) {
      throw new Error(`Folder tree contains a cycle at folder ${folder.id}`);
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(folder.id);
    const parent = folder.parentFolderId ? foldersById.get(folder.parentFolderId) : null;
    const folderPath = parent ? [...pathFor(parent, nextVisiting), folder.name] : [folder.name];
    pathsByFolderId.set(folder.id, folderPath);
    return folderPath;
  };

  const folderIds = [];
  const visit = (folder, visiting = new Set()) => {
    if (visiting.has(folder.id)) {
      throw new Error(`Folder tree contains a cycle at folder ${folder.id}`);
    }
    const nextVisiting = new Set(visiting);
    nextVisiting.add(folder.id);
    folderIds.push(folder.id);
    pathFor(folder);
    if (!includeSubfolders) return;
    for (const child of foldersByParentId.get(folder.id) || []) {
      visit(child, nextVisiting);
    }
  };
  visit(selectedFolder);

  return { selectedFolder, folderIds, pathsByFolderId };
}

async function getProjectFolderPaths(sequelize, { projectId }) {
  const Folder = folderModel(sequelize);
  const folders = await Folder.findAll({ where: { projectId } });
  const { foldersById } = buildFolderIndexes(folders);
  const pathsByFolderId = new Map();

  const pathFor = (folder, visiting = new Set()) => {
    if (pathsByFolderId.has(folder.id)) {
      return pathsByFolderId.get(folder.id);
    }
    if (visiting.has(folder.id)) {
      throw new Error(`Folder tree contains a cycle at folder ${folder.id}`);
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(folder.id);
    const parent = folder.parentFolderId ? foldersById.get(folder.parentFolderId) : null;
    const folderPath = parent ? [...pathFor(parent, nextVisiting), folder.name] : [folder.name];
    pathsByFolderId.set(folder.id, folderPath);
    return folderPath;
  };

  for (const folder of folders) {
    pathFor(folder);
  }

  return pathsByFolderId;
}

async function getProjectFolderCaseCounts(sequelize, { projectId }) {
  const Folder = folderModel(sequelize);
  const Case = caseModel(sequelize);
  const folders = await Folder.findAll({ where: { projectId } });
  const folderIds = folders.map((folder) => folder.id);
  const cases = folderIds.length > 0 ? await Case.findAll({ attributes: ['folderId'], where: { folderId: folderIds } }) : [];
  const { foldersByParentId } = buildFolderIndexes(folders);
  const directCaseCountsByFolderId = new Map();

  for (const testCase of cases) {
    directCaseCountsByFolderId.set(testCase.folderId, (directCaseCountsByFolderId.get(testCase.folderId) || 0) + 1);
  }

  const caseCountsByFolderId = new Map();
  const scopeCountFor = (folder, visiting = new Set()) => {
    if (caseCountsByFolderId.has(folder.id)) {
      return caseCountsByFolderId.get(folder.id);
    }
    if (visiting.has(folder.id)) {
      throw new Error(`Folder tree contains a cycle at folder ${folder.id}`);
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(folder.id);
    const count =
      (directCaseCountsByFolderId.get(folder.id) || 0) +
      (foldersByParentId.get(folder.id) || []).reduce((total, child) => total + scopeCountFor(child, nextVisiting), 0);
    caseCountsByFolderId.set(folder.id, count);
    return count;
  };

  for (const folder of folders) {
    scopeCountFor(folder);
  }

  return { caseCountsByFolderId, directCaseCountsByFolderId };
}

function folderPathFor(scope, folderId) {
  return scope?.pathsByFolderId.get(folderId) || [];
}

export { folderPathFor, getFolderScope, getProjectFolderCaseCounts, getProjectFolderPaths };
