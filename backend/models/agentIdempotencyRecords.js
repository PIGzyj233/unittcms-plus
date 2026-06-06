function defineAgentIdempotencyRecord(sequelize, DataTypes) {
  const AgentIdempotencyRecord = sequelize.define(
    'AgentIdempotencyRecord',
    {
      userId: { type: DataTypes.INTEGER, allowNull: false },
      operationType: { type: DataTypes.STRING(80), allowNull: false },
      idempotencyKey: { type: DataTypes.STRING(160), allowNull: false },
      payloadHash: { type: DataTypes.STRING(80), allowNull: false },
      responseStatus: { type: DataTypes.INTEGER, allowNull: false },
      responseBody: { type: DataTypes.JSON, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'agentIdempotencyRecords',
    }
  );

  AgentIdempotencyRecord.associate = (models) => {
    AgentIdempotencyRecord.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
  };

  return AgentIdempotencyRecord;
}

export default defineAgentIdempotencyRecord;
