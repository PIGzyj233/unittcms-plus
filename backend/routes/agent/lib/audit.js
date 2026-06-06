import { DataTypes } from 'sequelize';

import defineAgentAuditLog from '../../../models/agentAuditLogs.js';

function agentAuditLogModel(sequelize) {
  return sequelize.models.AgentAuditLog || defineAgentAuditLog(sequelize, DataTypes);
}

async function writeAgentAudit(
  sequelize,
  { userId, projectId, operationType, phase, payloadHash, idempotencyKey, resultSummary },
  options = {}
) {
  const AuditLog = agentAuditLogModel(sequelize);

  return AuditLog.create(
    { userId, projectId, operationType, phase, payloadHash, idempotencyKey: idempotencyKey || null, resultSummary },
    options
  );
}

export { writeAgentAudit };
