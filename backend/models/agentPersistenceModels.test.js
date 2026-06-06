import { describe, expect, it } from 'vitest';
import { Sequelize, DataTypes, QueryTypes } from 'sequelize';
import * as createAgentCaseCandidates from '../migrations/20260605000100-create-agent-case-candidates.js';
import * as createAgentOperationTokens from '../migrations/20260605000200-create-agent-operation-tokens.js';
import * as createAgentIdempotencyRecords from '../migrations/20260605000300-create-agent-idempotency-records.js';
import * as createAgentAuditLogs from '../migrations/20260605000400-create-agent-audit-logs.js';
import defineAgentAuditLog from './agentAuditLogs.js';
import defineAgentCaseCandidate from './agentCaseCandidates.js';
import defineAgentIdempotencyRecord from './agentIdempotencyRecords.js';
import defineAgentOperationToken from './agentOperationTokens.js';

async function getForeignKeys(sequelize, tableName) {
  return sequelize.query(`PRAGMA foreign_key_list(\`${tableName}\`)`, {
    type: QueryTypes.SELECT,
  });
}

async function getIndexSql(sequelize, tableName, pattern) {
  const rows = await sequelize.query(
    'SELECT sql FROM sqlite_master WHERE type = :type AND tbl_name = :tableName AND sql LIKE :pattern',
    {
      replacements: { type: 'index', tableName, pattern },
      type: QueryTypes.SELECT,
    }
  );
  return rows.map((row) => row.sql).join('\n');
}

function expectForeignKey(foreignKeys, { from, table, onUpdate, onDelete }) {
  expect(foreignKeys).toContainEqual(
    expect.objectContaining({
      from,
      table,
      to: 'id',
      on_update: onUpdate,
      on_delete: onDelete,
    })
  );
}

function expectIndex(indexes, { fields, unique = false }) {
  expect(indexes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        unique,
        fields: fields.map((attribute) => expect.objectContaining({ attribute })),
      }),
    ])
  );
}

