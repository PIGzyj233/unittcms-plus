function defineMcpToken(sequelize, DataTypes) {
  const McpToken = sequelize.define(
    'McpToken',
    {
      name: { type: DataTypes.STRING(120), allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      tokenPrefix: { type: DataTypes.STRING(32), allowNull: false },
      scopeType: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'global' },
      projectId: { type: DataTypes.INTEGER, allowNull: true },
      createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
      lastUsedAt: { type: DataTypes.DATE, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'mcpTokens',
      indexes: [
        { fields: ['tokenHash'], unique: true },
        { fields: ['scopeType', 'projectId'] },
        { fields: ['revokedAt', 'expiresAt'] },
      ],
    }
  );

  McpToken.associate = (models) => {
    McpToken.belongsTo(models.User, {
      foreignKey: 'createdByUserId',
      as: 'CreatedBy',
      onDelete: 'SET NULL',
    });
    McpToken.belongsTo(models.Project, {
      foreignKey: 'projectId',
      onDelete: 'CASCADE',
    });
  };

  return McpToken;
}

export default defineMcpToken;
