import express from 'express';
import { DataTypes } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';
import defineRun from '../../models/runs.js';
import authMiddleware from '../../middleware/auth.js';
import visibleMiddleware from '../../middleware/verifyVisible.js';

function createRunCaseConflict(runCase) {
  const error = new Error('Run Case update conflict');
  error.status = 409;
  error.failedRunCases = [runCase];
  return error;
}

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromRunId } = visibleMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);

  router.post('/update', verifySignedIn, verifyProjectVisibleFromRunId, async (req, res) => {
    const runId = req.query.runId;
    const runCases = req.body;
    const t = await sequelize.transaction();

    const createRunCase = async (runCase) => {
      const run = await Run.findByPk(runId, { transaction: t });
      if (!run) {
        throw createRunCaseConflict(runCase);
      }

      const testCase = await Case.findByPk(runCase.caseId, { transaction: t });
      if (!testCase) {
        throw createRunCaseConflict(runCase);
      }

      const folder = await Folder.findByPk(testCase.folderId, { transaction: t });
      if (!folder || String(folder.projectId) !== String(run.projectId)) {
        throw createRunCaseConflict(runCase);
      }

      const existingRunCase = await RunCase.findOne({
        where: { runId: runId, caseId: runCase.caseId },
        transaction: t,
      });
      if (existingRunCase) {
        throw createRunCaseConflict(runCase);
      }

      const newRunCase = await RunCase.create(
        {
          runId: runId,
          caseId: runCase.caseId,
          status: runCase.status,
        },
        { transaction: t }
      );
      return newRunCase;
    };

    const deleteRunCase = async (runCase) => {
      const affectedRows = await RunCase.destroy({
        where: { id: runCase.id, runId: runId, caseId: runCase.caseId },
        transaction: t,
      });
      if (affectedRows === 0) {
        throw createRunCaseConflict(runCase);
      }
      return null;
    };

    const updateRunCase = async (runCase) => {
      const [affectedRows] = await RunCase.update(
        {
          status: runCase.status,
        },
        {
          where: { id: runCase.id, runId: runId, caseId: runCase.caseId },
          transaction: t,
        }
      );
      if (affectedRows === 0) {
        throw createRunCaseConflict(runCase);
      }
      return runCase;
    };

    try {
      const results = await Promise.all(
        runCases.map(async (step) => {
          if (step.editState === 'new') {
            return createRunCase(step);
          } else if (step.editState === 'deleted') {
            return deleteRunCase(step);
          } else if (step.editState === 'changed') {
            return updateRunCase(step);
          } else if (step.editState === 'notChanged') {
            return step;
          }
        })
      );

      await t.commit();
      res.json(results.filter((result) => result !== null));
    } catch (error) {
      await t.rollback();
      if (error.status === 409) {
        return res.status(409).json({
          error: error.message,
          failedRunCases: error.failedRunCases,
        });
      }
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
