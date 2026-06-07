import { DataTypes } from 'sequelize';

import defineFolder from '../../models/folders.js';
import { createBadRequest } from './queryParams.js';

function folderModel(sequelize) {
  return sequelize.models.Folder || defineFolder(sequelize, DataTypes);
}

async function validateParentFolderInProject(sequelize, { projectId, parentFolderId }) {
  if (parentFolderId === undefined || parentFolderId === null || parentFolderId === '') return null;

  const Folder = folderModel(sequelize);
  const parent = await Folder.findByPk(parentFolderId);
  if (!parent || String(parent.projectId) !== String(projectId)) {
    throw createBadRequest('parentFolderId must belong to the same project');
  }

  return parent;
}

async function validateFolderParentChange(sequelize, { folder, projectId, parentFolderId }) {
  const Folder = folderModel(sequelize);
  if (String(projectId) !== String(folder.projectId)) {
    throw createBadRequest('projectId cannot be changed');
  }
  if (parentFolderId === undefined) return null;
  if (parentFolderId === null || parentFolderId === '') return null;
  if (String(parentFolderId) === String(folder.id)) {
    throw createBadRequest('parentFolderId must not be the folder itself');
  }

  const parent = await validateParentFolderInProject(sequelize, { projectId, parentFolderId });
  let ancestor = parent;
  const visited = new Set();
  while (ancestor) {
    if (String(ancestor.id) === String(folder.id)) {
      throw createBadRequest('parentFolderId must not be a descendant of the folder');
    }
    if (!ancestor.parentFolderId) break;
    if (visited.has(ancestor.id)) {
      throw createBadRequest('folder tree contains a cycle');
    }
    visited.add(ancestor.id);
    ancestor = await Folder.findByPk(ancestor.parentFolderId);
  }

  return parent;
}

export { validateFolderParentChange, validateParentFolderInProject };
