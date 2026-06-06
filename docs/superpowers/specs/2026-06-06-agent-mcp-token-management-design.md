# Agent MCP Token Management Design

## Status

Approved for specification. Implementation has not started.

## Context

UnitTCMS has an agent-facing MCP server that exposes tools for searching cases, reading folders, creating case candidates, and running dry-run/commit workflows. The current Docker-oriented MCP server uses a deployment-provided `UNITTCMS_MCP_BEARER_TOKEN` to protect the `/mcp` endpoint.

That is useful for initial validation, but it is not a durable product design:

- Operators must provision and rotate a shared secret outside the application.
- The frontend cannot manage token lifecycle.
- The database has no audit trail for token creation, revocation, or last use.
- The token has no structured scope model, so future project-scoped tokens would require a disruptive rewrite.

The desired next step is product-managed MCP token support. For this iteration, tokens are global to the UnitTCMS instance and are not bound to a `projectId`.

## Goals

- Let administrators create, list, and revoke MCP tokens from the UnitTCMS UI.
- Store only hashed MCP tokens in the database.
- Remove the requirement that MCP clients depend on a deployment-defined `UNITTCMS_MCP_BEARER_TOKEN`.
- Keep the current global token behavior: a valid MCP token can access projects visible to the internal agent service principal.
- Add an MCP tool that lists projects currently visible to the MCP server.
- Preserve the existing backend project permission checks for every project-specific query and mutation.
- Keep the design ready for future project-scoped tokens without changing the MCP server entrypoint or tool registration model.

## Non-Goals

- Do not implement project-bound MCP tokens in this iteration.
- Do not implement OAuth authorization-code flows in this iteration.
- Do not let MCP clients provide bot email or bot password.
- Do not store plaintext MCP tokens.
- Do not allow MCP tokens to authenticate normal frontend/backend user workflows.
- Do not bypass existing `/agent/*` dry-run, commit, idempotency, operation token, audit, and project boundary logic.

## MCP Protocol Notes

MCP HTTP clients authenticate with `Authorization: Bearer <token>` on each request. Authorization is transport-level, while project authorization remains application-specific.

The MCP tools specification permits tool lists to vary by the authorization attached to the request. This design keeps a deterministic global tool list for now, but the token validation layer will expose an authorization context so future scoped tokens can filter tools or reject calls without changing tool call plumbing.

## Current Project Separation

The existing MCP tool schemas require `projectId` for project-specific operations. Tool handlers forward `projectId` to backend `/agent/*` routes. Backend route middleware and service helpers then enforce project visibility, developer, or reporter permissions and validate that folders, cases, tags, runs, candidates, operation tokens, and idempotency records belong to the requested project.

This means current project separation is enforced at the backend resource layer. It is not enforced by the MCP bearer token itself.

For this iteration, that remains intentional: the token is global, and backend permissions are based on the internal agent service principal.

## Design Decisions

### Token Scope

Tokens are global for this iteration.

The database model must still include explicit scope fields so the implementation does not bake global-only assumptions into the persistence layer:

- `scopeType`: currently only `global`.
- `projectId`: nullable, always `null` while `scopeType` is `global`.

Future project-scoped tokens can add `scopeType = project` and a non-null `projectId` without replacing the table or MCP request authentication pipeline.

### Token Generation

The backend generates tokens. The frontend only triggers generation and displays the plaintext token once.

Rationale:

- Token entropy belongs on the server.
- The database can atomically store metadata and the hash.
- The frontend never needs to persist the plaintext token.
- This avoids accidental weak client-side token generation.

The token format should be opaque to clients. A stable prefix is acceptable for operator recognition, for example `uttcms_mcp_`, followed by at least 32 bytes of random data encoded with a URL-safe alphabet.

### Token Storage

Store only a cryptographic hash of the full token.

Recommended fields:

- `id`
- `name`
- `tokenHash`
- `tokenPrefix`
- `scopeType`
- `projectId`
- `createdByUserId`
- `lastUsedAt`
- `revokedAt`
- `expiresAt`
- `createdAt`
- `updatedAt`

`tokenHash` must be unique and indexed. `revokedAt` and `expiresAt` are checked during validation. `tokenPrefix` is for display and audit only, not authorization.

Because generated MCP tokens are high-entropy random secrets, SHA-256 of the full token is sufficient for lookup. The implementation must compare hashes using constant-time comparison when comparing in memory. If lookup is done by indexed hash equality, the raw token must still never be logged.

### Token Management API

Global MCP tokens are instance-level credentials, so token management is administrator-only.

