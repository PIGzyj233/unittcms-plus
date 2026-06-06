export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('agentAuditLogs', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    phase: {
      type: Sequelize.STRING(40),
      allowNull: false,
    },
    payloadHash: {
      type: Sequelize.STRING(80),
      allowNull: false,
    },
    idempotencyKey: {
      type: Sequelize.STRING(160),
      allowNull: true,
    },
    resultSummary: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: {},
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

  await queryInterface.addIndex('agentAuditLogs', ['projectId', 'operationType', 'createdAt']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('agentAuditLogs');
}
