import express from 'express';
import { DataTypes } from 'sequelize';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { validateParentFolderInProject } from '../lib/folderTree.js';

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);
  const Folder = defineFolder(sequelize, DataTypes);

  router.post('/', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = req.query.projectId;
      const { name, detail, parentFolderId } = req.body;
      if (!name || !projectId) {
        return res.status(400).json({ error: 'Name and projectId are required' });
      }
      const parent = await validateParentFolderInProject(sequelize, { projectId, parentFolderId });

      const newFolder = await Folder.create({
        name,
        detail,
        projectId,
        parentFolderId: parent ? parent.id : null,
      });

      res.json(newFolder);
    } catch (error) {
      console.error('Error creating new folder:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
    }
  });

  return router;
}
