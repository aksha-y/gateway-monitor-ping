import https from 'https';

// UniFi controllers often use self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

interface UnifiAuthResult {
  cookie: string;
  csrfToken?: string;
}

export class UnifiClient {
  private url: string;
  private authResult: UnifiAuthResult | null = null;

  constructor(url: string) {
    this.url = url.replace(/\/$/, '');
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      // Attempt UniFi OS Login first
      const osLogin = await fetch(`${this.url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember: true })
      });

      if (osLogin.ok) {
        const cookie = osLogin.headers.get('set-cookie') || '';
        const csrfToken = osLogin.headers.get('x-csrf-token') || undefined;
        this.authResult = { cookie, csrfToken };
        return true;
      }

      // Attempt Standard Controller Login (v5, v6, older v7 without UniFi OS)
      const stdLogin = await fetch(`${this.url}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember: true })
      });

      if (stdLogin.ok) {
        const cookie = stdLogin.headers.get('set-cookie') || '';
        this.authResult = { cookie };
        return true;
      }

      return false;
    } catch (e) {
      console.error('UniFi Login Error:', e);
      return false;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.authResult) return {};
    const headers: Record<string, string> = {
      'Cookie': this.authResult.cookie,
      'Content-Type': 'application/json'
    };
    if (this.authResult.csrfToken) {
      headers['X-Csrf-Token'] = this.authResult.csrfToken;
    }
    return headers;
  }

  async getSites() {
    if (!this.authResult) throw new Error('Not authenticated');

    let endpoint = `${this.url}/proxy/network/api/self/sites`;
    let res = await fetch(endpoint, {
      headers: this.getAuthHeaders(),
      cache: 'no-store'
    });

    if (!res.ok) {
      // Fallback for non-UniFi OS
      endpoint = `${this.url}/api/self/sites`;
      res = await fetch(endpoint, {
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      });
    }

    if (!res.ok) {
      throw new Error('Failed to retrieve sites');
    }

    const data = await res.json();
    return data.data; // Array of sites
  }

  async getGatewayDevices(siteName: string) {
    if (!this.authResult) throw new Error('Not authenticated');

    let endpoint = `${this.url}/proxy/network/api/s/${siteName}/stat/device`;
    let res = await fetch(endpoint, {
      headers: this.getAuthHeaders(),
      cache: 'no-store'
    });

    if (!res.ok) {
      // Fallback for non-UniFi OS
      endpoint = `${this.url}/api/s/${siteName}/stat/device`;
      res = await fetch(endpoint, {
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      });
    }

    if (!res.ok) {
      throw new Error(`Failed to retrieve devices for site ${siteName}`);
    }

    const data = await res.json();
    const devices = data.data || [];
    
    // Filter only gateways (ugw)
    return devices.filter((d: any) => d.type === 'ugw');
  }

  async getDevices(siteName: string) {
      // Same as above but returns all for caching mechanism in worker
      if (!this.authResult) throw new Error('Not authenticated');

      let endpoint = `${this.url}/proxy/network/api/s/${siteName}/stat/device`;
      let res = await fetch(endpoint, {
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      });
  
      if (!res.ok) {
        endpoint = `${this.url}/api/s/${siteName}/stat/device`;
        res = await fetch(endpoint, {
          headers: this.getAuthHeaders(),
          cache: 'no-store'
        });
      }
  
      if (!res.ok) {
        throw new Error(`Failed to retrieve devices for site ${siteName}`);
      }
  
      const data = await res.json();
      return data.data || [];
  }
}
