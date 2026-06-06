import { describe, expect, it } from 'vitest';

import { BackendClient } from './backendClient.js';
import { readConfig } from './config.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe('BackendClient', () => {
  it('trims backend origin and requires bot credentials', () => {
    expect(() => readConfig({})).toThrow('UNITTCMS_BACKEND_ORIGIN is required');
    expect(() =>
      readConfig({
        UNITTCMS_BACKEND_ORIGIN: 'http://localhost:8001',
        UNITTCMS_BOT_EMAIL: 'bot@example.com',
      })
    ).toThrow('UNITTCMS_BOT_PASSWORD is required');

    expect(
      readConfig({
        UNITTCMS_BACKEND_ORIGIN: 'http://localhost:8001/',
        UNITTCMS_BOT_EMAIL: 'bot@example.com',
        UNITTCMS_BOT_PASSWORD: 'secret',
      })
    ).toEqual({
      backendOrigin: 'http://localhost:8001',
      botEmail: 'bot@example.com',
      botPassword: 'secret',
    });
  });

  it('logs in once, caches the JWT, and sends authenticated requests', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/users/signin')) {
        return jsonResponse({ access_token: 'cached-token', expires_at: Date.now() + 60_000 });
      }
      return jsonResponse({ ok: true });
    };
    const client = new BackendClient({
      config: {
        backendOrigin: 'http://backend.test',
        botEmail: 'bot@example.com',
        botPassword: 'secret',
      },
      fetchImpl,
    });

    await expect(client.request('/agent/cases?projectId=1')).resolves.toEqual({ ok: true });
    await expect(client.request('/agent/folders/tree?projectId=1')).resolves.toEqual({ ok: true });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      url: 'http://backend.test/users/signin',
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    });
    expect(JSON.parse(calls[0].options.body)).toEqual({ email: 'bot@example.com', password: 'secret' });
    expect(calls[1].options.headers.Authorization).toBe('Bearer cached-token');
    expect(calls[2].options.headers.Authorization).toBe('Bearer cached-token');
  });

  it('clears the cached JWT and retries once after a 401', async () => {
    const calls = [];
    let loginCount = 0;
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/users/signin')) {
        loginCount += 1;
        return jsonResponse({ access_token: `token-${loginCount}`, expires_at: Date.now() + 60_000 });
      }
      if (calls.filter((call) => call.url.endsWith('/agent/cases?projectId=1')).length === 1) {
        return jsonResponse({ error: 'Expired' }, { ok: false, status: 401 });
      }
      return jsonResponse({ cases: [] });
    };
    const client = new BackendClient({
      config: {
        backendOrigin: 'http://backend.test',
        botEmail: 'bot@example.com',
        botPassword: 'secret',
      },
      fetchImpl,
    });

    await expect(client.request('/agent/cases?projectId=1')).resolves.toEqual({ cases: [] });

    expect(loginCount).toBe(2);
    const backendCalls = calls.filter((call) => call.url.endsWith('/agent/cases?projectId=1'));
    expect(backendCalls).toHaveLength(2);
    expect(backendCalls[0].options.headers.Authorization).toBe('Bearer token-1');
    expect(backendCalls[1].options.headers.Authorization).toBe('Bearer token-2');
  });
});
