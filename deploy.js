#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Deploying Uptime Checker to Cloudflare Workers...\n');

try {
  // Check if wrangler.toml has been configured
  const wranglerContent = fs.readFileSync('wrangler.toml', 'utf8');
  
  if (wranglerContent.includes('your-kv-namespace-id')) {
    console.log('❌ KV namespaces not configured in wrangler.toml');
    console.log('Please run "npm run setup" first, or manually update the KV namespace IDs.');
    process.exit(1);
  }

  console.log('✅ Configuration looks good');
  console.log('📦 Deploying to Cloudflare Workers...\n');
    // Deploy the worker
  execSync('npx wrangler deploy', { stdio: 'inherit' });
  
  console.log('\n🎉 Deployment successful!');
  console.log('\nYour uptime checker is now live!');
  console.log('You can find the URL in the output above.');
  console.log('\nNext steps:');
  console.log('1. Visit your worker URL');
  console.log('2. Add websites to monitor');
  console.log('3. Check back in 5 minutes to see the first results');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);  console.log('\nTroubleshooting:');
  console.log('1. Make sure you\'re logged in: npx wrangler login');
  console.log('2. Check your wrangler.toml configuration');
  console.log('3. Ensure KV namespaces are created and configured');
}
