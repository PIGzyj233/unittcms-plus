import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Sequelize } from 'sequelize';

import configDefault from '../config/config.js';
import { ensureAgentServicePrincipal, ensureAgentServicePrincipalFromEnv } from '../services/agentServicePrincipal.js';

async function ensureAgentBot(sequelize, { email, password, username = 'Agent Bot' }) {
  return ensureAgentServicePrincipal(sequelize, { email, password, username });
}

function createSequelizeFromEnv(env = process.env) {
  const config = configDefault[env.NODE_ENV || 'production'];
  if (config.use_env_variable) {
    return new Sequelize(env[config.use_env_variable], { ...config, logging: false });
  }
  return new Sequelize({ ...config, logging: false });
}

async function ensureAgentBotFromEnv({ env = process.env, sequelize = createSequelizeFromEnv(env) } = {}) {
  return ensureAgentServicePrincipalFromEnv({ env, sequelize });
}

async function main() {
  const sequelize = createSequelizeFromEnv();
  try {
    const result = await ensureAgentBotFromEnv({ sequelize });
    console.log(
      `Ensured MCP bot user ${result.userId} with developer access to ${result.projectsGranted.length} project(s).`
    );
  } finally {
    await sequelize.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { ensureAgentBot, ensureAgentBotFromEnv };
