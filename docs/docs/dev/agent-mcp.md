---
sidebar_position: 5
---

# Agent MCP Server

The UnitTCMS agent MCP server is a standalone process that exposes structured tools to MCP-compatible clients. It does not call an LLM and does not read SQLite or Sequelize models directly.

## Configuration

- `UNITTCMS_BACKEND_ORIGIN`: backend origin, for example `http://localhost:8001`
- `UNITTCMS_BOT_EMAIL`: bot account email
- `UNITTCMS_BOT_PASSWORD`: bot account password

The bot signs in through `/users/signin`, caches the JWT, and retries sign-in once after a 401 response.

## Safety Model

All writes go through backend `/agent/*` endpoints. High-impact writes use dry-run and commit semantics with one-time operation tokens. Idempotency keys are scoped by bot user, operation type, and key for 24 hours.

## Tools

The first version supports formal case search/read, folder tree inspection, safe folder path creation, case candidate creation/listing/acceptance, and dry-run/commit test run creation.
