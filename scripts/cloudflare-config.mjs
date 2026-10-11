import { readFileSync, writeFileSync } from 'node:fs';

// Access identifiers are deployment variables; the API token stays in the job's environment.
const config = JSON.parse(readFileSync('wrangler.json', 'utf8'));
config.vars = Object.fromEntries(['ACCESS_TEAM', 'ACCESS_AUD', 'ACCESS_EMAIL'].map(key => [key, process.env[key] || '']));
writeFileSync('wrangler.ci.json', JSON.stringify(config, null, 2) + '\n');
