<p align="center">
  <img width="20%" src="./frontend/public/favicon/icon-192.png" alt="unittcms-plus" />
  <h1 align="center">unittcms-plus</h1>
</p>

unittcms-plus is a self-hosted test case management system based on the original UnitTCMS project. This project includes foundational upgrades and ongoing AI-oriented adaptation work for agent-assisted test case management.

unittcms-plus will be maintained as a separate downstream project. Future development is not planned to be merged back into the original UnitTCMS repository.

## Getting Started

```bash
git clone https://github.com/PIGzyj233/unittcms-plus
```

and start containers with the following command.

```bash
cd unittcms-plus
docker-compose up --build
```

You can access the app at `http://localhost:8000`

## Agent MCP usage

unittcms-plus includes an MCP server for coding agents and other MCP-compatible clients. In Docker, the MCP server runs in the same container as the frontend and backend and exposes a Streamable HTTP endpoint on port `3333`.

### Start the MCP server

Create a local `.env` file if you want to customize the published ports or the internal agent service account:

```bash
UNITTCMS_WEB_PORT=8000
UNITTCMS_MCP_PUBLISHED_PORT=3333
```

Then start the container:

```bash
docker compose --env-file .env up --build
```

The default Docker bot account is:

- Email: `bot@norelpy.com`
- Password: `iambot2333`

During startup, unittcms-plus ensures this bot user exists and grants it developer access to existing projects. Override `UNITTCMS_BOT_EMAIL` and `UNITTCMS_BOT_PASSWORD` in `.env` if you want a different service account.

### Create an MCP token

After signing in as an administrator, open **Administration -> Agent MCP**, create an MCP token, and copy the plaintext token when it is shown. unittcms-plus stores only a hash of the token and cannot show it again later.

Agents do not need the bot email or bot password. They authenticate to the MCP endpoint with:

```text
Authorization: Bearer <MCP token copied from the admin UI>
```

Keep the token in an environment variable or a private local agent config. Do not commit plaintext MCP tokens.

```bash
export UNITTCMS_MCP_TOKEN="<token copied from Administration -> Agent MCP>"
```

If your agent runs on another machine, replace `localhost` with the host or intranet IP where unittcms-plus publishes port `3333`:

```text
http://<intranet-server-ip>:3333/mcp
```

### Add unittcms-plus MCP to agents

#### Codex CLI, IDE extension, or Codex app

Codex shares MCP configuration between the CLI, IDE extension, and app through `config.toml`. You can register unittcms-plus from the CLI:

```bash
codex mcp add unittcms-agent --url http://localhost:3333/mcp \
  --bearer-token-env-var UNITTCMS_MCP_TOKEN
```

Or add it manually to `~/.codex/config.toml` or a trusted project-scoped `.codex/config.toml`:

```toml
[mcp_servers.unittcms-agent]
url = "http://localhost:3333/mcp"
bearer_token_env_var = "UNITTCMS_MCP_TOKEN"
```

If you launch Codex from the macOS GUI and it cannot see your shell environment, set the token in the launch environment before opening Codex, then restart Codex:

```bash
launchctl setenv UNITTCMS_MCP_TOKEN "<token copied from Administration -> Agent MCP>"
```

Inside Codex, use `/mcp` to confirm that `unittcms-agent` is connected.

#### Claude Code

For Claude Code, prefer an environment-variable based project config so the token is not written into git. Add a `.mcp.json` file at the project root:

```json
{
  "mcpServers": {
    "unittcms-agent": {
      "type": "http",
      "url": "${UNITTCMS_MCP_URL:-http://localhost:3333/mcp}",
      "headers": {
        "Authorization": "Bearer ${UNITTCMS_MCP_TOKEN}"
      }
    }
  }
}
```

Then start Claude Code from a shell where the token is available:

```bash
export UNITTCMS_MCP_TOKEN="<token copied from Administration -> Agent MCP>"
claude
```

Claude Code prompts before using project-scoped MCP servers. Approve the `unittcms-agent` server when prompted, then run `/mcp` to verify the connection.

