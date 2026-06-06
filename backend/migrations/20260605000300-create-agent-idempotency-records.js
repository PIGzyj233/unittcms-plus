export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('agentIdempotencyRecords', {
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
    operationType: {
      type: Sequelize.STRING(80),
      allowNull: false,
    },
    idempotencyKey: {
      type: Sequelize.STRING(160),
      allowNull: false,
    },
    payloadHash: {
      type: Sequelize.STRING(80),
      allowNull: false,
    },
    responseStatus: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    responseBody: {
      type: Sequelize.JSON,
      allowNull: false,
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: false,
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

  await queryInterface.addIndex('agentIdempotencyRecords', ['userId', 'operationType', 'idempotencyKey'], {
    unique: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('agentIdempotencyRecords');
}
