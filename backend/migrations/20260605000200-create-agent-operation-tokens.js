export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('agentOperationTokens', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    token: {
      type: Sequelize.STRING(128),
      allowNull: false,
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    projectId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    operationType: {
      type: Sequelize.STRING(80),
      allowNull: false,
    },
    payloadHash: {
      type: Sequelize.STRING(80),
      allowNull: false,
    },
    affectedResourceIds: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    idempotencyKey: {
      type: Sequelize.STRING(160),
      allowNull: true,
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    consumedAt: {
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

  await queryInterface.addIndex('agentOperationTokens', ['token'], { unique: true });
  await queryInterface.addIndex('agentOperationTokens', ['userId', 'operationType', 'idempotencyKey']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('agentOperationTokens');
}