Add backend routes under an admin-only namespace:

- `GET /agent/mcp-tokens`: list token metadata, excluding `tokenHash`.
- `POST /agent/mcp-tokens`: create a token and return plaintext once.
- `DELETE /agent/mcp-tokens/:tokenId`: revoke a token by setting `revokedAt`.

The create route accepts:

- `name`: required, short operator label.
- `expiresAt`: optional.

The create route returns:

- `token`: plaintext token, only in this response.
- `record`: token metadata without `tokenHash`.

### Token Validation API

The MCP server needs to validate inbound bearer tokens against the UnitTCMS database.

Add a backend validation endpoint intended only for the MCP server:

- `POST /agent/mcp-tokens/verify`

Input:

- `token`: plaintext bearer token from the MCP request.

Output on success:

- `tokenId`
- `scopeType`
- `projectId`
- `permissions`
- `servicePrincipal`: enough information for the MCP server to authenticate as the internal agent service principal, or a short-lived backend access token if that is implemented.

Output on failure:

- `401` for missing, invalid, revoked, or expired tokens.

The validation endpoint is the only backend endpoint that receives the MCP bearer token. Normal UnitTCMS REST calls made by the MCP server must use the internal service-principal authentication path, not pass through the MCP client token.

### Internal Agent Service Principal

MCP clients only provide the MCP token. They never provide bot email or bot password.

The MCP server may continue to use the existing internal agent service principal implementation as a backend detail, but that detail must be isolated behind the backend client/auth module. Tool handlers must not know how the backend authorization token is obtained.

For the global-token iteration, the service principal is allowed to access projects according to existing UnitTCMS membership and visibility rules. Because the intended product behavior is "global token can operate across the whole instance", the implementation must keep service-principal project access in sync with project lifecycle, not only with container startup.

This iteration will use the existing membership model and must centralize the behavior in a backend helper:

- the startup bootstrap reconciles the service principal into existing projects;
- project creation adds the service principal to the new project;
- the helper owns the selected project role for agent writes;
- tests cover both startup reconciliation and new project creation.

This keeps current permission middleware as the final authority while avoiding duplicated "add the bot user" logic across routes. If UnitTCMS later adds project-scoped tokens, this helper becomes the single place to narrow or replace the service-principal access model.

### MCP HTTP Authentication

The MCP HTTP server no longer compares requests against `UNITTCMS_MCP_BEARER_TOKEN`.

Instead, each `/mcp` request with a bearer token goes through an authentication module:

1. Extract `Authorization: Bearer <token>`.
2. Validate the token with backend token verification.
3. Reject invalid tokens with `401`.
4. Cache successful validation for a short TTL to avoid one backend lookup per JSON-RPC frame.
5. Attach an MCP auth context to the session or request.

The cache key is the token hash, never the raw token. Cache entries must expire quickly and must not ignore revocation for longer than the configured TTL.

For stateful Streamable HTTP sessions, authorization must still be checked on every HTTP request. Session identity is not a substitute for token validation.

### MCP Tool: `list_projects`

Add a new no-argument MCP tool:

- Name: `list_projects`
- Description: `List UnitTCMS projects currently visible to the agent service principal.`
- Input schema: strict empty object.
- Backend call: `GET /projects`

Return shape:

```json
{
  "projects": [
    {
      "id": 1,
      "name": "Example",
      "detail": "Optional detail",
      "isPublic": true,
      "userId": 1,
      "createdAt": "2026-06-06T00:00:00.000Z",
      "updatedAt": "2026-06-06T00:00:00.000Z"
    }
  ]
}
```

The existing `/projects` route returns an array. The MCP tool should wrap it in `{ "projects": [...] }` for consistent structured tool output.

Future scoped-token behavior:

- For global tokens, return all projects visible to the service principal.
- For project tokens, return only the scoped project.
- For read-restricted tokens, return only projects matching granted read scope.

### Frontend UI

Because tokens are global, place management in the admin area rather than project settings.

Add an "Agent MCP" panel to the admin page or a dedicated admin subpage. The UI supports:

- listing tokens by name, prefix, status, last used time, expiry, and creator;
- creating a token with name and optional expiry;
- showing the plaintext token once after creation;
- copying the plaintext token;
- revoking a token.

The UI must not display token hashes. After the one-time plaintext display is dismissed, the token cannot be recovered and must be rotated.

### Documentation

Update README and `docs/docs/dev/agent-mcp.md` so agent setup says:

