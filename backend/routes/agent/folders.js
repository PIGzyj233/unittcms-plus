import express from 'express';
import { DataTypes } from 'sequelize';

import defineAgentOperationToken from '../../models/agentOperationTokens.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { writeAgentAudit } from './lib/audit.js';
import {
  buildEnsureFolderPathHashPayload,
  buildEnsureFolderPathPayload,
  ensureFolderPath,
  ensureFolderPathOperationType,
  getFolderTree,
  planEnsureFolderPath,
  withEnsureFolderPathLock,
} from './lib/folders.js';
import { findActiveIdempotencyRecord, idempotencyConflict, storeIdempotencyRecord } from './lib/idempotency.js';
import {
  buildOperationTokenBody,
  consumeOperationToken,
  validateOperationTokenBinding,
} from './lib/operationTokens.js';
import { payloadHash } from './lib/payloadHash.js';

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parsePositiveSafeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createBadRequest(`${label} must be a positive integer`);
  }
  return parsed;
}

function operationTokenModel(sequelize) {
  return sequelize.models.AgentOperationToken || defineAgentOperationToken(sequelize, DataTypes);
}

function errorBody(error) {
  return { error: error.message, ...(error.code ? { code: error.code } : {}) };
}

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);

  router.get('/tree', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    try {
      const folders = await getFolderTree(sequelize, {
        projectId: parsePositiveSafeInteger(req.query.projectId, 'projectId'),
      });
      res.json({ folders });
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  router.post('/ensure-path/dry-run', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(req.query.projectId, 'projectId');
      const body = buildEnsureFolderPathPayload(req.body);
      const hash = payloadHash(buildEnsureFolderPathHashPayload(projectId, body));
      const plan = await planEnsureFolderPath(sequelize, { projectId, path: body.path });
      const OperationToken = operationTokenModel(sequelize);
      const tokenBody = buildOperationTokenBody({
        userId: req.userId,
        projectId,
        operationType: ensureFolderPathOperationType,
        payloadHash: hash,
        affectedResourceIds: plan.reused.map((folder) => folder.id),
        idempotencyKey: req.body.idempotencyKey,
      });
      const token = await OperationToken.create(tokenBody);

      await writeAgentAudit(sequelize, {
        userId: req.userId,
        projectId,
        operationType: ensureFolderPathOperationType,
        phase: 'dry-run',
        payloadHash: hash,
        idempotencyKey: req.body.idempotencyKey,
        resultSummary: plan,
      });

      res.json({
        dryRun: {
          operationToken: token.token,
          expiresAt: token.expiresAt,
          payloadHash: hash,
          summary: { operationType: ensureFolderPathOperationType, projectId, ...plan },
          warnings: [],
        },
      });
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  router.post('/ensure-path/commit', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(req.query.projectId, 'projectId');
      const idempotencyKey = req.body.idempotencyKey || null;
      const body = buildEnsureFolderPathPayload(req.body);
      const hash = payloadHash(buildEnsureFolderPathHashPayload(projectId, body));
      const now = new Date();
      const OperationToken = operationTokenModel(sequelize);
      const expectedToken = {
        userId: req.userId,
        projectId,
        operationType: ensureFolderPathOperationType,
        payloadHash: hash,
        idempotencyKey,
      };
      const tokenRecord = await OperationToken.findOne({ where: { token: req.body.operationToken } });

      const activeIdempotency = await findActiveIdempotencyRecord(sequelize, {
        userId: req.userId,
        operationType: ensureFolderPathOperationType,
        idempotencyKey,
        now,
      });
      if (activeIdempotency) {
        validateOperationTokenBinding({ record: tokenRecord, expected: expectedToken });
        if (idempotencyConflict(activeIdempotency, hash)) {
          const error = createBadRequest('Idempotency key payload mismatch');
          error.status = 409;
          error.code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
          throw error;
        }
        return res.status(activeIdempotency.responseStatus).json(activeIdempotency.responseBody);
      }

      const commitMutation = async (transaction) => {
        const options = transaction ? { transaction } : {};
        await consumeOperationToken(
          sequelize,
          {
            token: req.body.operationToken,
            expected: expectedToken,
            now,
          },
          options
        );
        const result = await ensureFolderPath(sequelize, { projectId, path: body.path, detail: body.detail }, options);

        await writeAgentAudit(
          sequelize,
          {
            userId: req.userId,
            projectId,
            operationType: ensureFolderPathOperationType,
            phase: 'commit',
            payloadHash: hash,
            idempotencyKey,
            resultSummary: result,
          },
          options
        );

        if (idempotencyKey) {
          await storeIdempotencyRecord(
            sequelize,
            {
              userId: req.userId,
              operationType: ensureFolderPathOperationType,
              idempotencyKey,
              payloadHash: hash,
              responseBody: result,
              now,
            },
            options
          );
        }

        return result;
      };

      const findReplayAfterLock = async () => {
        const lockedIdempotency = await findActiveIdempotencyRecord(sequelize, {
          userId: req.userId,
          operationType: ensureFolderPathOperationType,
          idempotencyKey,
          now: new Date(),
        });
        if (!lockedIdempotency) return null;

        validateOperationTokenBinding({ record: tokenRecord, expected: expectedToken });
        if (idempotencyConflict(lockedIdempotency, hash)) {
          const error = createBadRequest('Idempotency key payload mismatch');
          error.status = 409;
          error.code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
          throw error;
        }

        return {
          responseStatus: lockedIdempotency.responseStatus,
          responseBody: lockedIdempotency.responseBody,
        };
      };

      let response;
      try {
        response = await withEnsureFolderPathLock(projectId, async () => {
          const replay = await findReplayAfterLock();
          if (replay) return replay;

          const responseBody = await sequelize.transaction((transaction) => commitMutation(transaction));
          return { responseStatus: 200, responseBody };
        });
      } catch (error) {
        if (error.code !== 'operation_token_used' || !idempotencyKey) {
          throw error;
        }

        const replayIdempotency = await findActiveIdempotencyRecord(sequelize, {
          userId: req.userId,
          operationType: ensureFolderPathOperationType,
          idempotencyKey,
          now: new Date(),
        });
        if (!replayIdempotency) {
          throw error;
        }

        const replayTokenRecord = await OperationToken.findOne({ where: { token: req.body.operationToken } });
        validateOperationTokenBinding({ record: replayTokenRecord, expected: expectedToken });
        if (idempotencyConflict(replayIdempotency, hash)) {
          const conflictError = createBadRequest('Idempotency key payload mismatch');
          conflictError.status = 409;
          conflictError.code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
          throw conflictError;
        }
        return res.status(replayIdempotency.responseStatus).json(replayIdempotency.responseBody);
      }

      res.status(response.responseStatus).json(response.responseBody);
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  return router;
}
