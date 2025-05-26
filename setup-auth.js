// Setup script for uptime checker authentication
console.log('🔐 Setting up Uptime Checker Authentication\n');

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function createDevVarsFile(password) {
  const devVarsPath = path.join(process.cwd(), '.dev.vars');
  const content = `ADMIN_PASSWORD=${password}\n`;
  
  try {
    fs.writeFileSync(devVarsPath, content);
    console.log(`✅ Created .dev.vars file with admin password`);
    
    // Check if .gitignore exists and add .dev.vars if not already there
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    let gitignoreContent = '';
    
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    if (!gitignoreContent.includes('.dev.vars')) {
      fs.appendFileSync(gitignorePath, '\n# Local environment variables\n.dev.vars\n');
      console.log('✅ Added .dev.vars to .gitignore');
    }
    
  } catch (error) {
    console.error('❌ Error creating .dev.vars file:', error.message);
    throw error;
  }
}

async function setupAuth() {
  try {
    console.log('This script will help you set up a secure admin password for your uptime checker.\n');
    
    const method = await askQuestion('Choose setup method:\n1. Local development (.dev.vars)\n2. Cloudflare secret (production)\nEnter 1 or 2: ');
    
    if (method === '1') {
      console.log('\n📝 Setting up local development environment...');
      const password = await askQuestion('Enter your admin password: ');
      
      if (!password.trim()) {
        console.log('❌ Password cannot be empty. Please run the script again.');
        return;
      }
      
      createDevVarsFile(password.trim());
      
      console.log('\n🔧 Local development setup complete!');
      console.log('   Your password is stored in .dev.vars (excluded from git)');
      console.log('   Start your development server with: npm run dev\n');
      
    } else if (method === '2') {
      console.log('\n🔒 Setting up Cloudflare secret...');

        try {
        console.log('Setting secret...');
        console.log('Wrangler will prompt you to enter the password securely:');
        execSync(`npx wrangler secret put ADMIN_PASSWORD`, { stdio: 'inherit' });
        console.log('✅ Admin password set as Cloudflare secret!');
        console.log('\n🚀 Deploy your worker with: npm run deploy');
      } catch (error) {
        console.error('❌ Error setting secret:', error.message);
        console.log('\nTo set manually, run:');
        console.log('wrangler secret put ADMIN_PASSWORD');
      }
    } else {
      console.log('❌ Invalid choice. Please run the script again.');
      return;
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setupAuth();