describe('agent models', () => {
  it('defines the expected model names and JSON fields', () => {
    const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });

    const Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
    const OperationToken = defineAgentOperationToken(sequelize, DataTypes);
    const IdempotencyRecord = defineAgentIdempotencyRecord(sequelize, DataTypes);
    const AuditLog = defineAgentAuditLog(sequelize, DataTypes);

    expect(Candidate.name).toBe('AgentCaseCandidate');
    expect(Candidate.rawAttributes.steps.type.key).toBe('JSON');
    expect(Candidate.rawAttributes.duplicateMetadata.type.key).toBe('JSON');
    expect(Candidate.rawAttributes.normalizedTitle.type.key).toBe('STRING');
    expect(Candidate.rawAttributes.duplicateAllowed.type.key).toBe('BOOLEAN');
    expect(Candidate.rawAttributes.duplicateAllowed.defaultValue).toBe(false);
    expect(OperationToken.name).toBe('AgentOperationToken');
    expect(IdempotencyRecord.rawAttributes.responseBody.type.key).toBe('JSON');
    expect(AuditLog.rawAttributes.resultSummary.type.key).toBe('JSON');
  });

  it('uses the migration table names in model definitions', () => {
    const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });

    const Candidate = defineAgentCaseCandidate(sequelize, DataTypes);
    const OperationToken = defineAgentOperationToken(sequelize, DataTypes);
    const IdempotencyRecord = defineAgentIdempotencyRecord(sequelize, DataTypes);
    const AuditLog = defineAgentAuditLog(sequelize, DataTypes);

    expect(Candidate.getTableName()).toBe('agentCaseCandidates');
    expect(OperationToken.getTableName()).toBe('agentOperationTokens');
    expect(IdempotencyRecord.getTableName()).toBe('agentIdempotencyRecords');
    expect(AuditLog.getTableName()).toBe('agentAuditLogs');
  });

  it('defines relationship associations for persistence models', () => {
    const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    const User = sequelize.define('User', {});
    const Project = sequelize.define('Project', {});

    const OperationToken = defineAgentOperationToken(sequelize, DataTypes);
    const IdempotencyRecord = defineAgentIdempotencyRecord(sequelize, DataTypes);
    const AuditLog = defineAgentAuditLog(sequelize, DataTypes);

    OperationToken.associate({ User, Project });
    IdempotencyRecord.associate({ User });
    AuditLog.associate({ User, Project });

    expect(OperationToken.associations.User.foreignKey).toBe('userId');
    expect(OperationToken.associations.Project.foreignKey).toBe('projectId');
    expect(IdempotencyRecord.associations.User.foreignKey).toBe('userId');
    expect(AuditLog.associations.User.foreignKey).toBe('userId');
    expect(AuditLog.associations.Project.foreignKey).toBe('projectId');
  });

  it('creates expected migration foreign keys and indexes', async () => {
    const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    const queryInterface = sequelize.getQueryInterface();

    await createAgentCaseCandidates.up(queryInterface, Sequelize);
    await createAgentOperationTokens.up(queryInterface, Sequelize);
    await createAgentIdempotencyRecords.up(queryInterface, Sequelize);
    await createAgentAuditLogs.up(queryInterface, Sequelize);

    const candidateKeys = await getForeignKeys(sequelize, 'agentCaseCandidates');
    expectForeignKey(candidateKeys, {
      from: 'projectId',
      table: 'projects',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    expectForeignKey(candidateKeys, {
      from: 'folderId',
      table: 'folders',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    expectForeignKey(candidateKeys, {
      from: 'creatorUserId',
      table: 'users',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    expectForeignKey(candidateKeys, {
      from: 'reviewerUserId',
      table: 'users',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    expectForeignKey(candidateKeys, {
      from: 'acceptedCaseId',
      table: 'cases',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    const tokenKeys = await getForeignKeys(sequelize, 'agentOperationTokens');
    expectForeignKey(tokenKeys, {
      from: 'userId',
      table: 'users',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    expectForeignKey(tokenKeys, {
      from: 'projectId',
      table: 'projects',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    const idempotencyKeys = await getForeignKeys(sequelize, 'agentIdempotencyRecords');
    expectForeignKey(idempotencyKeys, {
      from: 'userId',
      table: 'users',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    const auditKeys = await getForeignKeys(sequelize, 'agentAuditLogs');
    expectForeignKey(auditKeys, {
      from: 'userId',
      table: 'users',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    expectForeignKey(auditKeys, {
      from: 'projectId',
      table: 'projects',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    expectIndex(await queryInterface.showIndex('agentCaseCandidates'), {
      fields: ['projectId', 'status'],
    });
    expectIndex(await queryInterface.showIndex('agentCaseCandidates'), {
      fields: ['folderId'],
    });
    expectIndex(await queryInterface.showIndex('agentCaseCandidates'), {
      fields: ['projectId', 'status', 'normalizedTitle', 'duplicateAllowed'],
      unique: true,
    });
    const draftTitleIndexSql = await getIndexSql(sequelize, 'agentCaseCandidates', '%normalizedTitle%');
    expect(draftTitleIndexSql).toContain("WHERE `status` = 'draft'");
    expect(draftTitleIndexSql).toContain('`duplicateAllowed` = 0');
    expectIndex(await queryInterface.showIndex('agentOperationTokens'), {
      fields: ['token'],
      unique: true,
    });
    expectIndex(await queryInterface.showIndex('agentOperationTokens'), {
      fields: ['userId', 'operationType', 'idempotencyKey'],
    });
    expectIndex(await queryInterface.showIndex('agentIdempotencyRecords'), {
      fields: ['userId', 'operationType', 'idempotencyKey'],
      unique: true,
    });
    expectIndex(await queryInterface.showIndex('agentAuditLogs'), {
      fields: ['projectId', 'operationType', 'createdAt'],
    });

    await sequelize.close();
  });
});
