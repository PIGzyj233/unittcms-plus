import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineMember from '../../models/members.js';
import defineProject from '../../models/projects.js';
import defineUser from '../../models/users.js';
import projectsNewRoute from './new.js';

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 1;
      next();
    },
  }),
}));

describe('project creation service-principal reconciliation', () => {
  let app;
  let sequelize;
  let Member;
  let User;

  beforeEach(async () => {
    process.env.UNITTCMS_BOT_EMAIL = 'bot@example.com';
    process.env.UNITTCMS_BOT_PASSWORD = 'secret-password';
    process.env.UNITTCMS_BOT_USERNAME = 'Agent Bot';

    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    User = defineUser(sequelize, DataTypes);
    defineProject(sequelize, DataTypes);
    Member = defineMember(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = OFF');
    await User.create({
      id: 1,
      email: 'owner@example.com',
      password: 'owner-password',
      username: 'Owner',
      role: 1,
    });

    app = express();
    app.use(express.json());
    app.use('/projects', projectsNewRoute(sequelize));
  });

  afterEach(async () => {
    delete process.env.UNITTCMS_BOT_EMAIL;
    delete process.env.UNITTCMS_BOT_PASSWORD;
    delete process.env.UNITTCMS_BOT_USERNAME;
    await sequelize.close();
  });

  it('adds the internal agent service principal as developer when creating a project', async () => {
    const res = await request(app).post('/projects').send({ name: 'MCP Project', detail: '', isPublic: false });

    expect(res.status).toBe(200);
    const bot = await User.findOne({ where: { email: 'bot@example.com' } });
    const membership = await Member.findOne({ where: { userId: bot.id, projectId: res.body.id } });
    expect(bot).toMatchObject({ username: 'Agent Bot', role: 1 });
    expect(membership.role).toBe(1);
  });
});
