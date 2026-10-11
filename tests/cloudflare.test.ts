import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import worker, { type Env } from '../worker';

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
const issuer = 'https://test-team.cloudflareaccess.com';
const aud = 'test-application';
const email = 'owner@example.com';
beforeAll(async () => {
  const keys = await generateKeyPair('RS256'); privateKey = keys.privateKey;
  publicJwk = { ...await exportJWK(keys.publicKey), kid: 'test-key' };
  otherKey = (await generateKeyPair('RS256')).privateKey;
});
afterEach(() => vi.unstubAllGlobals());

async function token(overrides: Record<string, unknown> = {}, key = privateKey) {
  return new SignJWT({ iss: issuer, aud, email, exp: Math.floor(Date.now() / 1000) + 300, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key);
}
function environment(): Env {
  return { ACCESS_TEAM: 'test-team', ACCESS_AUD: aud, ACCESS_EMAIL: email,
    ASSETS: { fetch: vi.fn(async () => new Response('private app')) } };
}
function request(jwt?: string, path = '/') {
  return new Request(`https://care-manager-quest.example.workers.dev${path}`, {
    headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {},
  });
}
function mockKeys() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    expect(String(url)).toBe(`${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [publicJwk] });
  }));
}

describe('private Cloudflare asset delivery', () => {
  it('denies all paths before Access setup or without a token, without fetching assets', async () => {
    for (const path of ['/', '/assets/app.js', '/assets/questions/2025/q01.png']) {
      const env = environment();
      expect((await worker.fetch(request(undefined, path), { ...env, ACCESS_AUD: '' })).status).toBe(503);
      expect((await worker.fetch(request(undefined, path), env)).status).toBe(403);
      expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    }
    expect((await worker.fetch(request(), { ...environment(), ACCESS_TEAM: 'https://evil.example' })).status).toBe(503);
  });
  it('serves original assets only for a signature-verified owner token', async () => {
    mockKeys(); const env = environment(); const req = request(await token(), '/assets/app.js');
    expect(await (await worker.fetch(req, env)).text()).toBe('private app');
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(req);
  });
  it('rejects forged, expired, wrong issuer/audience/email and malformed tokens', async () => {
    mockKeys();
    for (const jwt of [await token({}, otherKey), await token({ exp: 1 }), await token({ iss: 'https://evil.example' }),
      await token({ aud: 'another-app' }), await token({ email: 'other@example.com' }), await token({ exp: undefined }), 'not-a-jwt']) {
      const env = environment();
      const res = await worker.fetch(request(jwt), env);
      expect(res.status).toBe(403); expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    }
  });
});
