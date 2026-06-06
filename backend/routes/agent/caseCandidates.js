import express from 'express';
import { DataTypes } from 'sequelize';

import defineAgentOperationToken from '../../models/agentOperationTokens.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { writeAgentAudit } from './lib/audit.js';
import {
  acceptCandidates,
  acceptOperationType,
  buildAcceptPayload,
  createCandidate,
  listCandidates,
  rejectCandidate,
  updateCandidate,
} from './lib/candidates.js';
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

function buildProjectBoundAcceptPayload(projectId, payload) {
  return { projectId, ...payload };
}

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);

  router.post('/', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const candidate = await createCandidate(sequelize, {
        projectId: Number(req.query.projectId),
        userId: req.userId,
        body: req.body,
      });
      res.status(201).json({ candidate });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, ...(error.details || {}) });
    }
  });

  router.get('/', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    try {
      const candidates = await listCandidates(sequelize, {
        projectId: Number(req.query.projectId),
        status: req.query.status,
      });
      res.json({ candidates });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  router.post('/accept/dry-run', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = Number(req.query.projectId);
      const payload = buildAcceptPayload(req.body);
      const hash = payloadHash(buildProjectBoundAcceptPayload(projectId, payload));
      const OperationToken = sequelize.models.AgentOperationToken || defineAgentOperationToken(sequelize, DataTypes);
      const tokenBody = buildOperationTokenBody({
        userId: req.userId,
        projectId,
        operationType: acceptOperationType,
        payloadHash: hash,
        affectedResourceIds: payload.candidateIds,
        idempotencyKey: req.body.idempotencyKey,
      });
      const token = await OperationToken.create(tokenBody);
      await writeAgentAudit(sequelize, {
        userId: req.userId,
        projectId,
        operationType: acceptOperationType,
        phase: 'dry-run',
        payloadHash: hash,
        idempotencyKey: req.body.idempotencyKey,
        resultSummary: { candidateIds: payload.candidateIds },
      });
      res.json({
        dryRun: {
          operationToken: token.token,
          expiresAt: token.expiresAt,
          payloadHash: hash,
          summary: { operationType: acceptOperationType, projectId, affectedResourceIds: payload.candidateIds },
          warnings: [],
        },
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    }
  });

  router.post('/accept/commit', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = Number(req.query.projectId);
      const idempotencyKey = req.body.idempotencyKey || null;
      const payload = buildAcceptPayload(req.body);
      const hash = payloadHash(buildProjectBoundAcceptPayload(projectId, payload));
      const now = new Date();
      const OperationToken = sequelize.models.AgentOperationToken || defineAgentOperationToken(sequelize, DataTypes);
      const expectedToken = {
        userId: req.userId,
        projectId,
        operationType: acceptOperationType,
        payloadHash: hash,
        idempotencyKey,
      };
      const tokenRecord = await OperationToken.findOne({ where: { token: req.body.operationToken } });

      const activeIdempotency = await findActiveIdempotencyRecord(sequelize, {
        userId: req.userId,
        operationType: acceptOperationType,
        idempotencyKey,
        now,
      });
      if (idempotencyConflict(activeIdempotency, hash)) {
        const error = createBadRequest('Idempotency key payload mismatch');
        error.status = 409;
        error.code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
        throw error;
      }
      if (activeIdempotency) {
        validateOperationTokenBinding({ record: tokenRecord, expected: expectedToken });
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
        const result = await acceptCandidates(sequelize, { projectId, userId: req.userId, ...payload }, options);
        await writeAgentAudit(
          sequelize,
          {
            userId: req.userId,
            projectId,
            operationType: acceptOperationType,
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
              operationType: acceptOperationType,
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

      let result;
      try {
        result = await sequelize.transaction((transaction) => commitMutation(transaction));
      } catch (error) {
        if (error.code !== 'operation_token_used' || !idempotencyKey) {
          throw error;
        }

        const replayIdempotency = await findActiveIdempotencyRecord(sequelize, {
          userId: req.userId,
          operationType: acceptOperationType,
          idempotencyKey,
          now: new Date(),
        });
        if (idempotencyConflict(replayIdempotency, hash)) {
          const conflictError = createBadRequest('Idempotency key payload mismatch');
          conflictError.status = 409;
          conflictError.code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
          throw conflictError;
        }
        if (!replayIdempotency) {
          throw error;
        }

        const replayTokenRecord = await OperationToken.findOne({ where: { token: req.body.operationToken } });
        validateOperationTokenBinding({ record: replayTokenRecord, expected: expectedToken });
        return res.status(replayIdempotency.responseStatus).json(replayIdempotency.responseBody);
      }
      res.json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    }
  });

  router.put('/:candidateId', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const candidate = await updateCandidate(sequelize, {
        projectId: Number(req.query.projectId),
        candidateId: parsePositiveSafeInteger(req.params.candidateId, 'candidateId'),
        body: req.body,
      });
      res.json({ candidate });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, ...(error.details || {}) });
    }
  });

  router.post('/:candidateId/reject', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const candidate = await rejectCandidate(sequelize, {
        projectId: Number(req.query.projectId),
        candidateId: parsePositiveSafeInteger(req.params.candidateId, 'candidateId'),
        userId: req.userId,
      });
      res.json({ candidate });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  return router;
}
