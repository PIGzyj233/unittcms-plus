function defineAgentCaseCandidate(sequelize, DataTypes) {
  const AgentCaseCandidate = sequelize.define(
    'AgentCaseCandidate',
    {
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      folderId: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      normalizedTitle: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      preConditions: { type: DataTypes.TEXT, allowNull: true },
      expectedResults: { type: DataTypes.TEXT, allowNull: true },
      priority: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.INTEGER, allowNull: false },
      automationStatus: { type: DataTypes.INTEGER, allowNull: false },
      template: { type: DataTypes.INTEGER, allowNull: false },
      steps: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      tagIds: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      suggestedTags: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      source: { type: DataTypes.STRING(120), allowNull: true },
      rationale: { type: DataTypes.TEXT, allowNull: true },
      duplicateMetadata: { type: DataTypes.JSON, allowNull: false, defaultValue: { blocked: false, warnings: [] } },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
      duplicateAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      creatorUserId: { type: DataTypes.INTEGER, allowNull: false },
      reviewerUserId: { type: DataTypes.INTEGER, allowNull: true },
      acceptedCaseId: { type: DataTypes.INTEGER, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'agentCaseCandidates',
      indexes: [
        { fields: ['projectId', 'status'] },
        { fields: ['folderId'] },
        {
          name: 'agent_case_candidates_unique_draft_title',
          unique: true,
          fields: ['projectId', 'status', 'normalizedTitle', 'duplicateAllowed'],
          where: { status: 'draft', duplicateAllowed: false },
        },
      ],
    }
  );

  AgentCaseCandidate.associate = (models) => {
    AgentCaseCandidate.belongsTo(models.Project, { foreignKey: 'projectId', onDelete: 'CASCADE' });
    AgentCaseCandidate.belongsTo(models.Folder, { foreignKey: 'folderId', onDelete: 'CASCADE' });
    AgentCaseCandidate.belongsTo(models.User, { foreignKey: 'creatorUserId', as: 'Creator' });
    AgentCaseCandidate.belongsTo(models.User, { foreignKey: 'reviewerUserId', as: 'Reviewer' });
    AgentCaseCandidate.belongsTo(models.Case, { foreignKey: 'acceptedCaseId', as: 'AcceptedCase' });
  };

  return AgentCaseCandidate;
}

export default defineAgentCaseCandidate;
