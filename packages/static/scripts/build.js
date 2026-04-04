import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const webDist = resolve(root, '..', 'web', 'dist');
const outDir = resolve(root, 'dist');

// Verify web has been built
if (!existsSync(webDist)) {
  console.error('Error: packages/web/dist does not exist. Run "npm run build -w @recon-web/web" first.');
  process.exit(1);
}

// Clean and create output
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true });
}
mkdirSync(outDir, { recursive: true });

// Copy web dist
cpSync(webDist, outDir, { recursive: true });
console.log('Copied packages/web/dist/ → dist/');

// Generate _redirects for CF Pages (simple proxy mode)
const apiOrigin = process.env.API_ORIGIN || '';
if (apiOrigin) {
  const redirects = [
    `# Proxy API requests to backend`,
    `/api/*  ${apiOrigin}/api/:splat  200`,
    `/health  ${apiOrigin}/health  200`,
  ].join('\n');

  writeFileSync(resolve(outDir, '_redirects'), redirects + '\n');
  console.log(`Generated _redirects proxying to ${apiOrigin}`);
} else {
  console.log('No API_ORIGIN set — skipping _redirects (use CF Pages Functions instead)');
}

// Copy functions directory if it exists (for CF Pages Functions)
const functionsDir = resolve(root, 'functions');
const outFunctions = resolve(outDir, 'functions');
if (existsSync(functionsDir)) {
  // Note: CF Pages expects functions/ at the project root or in the output directory
  // We don't copy them into dist — wrangler reads them from the project root
  console.log('CF Pages Functions available at functions/');
}

console.log('Static build complete.');
