// Build using process-only non-secret placeholders, without reading dotenv files.
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const env = {...process.env,
  NEXT_PUBLIC_API_URL:'http://127.0.0.1:8000',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from('isolated-verification.clerk.accounts.dev$').toString('base64'),
  NEXT_TELEMETRY_DISABLED:'1',
  NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require "'+path.join(__dirname,'no-dotenv-next.cjs').replaceAll('\\','/')+'"').trim(),
};
// Explicit webpack avoids the native Turbopack dotenv discovery path.
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build','--','--webpack'],{cwd:path.join(root,'apps/web'),env,stdio:'inherit',shell:process.platform==='win32'});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
