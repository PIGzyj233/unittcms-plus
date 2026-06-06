class BackendClient {
  constructor({ config, fetchImpl = fetch }) {
    this.config = config;
    this.fetch = fetchImpl;
    this.token = null;
  }

  async login() {
    const response = await this.fetch(`${this.config.backendOrigin}/users/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.config.botEmail, password: this.config.botPassword }),
    });
    if (!response.ok) throw new Error(`Bot login failed with ${response.status}`);
    this.token = await response.json();
  }

  async verifyMcpToken(token) {
    const response = await this.fetch(`${this.config.backendOrigin}/agent/mcp-tokens/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.error || `MCP token verification failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async request(path, options = {}, retry = true) {
    if (!this.token || this.token.expires_at <= Date.now()) await this.login();

    const response = await this.fetch(`${this.config.backendOrigin}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token.access_token}`,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401 && retry) {
      this.token = null;
      return this.request(path, options, false);
    }

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Backend request failed with ${response.status}`);
    return body;
  }
}

export { BackendClient };
