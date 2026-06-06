---
sidebar_position: 5
---

# Agent MCP Server

The UnitTCMS agent MCP server exposes structured tools to MCP-compatible clients. It does not call an LLM and does not read SQLite or Sequelize models directly.

The Docker image runs the MCP server inside the same container as the frontend and backend. The default streamable HTTP endpoint is:

```text
http://<intranet-server-ip>:3333/mcp
```

Health checks are available at:

```text
http://<intranet-server-ip>:3333/health
```

## Configuration

- `UNITTCMS_BACKEND_ORIGIN`: backend origin, for example `http://localhost:8001`
- `UNITTCMS_BOT_EMAIL`: bot account email
- `UNITTCMS_BOT_PASSWORD`: bot account password
- `UNITTCMS_MCP_HOST`: MCP HTTP bind host, default `0.0.0.0` in Docker
- `UNITTCMS_MCP_PORT`: MCP HTTP port, default `3333`
- `UNITTCMS_MCP_AUTH_CACHE_TTL_MS`: backend token verification cache TTL, default `30000`

The bot signs in through `/users/signin`, caches the JWT, and retries sign-in once after a 401 response.

During Docker startup, UnitTCMS ensures the configured bot user exists and grants it developer access to every existing project. Project creation also grants the bot developer access to the new project. If demo seeding is enabled, seeding runs before this bot bootstrap.

The Docker image and checked-in Docker Compose file provide development defaults for the bot account:

```bash
UNITTCMS_BOT_EMAIL=bot@norelpy.com \
UNITTCMS_BOT_PASSWORD='iambot2333' \
docker compose up --build
```

If the bot email or password is not set, the Docker container skips the MCP HTTP server and still starts the UnitTCMS web application.

Verify the Docker endpoint from the host:

```bash
curl http://localhost:3333/health
```

The health endpoint should return:

```json
{ "ok": true }
```

## Creating Client Tokens

MCP clients authenticate with product-managed tokens:

1. Sign in to UnitTCMS as an administrator.
2. Open **Administration -> Agent MCP**.
3. Create a token with a short operator label and optional expiry.
4. Copy the plaintext token immediately. UnitTCMS stores only a hash and cannot recover it later.

MCP requests to `/mcp` must include `Authorization: Bearer <token copied from the admin UI>`. A request without that header should return `401 Unauthorized`.

For Codex, register the HTTP MCP server with the exposed intranet URL and bearer token:

```bash
launchctl setenv UNITTCMS_MCP_TOKEN '<token copied from Administration -> Agent MCP>'
codex mcp add unittcms-agent --url http://<intranet-server-ip>:3333/mcp \
  --bearer-token-env-var UNITTCMS_MCP_TOKEN
```

Agents do not need the bot email or bot password. Those are internal server-side service-principal details.

## Safety Model

All writes go through backend `/agent/*` endpoints. High-impact writes use dry-run and commit semantics with one-time operation tokens. Idempotency keys are scoped by bot user, operation type, and key for 24 hours.

The MCP HTTP endpoint is intended for trusted intranet access. Create separate MCP tokens per operator or client and revoke tokens that are no longer needed.

## Tools

Call `list_projects` first to discover the `projectId` values currently visible to the agent service principal. Then pass the selected `projectId` to project-specific tools.

The server supports project discovery, formal case search/read, folder tree inspection, safe folder path creation, case candidate creation/listing/acceptance, and dry-run/commit test run creation.
