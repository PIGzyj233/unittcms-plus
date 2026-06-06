export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('agentCaseCandidates', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    folderId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'folders',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    normalizedTitle: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    preConditions: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    expectedResults: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    priority: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    automationStatus: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    template: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    steps: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    tagIds: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    suggestedTags: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    source: {
      type: Sequelize.STRING(120),
      allowNull: true,
    },
    rationale: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    duplicateMetadata: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: { blocked: false, warnings: [] },
    },
    status: {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    duplicateAllowed: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    creatorUserId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    reviewerUserId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    acceptedCaseId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'cases',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    reviewedAt: {
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

  await queryInterface.addIndex('agentCaseCandidates', ['projectId', 'status']);
  await queryInterface.addIndex('agentCaseCandidates', ['folderId']);
  await queryInterface.addIndex('agentCaseCandidates', ['projectId', 'status', 'normalizedTitle', 'duplicateAllowed'], {
    name: 'agent_case_candidates_unique_draft_title',
    unique: true,
    where: { status: 'draft', duplicateAllowed: false },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('agentCaseCandidates');
}