- create or copy an MCP token from the UnitTCMS admin UI;
- configure the MCP client with the server URL and bearer token;
- agents do not need bot email or password;
- call `list_projects` first to discover `projectId`;
- use project-specific tools with the discovered `projectId`;
- writes still use dry-run and commit tools.

Remove instructions that require operators to create `UNITTCMS_MCP_BEARER_TOKEN` for the normal Docker path. It can remain documented only as a deprecated temporary fallback if kept during migration.

## Data Flow

### Token Creation

1. Admin opens the Agent MCP panel.
2. Admin submits token name and optional expiry.
3. Backend verifies administrator role.
4. Backend generates random token.
5. Backend stores token hash and metadata.
6. Backend returns plaintext token once.
7. Frontend displays and allows copy.

### MCP Request Authentication

1. MCP client sends `Authorization: Bearer <mcp-token>` to `/mcp`.
2. MCP server extracts bearer token.
3. MCP server calls backend token verification.
4. Backend hashes token, finds active record, checks expiry and revocation.
5. Backend updates `lastUsedAt` asynchronously or in a throttled manner.
6. MCP server proceeds with a service-principal backend client.
7. Tool handlers call existing backend APIs.

### Project Discovery

1. Agent calls `list_projects`.
2. MCP server calls `GET /projects`.
3. Backend returns projects visible to the service principal.
4. MCP tool returns `{ projects }`.
5. Agent selects a project and passes its `id` as `projectId` to later tools.

## Error Handling

- Missing MCP bearer token: `401 Unauthorized`.
- Invalid, revoked, or expired MCP token: `401 Unauthorized`.
- Valid token but insufficient future scope: `403 Forbidden`.
- Unknown MCP session: existing Streamable HTTP session error behavior.
- Backend token verification unavailable: MCP request fails with `503` or JSON-RPC server error, with no token value in logs.
- `list_projects` backend failure: tool result has `isError: true` and a concise message.

## Security Requirements

- Never log plaintext MCP tokens.
- Never store plaintext MCP tokens.
- Never send MCP tokens as query string values.
- Never expose token hashes through API responses.
- Token management is administrator-only.
- Revocation must take effect within the MCP auth cache TTL.
- The MCP server must validate authorization on every HTTP request, including requests within an existing MCP session.
- MCP tokens must not be accepted by normal frontend user endpoints.
- Existing backend project permission checks remain the final authority for project-specific data access.

## Testing Plan

Backend tests:

- token create stores hash but not plaintext;
- list excludes `tokenHash`;
- create requires administrator;
- revoke requires administrator;
- verify succeeds for active token;
- verify rejects missing, invalid, revoked, and expired tokens;
- verify updates or schedules `lastUsedAt`;
- future `scopeType` validation only permits `global` for this iteration.

MCP tests:

- unauthenticated `/mcp` returns `401`;
- invalid bearer token returns `401`;
- valid database token can initialize MCP and list tools;
- revoked token stops working after cache TTL;
- `list_projects` is exposed in tool list;
- `list_projects` calls `GET /projects` and wraps the response in `{ projects }`;
- existing project tools still require `projectId`.

Frontend tests:

- admin-only token panel renders for administrators;
- non-admin users cannot create or revoke tokens;
- created token plaintext is shown once;
- token list shows metadata but not hash or plaintext;
- revoke action updates token status.

Docker and end-to-end tests:

- build Docker image;
- run migrations;
- create an MCP token through backend or UI flow;
- configure a test MCP client with that token;
- call `list_projects`;
- call `search_cases` with a discovered project id;
- confirm unauthenticated `/mcp` still returns `401`.

## Migration Plan

1. Add token model and migration.
2. Add backend token management and verification routes.
3. Add MCP auth module that validates tokens through backend.
4. Centralize service-principal reconciliation and call it from startup bootstrap and project creation.
5. Keep temporary env-token compatibility only if needed for transition, behind an explicit deprecated config path.
6. Add `list_projects` tool.
7. Add admin UI.
8. Update README and developer docs.
9. Run backend, MCP, lint, Docker, and E2E verification.

## Maintenance Guardrails

- Keep token validation separate from tool handlers.
- Keep service-principal backend authentication separate from MCP bearer-token validation.
- Keep scope fields in the token record even while only global scope is implemented.
- Keep project-specific authorization inside backend permission middleware and service helpers.
- Keep `list_projects` as the discovery path for agents; do not encode project ids in docs or config examples.
- Keep dry-run/commit semantics for writes; token management must not weaken operation-token safety.
- Avoid adding project-specific shortcuts to the MCP server that bypass backend routes.
