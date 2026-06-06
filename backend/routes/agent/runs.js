import express from 'express';
import { DataTypes } from 'sequelize';

import defineAgentOperationToken from '../../models/agentOperationTokens.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { writeAgentAudit } from './lib/audit.js';
import { findActiveIdempotencyRecord, idempotencyConflict, storeIdempotencyRecord } from './lib/idempotency.js';
import {
  buildOperationTokenBody,
  consumeOperationToken,
  validateOperationTokenBinding,
} from './lib/operationTokens.js';
import { payloadHash } from './lib/payloadHash.js';
import {
  addCasesToRun,
  addCasesToRunOperationType,
  buildAddCasesHashPayload,
  buildAddCasesPayload,
  buildCreateRunHashPayload,
  buildCreateRunPayload,
  createRunWithCases,
  createRunWithCasesOperationType,
  planAddCasesToRun,
  planCreateRunWithCases,
  withRunWriteLock,
} from './lib/runs.js';

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

function idempotencyMismatchError() {
  const error = createBadRequest('Idempotency key payload mismatch');
  error.status = 409;
  error.code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
  return error;
}

function requireOperationToken(value) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = createBadRequest('operationToken is required');
    error.code = 'OPERATION_TOKEN_REQUIRED';
    throw error;
  }
  return value;
}

async function createDryRun({ sequelize, req, res, projectId, operationType, hash, summary, affectedResourceIds }) {
  const OperationToken = operationTokenModel(sequelize);
  const token = await OperationToken.create(
    buildOperationTokenBody({
      userId: req.userId,
      projectId,
      operationType,
      payloadHash: hash,
      affectedResourceIds,
      idempotencyKey: req.body.idempotencyKey,
    })
  );

  await writeAgentAudit(sequelize, {
    userId: req.userId,
    projectId,
    operationType,
    phase: 'dry-run',
    payloadHash: hash,
    idempotencyKey: req.body.idempotencyKey,
    resultSummary: summary,
  });

  res.json({
    dryRun: {
      operationToken: token.token,
      expiresAt: token.expiresAt,
      payloadHash: hash,
      summary,
      warnings: [],
    },
  });
}

async function commitWithToken({
  sequelize,
  req,
  res,
  projectId,
  operationType,
  hash,
  idempotencyKey,
  mutation,
  lockKey,
}) {
  const now = new Date();
  const OperationToken = operationTokenModel(sequelize);
  const operationToken = requireOperationToken(req.body.operationToken);
  const expectedToken = {
    userId: req.userId,
    projectId,
    operationType,
    payloadHash: hash,
    idempotencyKey,
  };
  const tokenRecord = await OperationToken.findOne({ where: { token: operationToken } });

  const replayIfActive = async (options = {}) => {
    const activeIdempotency = await findActiveIdempotencyRecord(
      sequelize,
      {
        userId: req.userId,
        operationType,
        idempotencyKey,
        now: new Date(),
      },
      options
    );
    if (!activeIdempotency) return null;

    validateOperationTokenBinding({ record: tokenRecord, expected: expectedToken });
    if (idempotencyConflict(activeIdempotency, hash)) {
      throw idempotencyMismatchError();
    }

    return {
      responseStatus: activeIdempotency.responseStatus,
      responseBody: activeIdempotency.responseBody,
    };
  };

  const activeReplay = await replayIfActive();
  if (activeReplay) {
    return res.status(activeReplay.responseStatus).json(activeReplay.responseBody);
  }

  const commitMutation = async (transaction) => {
    const options = { transaction };
    await consumeOperationToken(
      sequelize,
      {
        token: operationToken,
        expected: expectedToken,
        now,
      },
      options
    );

    const result = await mutation(options);

    await writeAgentAudit(
      sequelize,
      {
        userId: req.userId,
        projectId,
        operationType,
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
          operationType,
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

  const commitLockKey = lockKey || `${req.userId}:${operationType}:${idempotencyKey || operationToken}`;
  let response;
  try {
    response = await withRunWriteLock(commitLockKey, async () => {
      const replay = await replayIfActive();
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
      operationType,
      idempotencyKey,
      now: new Date(),
    });
    if (!replayIdempotency) {
      throw error;
    }

    const replayTokenRecord = await OperationToken.findOne({ where: { token: operationToken } });
    validateOperationTokenBinding({ record: replayTokenRecord, expected: expectedToken });
    if (idempotencyConflict(replayIdempotency, hash)) {
      throw idempotencyMismatchError();
    }
    return res.status(replayIdempotency.responseStatus).json(replayIdempotency.responseBody);
  }

  return res.status(response.responseStatus).json(response.responseBody);
}

export default function (sequelize) {
  const router = express.Router();
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectReporterFromProjectId } = editableMiddleware(sequelize);

  router.post('/dry-run', verifySignedIn, verifyProjectReporterFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(req.query.projectId, 'projectId');
      const body = buildCreateRunPayload(req.body);
      const hash = payloadHash(buildCreateRunHashPayload(projectId, body));
      const summary = await planCreateRunWithCases(sequelize, { projectId, payload: body });

      await createDryRun({
        sequelize,
        req,
        res,
        projectId,
        operationType: createRunWithCasesOperationType,
        hash,
        summary,
        affectedResourceIds: body.caseIds,
      });
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  router.post('/commit', verifySignedIn, verifyProjectReporterFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(req.query.projectId, 'projectId');
      const body = buildCreateRunPayload(req.body);
      const idempotencyKey = req.body.idempotencyKey || null;
      const hash = payloadHash(buildCreateRunHashPayload(projectId, body));

      await commitWithToken({
        sequelize,
        req,
        res,
        projectId,
        operationType: createRunWithCasesOperationType,
        hash,
        idempotencyKey,
        mutation: (options) => createRunWithCases(sequelize, { projectId, payload: body }, options),
      });
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  router.post('/:runId/cases/dry-run', verifySignedIn, verifyProjectReporterFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(req.query.projectId, 'projectId');
      const runId = parsePositiveSafeInteger(req.params.runId, 'runId');
      const body = buildAddCasesPayload(req.body);
      const hash = payloadHash(buildAddCasesHashPayload(projectId, runId, body));
      const summary = await planAddCasesToRun(sequelize, { projectId, runId, payload: body });

      await createDryRun({
        sequelize,
        req,
        res,
        projectId,
        operationType: addCasesToRunOperationType,
        hash,
        summary,
        affectedResourceIds: [runId, ...body.caseIds],
      });
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  router.post('/:runId/cases/commit', verifySignedIn, verifyProjectReporterFromProjectId, async (req, res) => {
    try {
      const projectId = parsePositiveSafeInteger(req.query.projectId, 'projectId');
      const runId = parsePositiveSafeInteger(req.params.runId, 'runId');
      const body = buildAddCasesPayload(req.body);
      const idempotencyKey = req.body.idempotencyKey || null;
      const hash = payloadHash(buildAddCasesHashPayload(projectId, runId, body));

      await commitWithToken({
        sequelize,
        req,
        res,
        projectId,
        operationType: addCasesToRunOperationType,
        hash,
        idempotencyKey,
        mutation: (options) => addCasesToRun(sequelize, { projectId, runId, payload: body }, options),
        lockKey: `add-cases-to-run:${runId}`,
      });
    } catch (error) {
      res.status(error.status || 500).json(errorBody(error));
    }
  });

  return router;
}
