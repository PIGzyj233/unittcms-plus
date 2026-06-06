function defineAgentOperationToken(sequelize, DataTypes) {
  const AgentOperationToken = sequelize.define(
    'AgentOperationToken',
    {
      token: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      operationType: { type: DataTypes.STRING(80), allowNull: false },
      payloadHash: { type: DataTypes.STRING(80), allowNull: false },
      affectedResourceIds: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      idempotencyKey: { type: DataTypes.STRING(160), allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'agentOperationTokens',
    }
  );

  AgentOperationToken.associate = (models) => {
    AgentOperationToken.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
    AgentOperationToken.belongsTo(models.Project, {
      foreignKey: 'projectId',
      onDelete: 'CASCADE',
    });
  };

  return AgentOperationToken;
}

export default defineAgentOperationToken;
