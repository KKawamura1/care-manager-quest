import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Registration E2E adds temporary JSON files. Do not refresh unrelated test
  // pages when the glob changes; fresh navigations still read the new files.
  server: process.env.CARE_MANAGER_E2E === '1' ? { hmr:false } : undefined,
  test: { include: ['tests/**/*.test.ts'] },
});
