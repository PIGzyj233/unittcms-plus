import express from 'express';
import { DataTypes, Op } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineTag from '../../models/tags.js';
import { folderPathFor, getFolderScope } from '../lib/folderScope.js';
import { parseOptionalBooleanQuery } from '../lib/queryParams.js';

import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromFolderId } = visibilityMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);

  Case.belongsToMany(Tags, { through: 'caseTags', foreignKey: 'caseId', otherKey: 'tagId' });
  Tags.belongsToMany(Case, { through: 'caseTags', foreignKey: 'tagId', otherKey: 'caseId' });

  router.get('/', verifySignedIn, verifyProjectVisibleFromFolderId, async (req, res) => {
    const { folderId, includeSubfolders, search, priority, type, tag } = req.query;

    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    try {
      const includeDescendants = parseOptionalBooleanQuery(includeSubfolders, 'includeSubfolders');
      const scope = await getFolderScope(sequelize, { folderId, includeSubfolders: includeDescendants });
      if (!scope) {
        return res.json([]);
      }

      const whereClause = {
        folderId: { [Op.in]: scope.folderIds },
      };

      if (search) {
        const searchTerm = search.trim();

        if (searchTerm.length > 100) {
          return res.status(400).json({ error: 'too long search param' });
        }

        if (searchTerm.length >= 1) {
          whereClause[Op.or] = [
            { title: { [Op.like]: `%${searchTerm}%` } },
            { description: { [Op.like]: `%${searchTerm}%` } },
          ];
        }
      }

      if (priority) {
        const priorityValues = priority
          .split(',')
          .map((p) => parseInt(p.trim(), 10))
          .filter((p) => !isNaN(p));
        if (priorityValues.length > 0) {
          whereClause.priority = { [Op.in]: priorityValues };
        }
      }

      if (type) {
        const typeValues = type
          .split(',')
          .map((t) => parseInt(t.trim(), 10))
          .filter((t) => !isNaN(t));
        if (typeValues.length > 0) {
          whereClause.type = { [Op.in]: typeValues };
        }
      }

      const tagInclude = {
        model: Tags,
        attributes: ['id', 'name'],
        through: { attributes: [] },
      };

      if (tag) {
        const tagIds = tag
          .split(',')
          .map((t) => parseInt(t.trim(), 10))
          .filter((t) => !isNaN(t));

        if (tagIds.length > 0) {
          tagInclude.where = { id: { [Op.in]: tagIds } };
          tagInclude.required = true;
        }
      }

      const cases = await Case.findAll({
        where: whereClause,
        include: [tagInclude],
        order: [['id', 'ASC']],
      });
      res.json(
        cases.map((testcase) => {
          const plain = typeof testcase.get === 'function' ? testcase.get({ plain: true }) : testcase;
          return { ...plain, folderPath: folderPathFor(scope, plain.folderId) };
        })
      );
    } catch (error) {
      console.error(error);
      res
        .status(error.status || 500)
        .json(error.status ? { error: error.message } : { error: 'Internal Server Error' });
    }
  });

  return router;
}
