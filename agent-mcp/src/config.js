function readConfig(env = process.env) {
  for (const key of ['UNITTCMS_BACKEND_ORIGIN', 'UNITTCMS_BOT_EMAIL', 'UNITTCMS_BOT_PASSWORD']) {
    if (!env[key]) throw new Error(`${key} is required`);
  }

  return {
    backendOrigin: env.UNITTCMS_BACKEND_ORIGIN.replace(/\/$/, ''),
    botEmail: env.UNITTCMS_BOT_EMAIL,
    botPassword: env.UNITTCMS_BOT_PASSWORD,
  };
}

export { readConfig };
