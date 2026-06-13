import express from 'express';
import { DataTypes, Op } from 'sequelize';
import Papa from 'papaparse';
import defineCase from '../../models/cases.js';
import defineCaseTag from '../../models/caseTags.js';
import defineStep from '../../models/steps.js';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { contentDisposition, toSafeFileName } from '../../config/contentDisposition.js';
import { testRunStatus, priorities, testTypes, automationStatus, templates } from '../../config/enums.js';
import { folderPathFor, getFolderScope } from '../lib/folderScope.js';
import { parseOptionalBooleanQuery } from '../lib/queryParams.js';

export default function (sequelize) {
  const router = express.Router();
  const Case = defineCase(sequelize, DataTypes);
  const CaseTag = defineCaseTag(sequelize, DataTypes);
  const Step = defineStep(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  Case.belongsTo(Folder, { foreignKey: 'folderId' });
  Case.belongsToMany(Step, { through: 'caseSteps' });
  Step.belongsToMany(Case, { through: 'caseSteps' });
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromFolderId } = visibilityMiddleware(sequelize);

  router.get('/download', verifySignedIn, verifyProjectVisibleFromFolderId, async (req, res) => {
    const { folderId, includeSubfolders, search, priority, type, caseType, tag } = req.query;

    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    if (!type) {
      return res.status(400).json({ error: 'download type is required' });
    }

    try {
      const folder = await Folder.findByPk(folderId);
      if (!folder) {
        return res.status(404).send('Folder not found');
      }

      const folderName = toSafeFileName(folder.name);
      const filename = `${folderName}.${type}`;
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Disposition', contentDisposition(filename));

      const includeDescendants = parseOptionalBooleanQuery(includeSubfolders, 'includeSubfolders');
      const scope = await getFolderScope(sequelize, { folderId, includeSubfolders: includeDescendants });

      const whereClause = { folderId: { [Op.in]: scope.folderIds } };

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

      if (caseType) {
        const typeValues = caseType
          .split(',')
          .map((t) => parseInt(t.trim(), 10))
          .filter((t) => !isNaN(t));
        if (typeValues.length > 0) {
          whereClause.type = { [Op.in]: typeValues };
        }
      }

      if (tag) {
        const tagIds = tag
          .split(',')
          .map((t) => parseInt(t.trim(), 10))
          .filter((t) => !isNaN(t));
        if (tagIds.length > 0) {
          const rows = await CaseTag.findAll({
            attributes: ['caseId'],
            where: { tagId: { [Op.in]: tagIds } },
            group: ['caseId'],
          });
          whereClause.id = { [Op.in]: rows.map((row) => row.caseId) };
        }
      }

      const cases = await Case.findAll({
        attributes: { exclude: ['createdAt', 'updatedAt', 'caseSteps'] },
        include: [
          {
            model: Step,
            through: { attributes: [] },
            order: [['stepNo', 'ASC']],
            attributes: { exclude: ['createdAt', 'updatedAt'] },
          },
          {
            model: Folder,
            attributes: ['name'],
          },
        ],
        where: whereClause,
        raw: true,
      });

      if (cases.length === 0) {
        return res.status(404).send('No cases found');
      }

      // Convert numeric values to human-readable labels
      const casesWithLabels = cases.map((c) => ({
        ...c,
        folderPath: folderPathFor(scope, c.folderId),
        state: testRunStatus[c.state] || c.state,
        priority: priorities[c.priority] || c.priority,
        type: testTypes[c.type] || c.type,
        automationStatus: automationStatus[c.automationStatus] || c.automationStatus,
        template: templates[c.template] || c.template,
      }));

      if (type === 'json') {
        const formattedJsonCases = _formatRawCasesToJson(casesWithLabels);
        return res.json(formattedJsonCases);
      } else if (type === 'csv') {
        const formattedCsvCases = _formatRawCasesToCsv(casesWithLabels);
        const csv = Papa.unparse(formattedCsvCases, {
          quotes: true,
          skipEmptyLines: true,
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send(csv);
      }

      return res.status(400).json({ error: 'Unsupported type. Use ?type=json or ?type=csv' });
    } catch (error) {
      console.error(error);
      res
        .status(error.status || 500)
        .json(error.status ? { error: error.message } : { error: 'Internal Server Error' });
    }
  });

  return router;
}

// Group cases by caseId and format steps to Steps array to better visualization
const _formatRawCasesToJson = (cases) => {
  const casesObject = {};

  cases.forEach((c) => {
    if (!casesObject[c.id]) {
      casesObject[c.id] = {
        id: c.id,
        folderId: c.folderId,
        folder: c['Folder.name'],
        folderPath: c.folderPath,
        title: c.title,
        state: c.state,
        priority: c.priority,
        type: c.type,
        automationStatus: c.automationStatus,
        description: c.description,
        template: c.template,
        preConditions: c.preConditions,
        expectedResults: c.expectedResults,
        Steps: [],
      };
    }

    if (c['Steps.id']) {
      casesObject[c.id].Steps.push({
        step: c['Steps.step'],
        expectedStepResult: c['Steps.result'],
      });
    }
  });

  return casesObject;
};

// Rename fields to better CSV headers
const _formatRawCasesToCsv = (cases) => {
  return cases.map((c) => ({
    id: c.id,
    folderId: c.folderId,
    folder: c['Folder.name'],
    folderPath: Array.isArray(c.folderPath) ? c.folderPath.join(' / ') : c.folderPath,
    title: c.title,
    state: c.state,
    priority: c.priority,
    type: c.type,
    automationStatus: c.automationStatus,
    description: c.description,
    template: c.template,
    preConditions: c.preConditions,
    expectedResults: c.expectedResults,
    step: c['Steps.step'],
    expectedStepResult: c['Steps.result'],
  }));
};
