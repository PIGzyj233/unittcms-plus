import express from 'express';
import { DataTypes, Op } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineComment from '../../models/comments.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import defineTag from '../../models/tags.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { folderPathFor, getFolderScope, getProjectFolderPaths } from '../lib/folderScope.js';
import { parseOptionalBooleanQuery, singleQueryValue } from '../lib/queryParams.js';

function parseIntegerListQuery(value, label) {
  if (value === undefined) return [];

  return singleQueryValue(value, label)
    .split(',')
    .map((item) => parseInt(item.trim(), 10))
    .filter((item) => !isNaN(item));
}

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromRunId } = visibilityMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Comment = defineComment(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);

  RunCase.belongsTo(Case, { foreignKey: 'caseId' });
  Case.belongsTo(Folder, { foreignKey: 'folderId' });
  Case.belongsToMany(Tags, { through: 'caseTags', foreignKey: 'caseId', otherKey: 'tagId' });
  Tags.belongsToMany(Case, { through: 'caseTags', foreignKey: 'tagId', otherKey: 'caseId' });

  router.get('/', verifySignedIn, verifyProjectVisibleFromRunId, async (req, res) => {
    const { runId, search, folderId, includeSubfolders } = req.query;

    if (!runId) {
      return res.status(400).json({ error: 'run is required' });
    }

    try {
      const run = await Run.findByPk(runId);
      if (!run) {
        return res.status(404).send('Run not found');
      }

      const scope = folderId
        ? await getFolderScope(sequelize, {
            folderId,
            projectId: run.projectId,
            includeSubfolders: parseOptionalBooleanQuery(includeSubfolders, 'includeSubfolders'),
          })
        : null;
      if (folderId && !scope) {
        return res.json([]);
      }

      const runCaseWhere = {
        runId: runId,
      };
      const statusValues = parseIntegerListQuery(req.query.status, 'status');
      if (statusValues.length > 0) {
        runCaseWhere.status = { [Op.in]: statusValues };
      }

      const caseWhere = {};
      if (scope) {
        caseWhere.folderId = { [Op.in]: scope.folderIds };
      }
      const searchTerm = search === undefined ? '' : singleQueryValue(search, 'search').trim();
      if (searchTerm.length > 100) {
        return res.status(400).json({ error: 'too long search param' });
      }
      if (searchTerm.length >= 1) {
        caseWhere[Op.or] = [
          { title: { [Op.like]: `%${searchTerm}%` } },
          { description: { [Op.like]: `%${searchTerm}%` } },
        ];
      }

      const priorityValues = parseIntegerListQuery(req.query.priority, 'priority');
      if (priorityValues.length > 0) {
        caseWhere.priority = { [Op.in]: priorityValues };
      }

      const typeValues = parseIntegerListQuery(req.query.type, 'type');
      if (typeValues.length > 0) {
        caseWhere.type = { [Op.in]: typeValues };
      }

      const tagInclude = {
        model: Tags,
        attributes: ['id', 'name'],
        through: { attributes: [] },
      };
      const tagValues = parseIntegerListQuery(req.query.tag, 'tag');
      if (tagValues.length > 0) {
        tagInclude.where = { id: { [Op.in]: tagValues } };
        tagInclude.required = true;
      }

      const runCases = await RunCase.findAll({
        where: runCaseWhere,
        include: [
          {
            model: Case,
            where: caseWhere,
            include: [tagInclude],
          },
        ],
        order: [['id', 'ASC']],
      });

      const runCaseIds = runCases.map((runCase) => runCase.id);
      const commentCounts =
        runCaseIds.length > 0
          ? await Comment.findAll({
              attributes: ['commentableId', [sequelize.fn('COUNT', sequelize.col('id')), 'commentCount']],
              where: {
                commentableType: 'RunCase',
                commentableId: { [Op.in]: runCaseIds },
              },
              group: ['commentableId'],
            })
          : [];
      const commentCountByRunCaseId = new Map(
        commentCounts.map((count) => {
          const plain = count.get({ plain: true });
          return [plain.commentableId, Number(plain.commentCount)];
        })
      );
      const folderPaths = scope ? null : await getProjectFolderPaths(sequelize, { projectId: run.projectId });

      res.json(
        runCases.map((runCase) => {
          const plain = runCase.get({ plain: true });
          return {
            ...plain,
            editState: 'notChanged',
            commentCount: commentCountByRunCaseId.get(plain.id) || 0,
            Case: plain.Case
              ? {
                  ...plain.Case,
                  folderPath: scope
                    ? folderPathFor(scope, plain.Case.folderId)
                    : folderPaths.get(plain.Case.folderId) || [],
                }
              : plain.Case,
          };
        })
      );
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).send(error.status ? error.message : 'Internal Server Error');
    }
  });

  return router;
}
