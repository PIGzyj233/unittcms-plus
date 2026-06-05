import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendPort = Number.parseInt(process.env.BACKEND_PORT ?? '8001', 10);

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    execSync('npx sequelize-cli db:migrate', {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
    });
    console.log('Database migrations completed successfully.');

    if (process.env.IS_DEMO === 'true' || process.env.IS_DEMO === '1') {
      console.log('Demo mode detected. Seeding the database...');
      execSync('npx sequelize-cli db:seed:all', {
        cwd: path.join(__dirname, 'backend'),
        stdio: 'inherit',
      });
      console.log('Database seeding completed successfully.');
    }
  } catch (error) {
    console.error('Error running database migrations or seeding:', error);
    throw error;
  }
}

async function startBackend() {
  const backendAppModule = await import('./backend/server.js');
  const backendApp = backendAppModule.default || backendAppModule;

  return new Promise((resolve, reject) => {
    const server = backendApp.listen(backendPort, '127.0.0.1', () => {
      console.log(`Backend server is running on http://127.0.0.1:${backendPort}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function startFrontend() {
  process.env.PORT ??= '8000';
  process.env.HOSTNAME ??= '0.0.0.0';
  await import('./server.js');
}

try {
  await runMigrations();
  await startBackend();
  await startFrontend();
} catch (error) {
  console.error('Failed to start application:', error);
  process.exit(1);
}
