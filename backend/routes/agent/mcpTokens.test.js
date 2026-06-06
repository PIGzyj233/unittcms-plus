import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import defineMcpToken from '../../models/mcpTokens.js';
import defineUser from '../../models/users.js';
import mcpTokensRoute from './mcpTokens.js';

vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: (req, res, next) => {
      req.userId = 1;
      next();
    },
    verifyAdmin: (req, res, next) => {
      if (req.header('x-test-admin') === 'false') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return next();
    },
  }),
}));

describe('agent MCP token routes', () => {
  let app;
  let sequelize;
  let McpToken;
  let User;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
    User = defineUser(sequelize, DataTypes);
    McpToken = defineMcpToken(sequelize, DataTypes);
    await sequelize.sync({ force: true });
    await User.create({
      id: 1,
      email: 'admin@example.com',
      password: 'hashed-password',
      username: 'Admin',
      role: 0,
    });

    app = express();
    app.use(express.json());
    app.use('/agent/mcp-tokens', mcpTokensRoute(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('creates a high-entropy token, returns plaintext once, and stores only a hash', async () => {
    const res = await request(app).post('/agent/mcp-tokens').send({ name: 'Codex local', expiresAt: null });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^uttcms_mcp_[A-Za-z0-9_-]{43,}$/);
    expect(res.body.record).toMatchObject({
      name: 'Codex local',
      tokenPrefix: expect.stringMatching(/^uttcms_mcp_/),
      scopeType: 'global',
      projectId: null,
      createdByUserId: 1,
      revokedAt: null,
      expiresAt: null,
    });
    expect(res.body.record).not.toHaveProperty('tokenHash');

    const stored = await McpToken.findByPk(res.body.record.id);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toContain(res.body.token);
  });

  it('lists token metadata without hashes or plaintext tokens', async () => {
    const createRes = await request(app).post('/agent/mcp-tokens').send({ name: 'Inspector' });

    const listRes = await request(app).get('/agent/mcp-tokens');

    expect(listRes.status).toBe(200);
    expect(listRes.body.tokens).toEqual([
      expect.objectContaining({
        id: createRes.body.record.id,
        name: 'Inspector',
        status: 'active',
        createdByUserId: 1,
        createdBy: expect.objectContaining({ email: 'admin@example.com', username: 'Admin' }),
      }),
    ]);
    expect(JSON.stringify(listRes.body)).not.toContain('tokenHash');
    expect(JSON.stringify(listRes.body)).not.toContain(createRes.body.token);
  });

  it('requires administrators to create and revoke tokens', async () => {
    const createRes = await request(app)
      .post('/agent/mcp-tokens')
      .set('x-test-admin', 'false')
      .send({ name: 'Denied' });

    expect(createRes.status).toBe(403);

    const allowedCreate = await request(app).post('/agent/mcp-tokens').send({ name: 'Allowed' });
    const revokeRes = await request(app)
      .delete(`/agent/mcp-tokens/${allowedCreate.body.record.id}`)
      .set('x-test-admin', 'false');

    expect(revokeRes.status).toBe(403);
  });

  it('revokes by setting revokedAt and verification rejects the token', async () => {
    const createRes = await request(app).post('/agent/mcp-tokens').send({ name: 'Rotate me' });

    const revokeRes = await request(app).delete(`/agent/mcp-tokens/${createRes.body.record.id}`);
    const verifyRes = await request(app).post('/agent/mcp-tokens/verify').send({ token: createRes.body.token });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.record.revokedAt).toEqual(expect.any(String));
    expect(revokeRes.body.record.status).toBe('revoked');
    expect(verifyRes.status).toBe(401);
  });

  it('verifies active tokens, updates lastUsedAt, and exposes global auth context', async () => {
    const createRes = await request(app).post('/agent/mcp-tokens').send({ name: 'Active' });

    const verifyRes = await request(app).post('/agent/mcp-tokens/verify').send({ token: createRes.body.token });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toMatchObject({
      tokenId: createRes.body.record.id,
      scopeType: 'global',
      projectId: null,
      permissions: ['projects:read', 'agent:read', 'agent:write'],
      servicePrincipal: { strategy: 'internal-agent-service-principal' },
    });

    const stored = await McpToken.findByPk(createRes.body.record.id);
    expect(stored.lastUsedAt).toBeInstanceOf(Date);
  });

  it('rejects missing, invalid, expired, and future non-global tokens', async () => {
    const expiredCreate = await request(app)
      .post('/agent/mcp-tokens')
      .send({ name: 'Expired', expiresAt: new Date(Date.now() - 60_000).toISOString() });
    const futureScopedToken = 'uttcms_mcp_future_scope_token';
    await McpToken.create({
      name: 'Project future',
      tokenHash: createHash('sha256').update(futureScopedToken).digest('hex'),
      tokenPrefix: 'uttcms_mcp_future',
      scopeType: 'project',
      projectId: 123,
      createdByUserId: 1,
    });

    const missing = await request(app).post('/agent/mcp-tokens/verify').send({});
    const invalid = await request(app).post('/agent/mcp-tokens/verify').send({ token: 'uttcms_mcp_nope' });
    const expired = await request(app).post('/agent/mcp-tokens/verify').send({ token: expiredCreate.body.token });
    const projectScoped = await request(app).post('/agent/mcp-tokens/verify').send({ token: futureScopedToken });

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(projectScoped.status).toBe(403);
  });
});
