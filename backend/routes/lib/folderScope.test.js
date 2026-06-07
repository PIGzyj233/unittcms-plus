import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import defineFolder from '../../models/folders.js';
import { getFolderScope } from './folderScope.js';

describe('Folder Scope traversal', () => {
  let sequelize;
  let Folder;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    Folder = defineFolder(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('rejects cyclic folder trees instead of recursing indefinitely', async () => {
    const folder = await Folder.create({ name: 'Login', projectId: 1 });
    await folder.update({ parentFolderId: folder.id });

    await expect(getFolderScope(sequelize, { folderId: folder.id })).rejects.toThrow(
      'Folder tree contains a cycle at folder'
    );
  });
});
