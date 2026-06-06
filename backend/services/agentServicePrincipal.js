import bcrypt from 'bcrypt';
import { DataTypes } from 'sequelize';

import defineMember from '../models/members.js';
import defineProject from '../models/projects.js';
import defineUser from '../models/users.js';
import { memberRoles, roles } from '../routes/users/authSettings.js';

const DEFAULT_AGENT_USERNAME = 'Agent Bot';

function model(sequelize, name, defineModel) {
  return sequelize.models[name] || defineModel(sequelize, DataTypes);
}

function selectedUserRole() {
  return roles.findIndex((entry) => entry.uid === 'user');
}

function selectedProjectRole() {
  return memberRoles.findIndex((entry) => entry.uid === 'developer');
}

function readAgentServicePrincipalConfig(env = process.env, { allowMissing = false } = {}) {
  const email = env.UNITTCMS_BOT_EMAIL;
  const password = env.UNITTCMS_BOT_PASSWORD;
  if (!email || !password) {
    if (allowMissing) return null;
    throw new Error('UNITTCMS_BOT_EMAIL and UNITTCMS_BOT_PASSWORD are required');
  }

  return {
    email,
    password,
    username: env.UNITTCMS_BOT_USERNAME || DEFAULT_AGENT_USERNAME,
  };
}

async function ensureAgentUser(sequelize, { email, password, username = DEFAULT_AGENT_USERNAME }) {
  const User = model(sequelize, 'User', defineUser);
  const userRole = selectedUserRole();
  const hashedPassword = await bcrypt.hash(password, 10);

  const [bot, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      email,
      password: hashedPassword,
      username,
      role: userRole,
    },
  });

  if (!created) {
    await bot.update({
      password: hashedPassword,
      username: bot.username || username,
      role: bot.role ?? userRole,
    });
  }

  return bot;
}

async function ensureAgentMembershipForProject(sequelize, bot, project) {
  if (!project || project.userId === bot.id) return null;

  const Member = model(sequelize, 'Member', defineMember);
  const developerRole = selectedProjectRole();
  const [member] = await Member.findOrCreate({
    where: { userId: bot.id, projectId: project.id },
    defaults: { userId: bot.id, projectId: project.id, role: developerRole },
  });

  if (member.role !== developerRole) {
    await member.update({ role: developerRole });
  }

  return project.id;
}

async function ensureAgentServicePrincipal(sequelize, config) {
  const bot = await ensureAgentUser(sequelize, config);
  const Project = model(sequelize, 'Project', defineProject);
  const projects = await Project.findAll({ order: [['id', 'ASC']] });
  const projectsGranted = [];

  for (const project of projects) {
    const projectId = await ensureAgentMembershipForProject(sequelize, bot, project);
    if (projectId !== null) projectsGranted.push(projectId);
  }

  return { userId: bot.id, projectsGranted };
}

async function ensureAgentServicePrincipalForProject(sequelize, projectId, config) {
  const bot = await ensureAgentUser(sequelize, config);
  const Project = model(sequelize, 'Project', defineProject);
  const project = await Project.findByPk(projectId);
  const grantedProjectId = await ensureAgentMembershipForProject(sequelize, bot, project);

  return {
    userId: bot.id,
    projectsGranted: grantedProjectId === null ? [] : [grantedProjectId],
  };
}

async function ensureAgentServicePrincipalFromEnv({ env = process.env, sequelize } = {}) {
  return ensureAgentServicePrincipal(sequelize, readAgentServicePrincipalConfig(env));
}

async function ensureAgentServicePrincipalForProjectFromEnv(sequelize, projectId, env = process.env) {
  const config = readAgentServicePrincipalConfig(env, { allowMissing: true });
  if (!config) return null;
  return ensureAgentServicePrincipalForProject(sequelize, projectId, config);
}

export {
  ensureAgentServicePrincipal,
  ensureAgentServicePrincipalForProject,
  ensureAgentServicePrincipalForProjectFromEnv,
  ensureAgentServicePrincipalFromEnv,
  readAgentServicePrincipalConfig,
  selectedProjectRole,
};