If you want a private user-scoped config instead, you can add the server with the CLI:

```bash
claude mcp add --transport http --scope user unittcms-agent http://localhost:3333/mcp \
  --header "Authorization: Bearer $UNITTCMS_MCP_TOKEN"
```

This command may store the expanded token in your local Claude config. Use the `.mcp.json` form above when you want to share the server definition without sharing secrets.

#### Other MCP clients and custom agents

Use Streamable HTTP with a bearer authorization header. Many JSON-based MCP clients use a shape similar to:

```json
{
  "mcpServers": {
    "unittcms-agent": {
      "type": "streamable-http",
      "url": "http://localhost:3333/mcp",
      "headers": {
        "Authorization": "Bearer ${UNITTCMS_MCP_TOKEN}"
      }
    }
  }
}
```

Some clients call the transport `http` instead of `streamable-http`; use the name expected by your client. If your client does not expand environment variables in headers, keep the token in that client's private local secret store or private config file.

### Using the tools

Start with `list_projects` to discover a `projectId`, then pass that id to project-specific tools such as `search_cases`, `get_case`, `get_folder_tree`, `ensure_folder_path_dry_run`, `ensure_folder_path_commit`, `create_case_candidate`, `list_case_candidates`, `accept_case_candidates_dry_run`, `accept_case_candidates_commit`, `create_run_dry_run`, `create_run_commit`, `add_cases_to_run_dry_run`, and `add_cases_to_run_commit`.

Writes go through backend `/agent/*` endpoints. High-impact writes use dry-run and commit tools with one-time operation tokens, so the normal flow is: ask the agent to dry-run, review the proposed changes, then ask it to commit with the returned operation token.

Quick checks:

```bash
curl http://localhost:3333/health
curl -i -X POST http://localhost:3333/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

The health check should return `{"ok":true}`. The unauthenticated MCP request should return `401 Unauthorized`.

To verify an authenticated request at the HTTP layer, include the bearer header:

```bash
curl -i -X POST http://localhost:3333/mcp \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $UNITTCMS_MCP_TOKEN" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-check","version":"0.0.1"}}}'
```

If an agent stops connecting after token rotation or revocation, update `UNITTCMS_MCP_TOKEN` in that agent's environment, restart the agent session, and check the server status with `/mcp` or the client's MCP status command.

## Why unittcms-plus

There are many test case management tools available in the market, which can be categorized into proprietary and open-source solutions.

Proprietary tools often come with modern, user-friendly interfaces but tend to be cloud-based, which may raise security concerns for some organizations. While some of them do offer on-premises options, these tend to be significantly more expensive.

There are also open-source tools, but many feature older user interfaces that involve frequent full page reloads, which can hinder usability.

With these challenges in mind, I set out to develop a modern, user-friendly, open-source test case management tool that anyone can use for free in a secure, self-hosted environment.

## Features

### Project-Based

Manage test cases and test runs on a project-by-project basis. Our dashboard provides an at-a-glance view of the types of test cases and their progress for each project. This allows you to monitor project status in real-time and manage efficiently.

![Project-Based](./frontend/public/top/light/project.png)

<hr />

### Test case management

Create folders within projects and define test cases with ease using our modern and intuitive UI. Attaching files enables detailed explanations of test cases, making it easy to share information across the entire team.

![Test Case Management](./frontend/public/top/light/case.png)

<hr />

### Test run management

Defined test cases can be reused multiple times in test runs, enabling efficient test cycles. Additionally, you can visually monitor the status of test runs and projects.

![Test Run Management](./frontend/public/top/light/run.png)

<hr />

### Project member management

Support team development by adding or removing members from projects. You can assign roles and set permissions for each member in detail. We provide three main roles: 'Manager' who manages the entire project, 'Developer' who designs the tests, and 'Reporter' who executes the tests.

![Member Management](./frontend/public/top/light/member.png)

## Supported Languages

unittcms-plus currently supports the following languages:

- German (de)
- English (en)
- Portuguese (pt-BR)
- Chinese (zh-CN)
- Japanese (ja)

If you would like to add support for another language, feel free to submit a pull request.
