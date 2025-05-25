#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Uptime Checker...\n');

try {
  // Check if user is logged in
  try {
    execSync('npx wrangler whoami', { stdio: 'ignore' });
    console.log('✅ Already logged in to Cloudflare');
  } catch (error) {
    console.log('🔑 Please login to Cloudflare...');
    execSync('npx wrangler login', { stdio: 'inherit' });
    console.log('✅ Logged in to Cloudflare');
  }

  // Create KV namespaces
  console.log('\n📦 Creating KV namespaces...');
  
  const kvResult = execSync('npx wrangler kv:namespace create UPTIME_KV', { encoding: 'utf8' });
  const kvPreviewResult = execSync('npx wrangler kv:namespace create UPTIME_KV --preview', { encoding: 'utf8' });
  
  // Extract namespace IDs
  const kvIdMatch = kvResult.match(/id = "([^"]+)"/);
  const kvPreviewIdMatch = kvPreviewResult.match(/id = "([^"]+)"/);
  
  if (kvIdMatch && kvPreviewIdMatch) {
    const kvId = kvIdMatch[1];
    const kvPreviewId = kvPreviewIdMatch[1];
    
    console.log(`✅ KV namespace created: ${kvId}`);
    console.log(`✅ KV preview namespace created: ${kvPreviewId}`);
    
    // Update wrangler.toml
    const wranglerPath = path.join(__dirname, 'wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    wranglerContent = wranglerContent.replace(
      'id = "your-kv-namespace-id"',
      `id = "${kvId}"`
    );
    wranglerContent = wranglerContent.replace(
      'preview_id = "your-preview-kv-namespace-id"',
      `preview_id = "${kvPreviewId}"`
    );
    
    fs.writeFileSync(wranglerPath, wranglerContent);
    console.log('✅ Updated wrangler.toml with KV namespace IDs');
  } else {
    console.log('❌ Failed to extract KV namespace IDs. Please update wrangler.toml manually.');
    console.log('Production namespace output:', kvResult);
    console.log('Preview namespace output:', kvPreviewResult);
  }

  console.log('\n🎉 Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run "npm run dev" to test locally');
  console.log('2. Run "npm run deploy" to deploy to Cloudflare Workers');
  console.log('3. Visit your worker URL to start monitoring websites');

} catch (error) {
  console.error('❌ Setup failed:', error.message);  console.log('\nManual setup steps:');
  console.log('1. Make sure wrangler is in package.json devDependencies');
  console.log('2. Login: npx wrangler login');
  console.log('3. Create KV namespaces: npm run kv:create && npm run kv:create-preview');
  console.log('4. Update the KV namespace IDs in wrangler.toml');
  console.log('5. Deploy: npm run deploy');
}
