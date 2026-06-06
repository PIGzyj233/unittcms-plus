<p align="center">
  <a href="https://www.unittcms.org/en">
    <img width="20%" src="https://raw.githubusercontent.com/kimatata/unittcms/refs/heads/main/frontend/public/favicon/icon-192.png" alt="UnitTCMS" />
    <h1 align="center">UnitTCMS</h1>
  </a>
</p>
</br>
<p align="center">
  <a href="https://github.com/kimatata/unittcms/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/kimatata/unittcms" alt="License">
  </a>
  <a href="https://github.com/kimatata/unittcms/releases">
    <img src="https://img.shields.io/github/v/release/kimatata/unittcms" alt="Release">
  </a>
</p>

UnitTCMS is an open source test case management system. The application is free and designed for self-hosted use. It can be used in environments with strict security requirements. For more information, please visit the demo site and docs.

[🧪Demo](https://www.unittcms.org)

[📘Docs](https://kimatata.github.io/unittcms/docs)

## Getting Started

```bash
git clone https://github.com/kimatata/unittcms.git
```

and start containers with the following command.

```bash
cd unittcms
docker-compose up --build
```

You can access the app at `http://localhost:8000`

[Looking for a non-Docker way?](https://kimatata.github.io/unittcms/docs/getstarted/from-source)

## Agent MCP usage

UnitTCMS includes an MCP server for coding agents and other MCP-compatible clients. In Docker, the MCP server runs in the same container as the frontend and backend and exposes a streamable HTTP endpoint on port `3333`.

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

During startup, UnitTCMS ensures this bot user exists and grants it developer access to existing projects. Override `UNITTCMS_BOT_EMAIL` and `UNITTCMS_BOT_PASSWORD` in `.env` if you want a different service account.

After signing in as an administrator, open **Administration -> Agent MCP**, create an MCP token, and copy the plaintext token when it is shown. UnitTCMS stores only a hash of the token and cannot show it again later.

Register the MCP server in Codex:

```bash
launchctl setenv UNITTCMS_MCP_TOKEN "<token copied from Administration -> Agent MCP>"
codex mcp add unittcms-agent --url http://localhost:3333/mcp \
  --bearer-token-env-var UNITTCMS_MCP_TOKEN
```

For another agent or MCP client, connect to:

```text
http://<intranet-server-ip>:3333/mcp
```

and send:

```text
Authorization: Bearer <MCP token copied from the admin UI>
```

Agents do not need the bot email or bot password. Start with `list_projects` to discover a `projectId`, then pass that id to project-specific tools such as `search_cases`, `get_case`, `get_folder_tree`, `create_case_candidate`, `list_case_candidates`, `accept_case_candidates_dry_run`, `accept_case_candidates_commit`, `create_run_dry_run`, and `create_run_commit`. Writes go through backend `/agent/*` endpoints; high-impact writes use dry-run and commit tools with one-time operation tokens.

Quick checks:

```bash
curl http://localhost:3333/health
curl -i -X POST http://localhost:3333/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

The health check should return `{"ok":true}`. The unauthenticated MCP request should return `401 Unauthorized`.

## Why UnitTCMS

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

UnitTCMS currently supports the following languages:

- German (de)
- English (en)
- Portuguese (pt-BR)
- Chinese (zh-CN)
- Japanese (ja)

If you would like to add support for another language, feel free to submit a pull request. For reference, you can see how Portuguese was added in [PR #260](https://github.com/kimatata/unittcms/pull/260).
