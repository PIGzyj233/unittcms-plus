import express from 'express';
import { DataTypes } from 'sequelize';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { validateFolderParentChange } from '../lib/folderTree.js';

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromFolderId } = editableMiddleware(sequelize);
  const Folder = defineFolder(sequelize, DataTypes);

  router.put('/:folderId', verifySignedIn, verifyProjectDeveloperFromFolderId, async (req, res) => {
    const folderId = req.params.folderId;
    const { name, detail, projectId, parentFolderId } = req.body;
    try {
      const folder = await Folder.findByPk(folderId);
      if (!folder) {
        return res.status(404).send('Folder not found');
      }
      const parent = await validateFolderParentChange(sequelize, { folder, projectId, parentFolderId });
      await folder.update({
        name,
        detail,
        projectId,
        parentFolderId: parentFolderId === undefined ? undefined : parent ? parent.id : null,
      });
      res.json(folder);
    } catch (error) {
      console.error(error);
      res
        .status(error.status || 500)
        .json(error.status ? { error: error.message } : { error: 'Internal Server Error' });
    }
  });

  return router;
}
