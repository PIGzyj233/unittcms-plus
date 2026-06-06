import bcrypt from 'bcrypt';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import defineMember from '../models/members.js';
import defineProject from '../models/projects.js';
import defineUser from '../models/users.js';
import { ensureAgentServicePrincipal, ensureAgentServicePrincipalForProject } from './agentServicePrincipal.js';

describe('agent service principal reconciliation', () => {
  let sequelize;
  let Member;
  let Project;
  let User;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    User = defineUser(sequelize, DataTypes);
    Project = defineProject(sequelize, DataTypes);
    Member = defineMember(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('creates the service principal and grants developer access to all existing projects', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'owner-password',
      username: 'Owner',
      role: 1,
    });
    const firstProject = await Project.create({ name: 'One', detail: '', isPublic: false, userId: owner.id });
    const secondProject = await Project.create({ name: 'Two', detail: '', isPublic: true, userId: owner.id });

    const result = await ensureAgentServicePrincipal(sequelize, {
      email: 'bot@example.com',
      password: 'secret-password',
      username: 'Agent Bot',
    });

    const bot = await User.findByPk(result.userId);
    const memberships = await Member.findAll({ where: { userId: result.userId }, order: [['projectId', 'ASC']] });
    expect(bot).toMatchObject({ email: 'bot@example.com', username: 'Agent Bot', role: 1 });
    await expect(bcrypt.compare('secret-password', bot.password)).resolves.toBe(true);
    expect(result.projectsGranted).toEqual([firstProject.id, secondProject.id]);
    expect(memberships.map((member) => [member.projectId, member.role])).toEqual([
      [firstProject.id, 1],
      [secondProject.id, 1],
    ]);
  });

  it('upgrades existing project membership to the selected service-principal role', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'owner-password',
      username: 'Owner',
      role: 1,
    });
    const bot = await User.create({
      email: 'bot@example.com',
      password: 'old-password',
      username: 'Old Bot',
      role: 1,
    });
    const project = await Project.create({ name: 'One', detail: '', isPublic: false, userId: owner.id });
    await Member.create({ userId: bot.id, projectId: project.id, role: 2 });

    const result = await ensureAgentServicePrincipal(sequelize, {
      email: 'bot@example.com',
      password: 'new-password',
      username: 'Agent Bot',
    });

    const membership = await Member.findOne({ where: { userId: result.userId, projectId: project.id } });
    const updatedBot = await User.findByPk(result.userId);
    expect(membership.role).toBe(1);
    expect(updatedBot.username).toBe('Old Bot');
    await expect(bcrypt.compare('new-password', updatedBot.password)).resolves.toBe(true);
  });

  it('grants the service principal to one newly created project', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'owner-password',
      username: 'Owner',
      role: 1,
    });
    const project = await Project.create({ name: 'Fresh', detail: '', isPublic: false, userId: owner.id });

    const result = await ensureAgentServicePrincipalForProject(sequelize, project.id, {
      email: 'bot@example.com',
      password: 'secret-password',
      username: 'Agent Bot',
    });

    const membership = await Member.findOne({ where: { userId: result.userId, projectId: project.id } });
    expect(result.projectsGranted).toEqual([project.id]);
    expect(membership.role).toBe(1);
  });
});
