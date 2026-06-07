import express from 'express';
import { DataTypes } from 'sequelize';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { getProjectFolderCaseCounts } from '../lib/folderScope.js';

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const Folder = defineFolder(sequelize, DataTypes);

  router.get('/', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      const folders = await Folder.findAll({
        where: {
          projectId: projectId,
        },
      });
      const { caseCountsByFolderId, directCaseCountsByFolderId } = await getProjectFolderCaseCounts(sequelize, {
        projectId,
      });
      res.json(
        folders.map((folder) => ({
          ...(typeof folder.get === 'function' ? folder.get({ plain: true }) : folder),
          caseCount: caseCountsByFolderId.get(folder.id) || 0,
          directCaseCount: directCaseCountsByFolderId.get(folder.id) || 0,
        }))
      );
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
