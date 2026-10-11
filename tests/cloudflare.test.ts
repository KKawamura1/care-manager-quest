import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../worker';

describe('public Cloudflare asset delivery', () => {
  it('serves the app and all static assets without requiring authentication', async () => {
    for (const path of ['/', '/assets/app.js', '/assets/questions/2025/q01.png']) {
      const req = new Request(`https://care-manager-quest.example.workers.dev${path}`);
      const assetsFetch = vi.fn(async () => new Response('public app', { status: 200 }));
      const env: Env = { ASSETS: { fetch: assetsFetch } };

      const response = await worker.fetch(req, env);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('public app');
      expect(assetsFetch).toHaveBeenCalledTimes(1);
      expect(assetsFetch).toHaveBeenCalledWith(req);
    }
  });
});
