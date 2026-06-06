export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('mcpTokens', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: Sequelize.STRING(120),
      allowNull: false,
    },
    tokenHash: {
      type: Sequelize.STRING(64),
      allowNull: false,
      unique: true,
    },
    tokenPrefix: {
      type: Sequelize.STRING(32),
      allowNull: false,
    },
    scopeType: {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: 'global',
    },
    projectId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdByUserId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    lastUsedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    revokedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex('mcpTokens', ['tokenHash'], { unique: true });
  await queryInterface.addIndex('mcpTokens', ['scopeType', 'projectId']);
  await queryInterface.addIndex('mcpTokens', ['revokedAt', 'expiresAt']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('mcpTokens');
}
