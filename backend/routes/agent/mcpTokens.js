import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import express from 'express';
import { DataTypes } from 'sequelize';

import authMiddleware from '../../middleware/auth.js';
import defineMcpToken from '../../models/mcpTokens.js';
import defineUser from '../../models/users.js';

const TOKEN_PREFIX = 'uttcms_mcp_';
const TOKEN_RANDOM_BYTES = 32;
const TOKEN_PREFIX_LENGTH = 22;
const GLOBAL_PERMISSIONS = ['projects:read', 'agent:read', 'agent:write'];

function generateMcpToken() {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_RANDOM_BYTES).toString('base64url')}`;
}

function hashMcpToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseExpiry(value) {
  if (value === undefined || value === null || value === '') return null;
  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    const error = new Error('expiresAt must be a valid date');
    error.status = 400;
    throw error;
  }
  return expiresAt;
}

function getStatus(record, now = new Date()) {
  if (record.revokedAt) return 'revoked';
  if (record.expiresAt && record.expiresAt <= now) return 'expired';
  return 'active';
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

function serializeToken(record, { createdBy = null, now = new Date() } = {}) {
  return {
    id: record.id,
    name: record.name,
    tokenPrefix: record.tokenPrefix,
    scopeType: record.scopeType,
    projectId: record.projectId,
    createdByUserId: record.createdByUserId,
    createdBy: serializeUser(createdBy),
    lastUsedAt: record.lastUsedAt ? record.lastUsedAt.toISOString() : null,
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    status: getStatus(record, now),
    createdAt: record.createdAt ? record.createdAt.toISOString() : null,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
  };
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function forbidden(res) {
  return res.status(403).json({ error: 'Forbidden' });
}

async function loadCreatedByUsers(User, tokens) {
  const userIds = [...new Set(tokens.map((token) => token.createdByUserId).filter((userId) => userId !== null))];
  if (userIds.length === 0) return new Map();
  const users = await User.findAll({ where: { id: userIds } });
  return new Map(users.map((user) => [user.id, user]));
}

export default function mcpTokensRoute(sequelize) {
  const router = express.Router();
  const { verifySignedIn, verifyAdmin } = authMiddleware(sequelize);
  const McpToken = defineMcpToken(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);

  router.get('/', verifySignedIn, verifyAdmin, async (_req, res) => {
    try {
      const tokens = await McpToken.findAll({ order: [['createdAt', 'DESC']] });
      const usersById = await loadCreatedByUsers(User, tokens);
      res.json({
        tokens: tokens.map((token) => serializeToken(token, { createdBy: usersById.get(token.createdByUserId) })),
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.post('/', verifySignedIn, verifyAdmin, async (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      if (name.length > 120) return res.status(400).json({ error: 'name must be 120 characters or fewer' });
      if (req.body?.scopeType && req.body.scopeType !== 'global') {
        return res.status(400).json({ error: 'scopeType must be global' });
      }
      if (req.body?.projectId !== undefined && req.body.projectId !== null) {
        return res.status(400).json({ error: 'projectId must be null for global tokens' });
      }

      const token = generateMcpToken();
      const record = await McpToken.create({
        name,
        tokenHash: hashMcpToken(token),
        tokenPrefix: token.slice(0, TOKEN_PREFIX_LENGTH),
        scopeType: 'global',
        projectId: null,
        createdByUserId: req.userId,
        expiresAt: parseExpiry(req.body?.expiresAt),
      });
      const createdBy = await User.findByPk(req.userId);

      res.status(201).json({ token, record: serializeToken(record, { createdBy }) });
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal Server Error' });
    }
  });

  router.post('/verify', async (req, res) => {
    try {
      const token = req.body?.token;
      if (!token || typeof token !== 'string') return unauthorized(res);

      const tokenHash = hashMcpToken(token);
      const record = await McpToken.findOne({ where: { tokenHash } });
      if (!record || !safeEqualHex(record.tokenHash, tokenHash)) return unauthorized(res);
      if (record.revokedAt || (record.expiresAt && record.expiresAt <= new Date())) return unauthorized(res);
      if (record.scopeType !== 'global' || record.projectId !== null) return forbidden(res);

      await record.update({ lastUsedAt: new Date() });

      res.json({
        tokenId: record.id,
        scopeType: record.scopeType,
        projectId: record.projectId,
        permissions: GLOBAL_PERMISSIONS,
        servicePrincipal: { strategy: 'internal-agent-service-principal' },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.delete('/:tokenId', verifySignedIn, verifyAdmin, async (req, res) => {
    try {
      const record = await McpToken.findByPk(req.params.tokenId);
      if (!record) return res.status(404).json({ error: 'Token not found' });

      if (!record.revokedAt) {
        await record.update({ revokedAt: new Date() });
      }
      const createdBy = record.createdByUserId ? await User.findByPk(record.createdByUserId) : null;

      res.json({ record: serializeToken(record, { createdBy }) });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}

export { generateMcpToken, hashMcpToken, serializeToken };
