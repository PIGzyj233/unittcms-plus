import { describe, expect, it } from 'vitest';
import { DataTypes, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';

import defineMember from '../models/members.js';
import defineProject from '../models/projects.js';
import defineUser from '../models/users.js';
import { ensureAgentBot } from './ensureAgentBot.js';

describe('ensureAgentBot', () => {
  async function createDatabase() {
    const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    const User = defineUser(sequelize, DataTypes);
    const Project = defineProject(sequelize, DataTypes);
    const Member = defineMember(sequelize, DataTypes);

    Project.belongsTo(User, { foreignKey: 'userId' });
    Member.belongsTo(User, { foreignKey: 'userId' });
    Member.belongsTo(Project, { foreignKey: 'projectId' });

    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
    return { sequelize, User, Project, Member };
  }

  it('creates a bot user and grants developer access to all existing projects', async () => {
    const { sequelize, User, Project, Member } = await createDatabase();
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'hashed-owner',
      username: 'Owner',
      role: 0,
    });
    const firstProject = await Project.create({ name: 'First', detail: '', isPublic: true, userId: owner.id });
    const secondProject = await Project.create({ name: 'Second', detail: '', isPublic: false, userId: owner.id });

    const result = await ensureAgentBot(sequelize, {
      email: 'bot@norelpy.com',
      password: 'iambot2333',
    });

    const bot = await User.findOne({ where: { email: 'bot@norelpy.com' } });
    expect(result).toEqual({ userId: bot.id, projectsGranted: [firstProject.id, secondProject.id] });
    expect(bot.username).toBe('Agent Bot');
    expect(bot.role).toBe(1);
    await expect(bcrypt.compare('iambot2333', bot.password)).resolves.toBe(true);

    const memberships = await Member.findAll({ where: { userId: bot.id }, order: [['projectId', 'ASC']] });
    expect(memberships.map((member) => ({ projectId: member.projectId, role: member.role }))).toEqual([
      { projectId: firstProject.id, role: 1 },
      { projectId: secondProject.id, role: 1 },
    ]);

    await sequelize.close();
  });

  it('updates an existing bot password and upgrades existing project memberships', async () => {
    const { sequelize, User, Project, Member } = await createDatabase();
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'hashed-owner',
      username: 'Owner',
      role: 0,
    });
    const bot = await User.create({
      email: 'bot@norelpy.com',
      password: await bcrypt.hash('old-password', 10),
      username: 'Old Bot',
      role: 1,
    });
    const project = await Project.create({ name: 'First', detail: '', isPublic: true, userId: owner.id });
    await Member.create({ userId: bot.id, projectId: project.id, role: 2 });

    const result = await ensureAgentBot(sequelize, {
      email: 'bot@norelpy.com',
      password: 'iambot2333',
    });

    await bot.reload();
    const membership = await Member.findOne({ where: { userId: bot.id, projectId: project.id } });
    expect(result).toEqual({ userId: bot.id, projectsGranted: [project.id] });
    await expect(bcrypt.compare('iambot2333', bot.password)).resolves.toBe(true);
    expect(membership.role).toBe(1);

    await sequelize.close();
  });
});
