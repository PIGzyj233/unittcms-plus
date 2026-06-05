# Repository Guidelines

## Project Overview

UnitTCMS is a self-hosted test case management system. The repository contains a Next.js frontend, an Express/Sequelize API, Docusaurus docs, and Playwright/Vitest tests.

## Layout

- `frontend/`: Next.js 14 app-router frontend. Locale routes live under `frontend/src/app/[locale]`; shared UI is in `frontend/components`; API helpers and client utilities are in `frontend/utils`; translations are in `frontend/messages`.
- `backend/`: Express API using ES modules, Sequelize, and SQLite. `backend/server.js` wires all routes; route handlers are grouped by resource under `backend/routes`; models and migrations live in `backend/models` and `backend/migrations`.
- `docs/`: Docusaurus documentation site.
- `e2e/`: Playwright tests. These tests assume the app is available at `http://localhost:8000`.
- Root config files own shared tooling: ESLint, Prettier, Vitest, Playwright, Docker, and the combined production entrypoint.

## Package Management

This repo does not use npm workspaces. There are separate lockfiles at the root, `frontend/`, `backend/`, and `docs/`. Run install commands in the package directory you are working in.

Use Node.js 20 or newer.

## Common Commands

Root:

- `npm run lint`: run ESLint across the repo.
- `npm run lint:fix`: run ESLint with fixes.
- `npm run format:check`: check Prettier formatting for frontend/backend source.
- `npm run format`: format frontend/backend source.
- `npm test`: run Vitest in watch mode.
- `npm run coverage`: run Vitest once with coverage.
- `npm run e2e`: run Playwright tests.
- `npm run report`: view the Playwright HTML report.

Backend:

- `cd backend && npm run migrate`: apply Sequelize migrations to `backend/database/database.sqlite`.
- `cd backend && npm run seed`: seed demo data.
- `cd backend && npm run drop`: undo all migrations.
- `cd backend && npm run dev`: start the API without requiring `backend/.env`.
- `cd backend && npm run start`: start the API with `node --env-file=.env index`.

Frontend:

- `cd frontend && npm run dev`: start Next.js on port 8000.
- `cd frontend && npm run build`: build the frontend.
- `cd frontend && npm run start`: serve the production frontend on port 8000.

Docs:

- `cd docs && npm run start`: run the Docusaurus docs site.
- `cd docs && npm run build`: build docs.

Full app:

- `docker-compose up --build`: build and run the combined app at `http://localhost:8000`.

## Local Environment

For split frontend/backend development, the docs expect:

- `backend/.env`: `FRONTEND_ORIGIN=http://localhost:8000`
- `frontend/.env`: `NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8001`

`SECRET_KEY` should be set for realistic auth work. Without it, the backend falls back to a default development key and logs a warning.

The Docker setup serves both API and frontend from port 8000, with the API mounted under `/api`. The standalone backend defaults to port 8001.

## Testing Notes

- Vitest uses the root `vitest.config.ts` and aliases `@` to `./frontend`.
- Unit tests are colocated with source, for example `frontend/utils/*.test.ts`, `frontend/messages/strings.test.ts`, and backend route tests such as `backend/routes/**/**/*.test.js`.
- Playwright tests use hard-coded `http://localhost:8000` URLs and do not start a web server automatically. Start Docker or the frontend/backend servers before running `npm run e2e`.
- E2E tests can create screenshots under `playwright-screenshots/`; do not commit generated screenshots or reports unless explicitly requested.

## Code Conventions

- Keep ES module syntax in backend/root JavaScript.
- Follow existing import ordering; ESLint enforces `import/order` and unused variable checks.
- Frontend components use TypeScript, React 18, HeroUI, Tailwind CSS, next-intl, and Next app-router conventions.
- When adding or changing user-facing frontend text, update all locale JSON files in `frontend/messages`. The message consistency test expects matching keys across locales.
- Backend route modules generally export a function that receives a Sequelize instance and returns an Express router. Keep auth/visibility/editability checks aligned with neighboring route handlers.
- SQLite data and uploaded files are local runtime state under `backend/database` and `backend/public/uploads`; avoid treating them as source changes.
