function defineAgentAuditLog(sequelize, DataTypes) {
  const AgentAuditLog = sequelize.define(
    'AgentAuditLog',
    {
      userId: { type: DataTypes.INTEGER, allowNull: false },
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      operationType: { type: DataTypes.STRING(80), allowNull: false },
      phase: { type: DataTypes.STRING(40), allowNull: false },
      payloadHash: { type: DataTypes.STRING(80), allowNull: false },
      idempotencyKey: { type: DataTypes.STRING(160), allowNull: true },
      resultSummary: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    },
    {
      tableName: 'agentAuditLogs',
    }
  );

  AgentAuditLog.associate = (models) => {
    AgentAuditLog.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
    AgentAuditLog.belongsTo(models.Project, {
      foreignKey: 'projectId',
      onDelete: 'CASCADE',
    });
  };

  return AgentAuditLog;
}

export default defineAgentAuditLog;
