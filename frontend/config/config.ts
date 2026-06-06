const Config = {
  appName: 'unittcms-plus',
  repositoryUrl: 'https://github.com/PIGzyj233/unittcms-plus',

  apiServer: process.env.NEXT_PUBLIC_BACKEND_ORIGIN || '/api',

  // set 'NEXT_PUBLIC_IS_DEMO=true' in frontend/.env
  isDemoSite: process.env.NEXT_PUBLIC_IS_DEMO === 'true' || false,
};

export default Config;
