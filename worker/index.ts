import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ACCESS_TEAM?: string;
  ACCESS_AUD?: string;
  ACCESS_EMAIL?: string;
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const deny = (status: number) => new Response('Access required', {
  status, headers: { 'Cache-Control': 'no-store' },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const team = env.ACCESS_TEAM;
    if (!team || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(team) || !env.ACCESS_AUD || !env.ACCESS_EMAIL) return deny(503);
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return deny(403);
    try {
      const issuer = `https://${team}.cloudflareaccess.com`;
      let keys = keySets.get(issuer);
      if (!keys) {
        keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
        keySets.set(issuer, keys);
      }
      const { payload } = await jwtVerify(token, keys, {
        issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'email'],
      });
      if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== env.ACCESS_EMAIL.trim().toLowerCase()) return deny(403);
    } catch {
      return deny(403);
    }
    // All assets, including JS and original images, pass through this check.
    return env.ASSETS.fetch(request);
  },
};
