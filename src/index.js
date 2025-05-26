// Main entry point for the Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    // Handle cron job for uptime checks
    ctx.waitUntil(performUptimeChecks(env));
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    switch (path) {
      case '/':
        return new Response(await getHomePage(), {
          headers: { 'Content-Type': 'text/html', ...corsHeaders },
        });

      case '/api/status':
        return handleGetStatus(env, corsHeaders);

      case '/api/websites':
        if (request.method === 'GET') {
          return handleGetWebsites(env, corsHeaders);
        } else if (request.method === 'POST') {
          return handleAddWebsite(request, env, corsHeaders);
        }
        break;
      case '/api/check':
        if (request.method === 'POST') {
          return handleManualCheck(request, env, corsHeaders);
        }
        break;

      case '/api/login':
        if (request.method === 'POST') {
          return handleLogin(request, env, corsHeaders);
        }
        break;

      case '/api/logout':
        if (request.method === 'POST') {
          return handleLogout(corsHeaders);
        }
        break;

      case '/api/auth-status':
        return handleAuthStatus(request, corsHeaders);

      default:
        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function performUptimeChecks(env) {
  console.log('Starting scheduled uptime checks...');

  try {
    // Get list of websites to check
    const websitesData = await env.UPTIME_KV.get('websites');
    if (!websitesData) {
      console.log('No websites configured for monitoring');
      return;
    }

    const websites = JSON.parse(websitesData);
    const checkPromises = websites.map(website => checkWebsite(website, env));

    await Promise.all(checkPromises);
    console.log('Completed uptime checks for', websites.length, 'websites');
  } catch (error) {
    console.error('Error during scheduled checks:', error);
  }
}

async function checkWebsite(website, env) {
  const startTime = Date.now();
  let status = 'down';
  let responseTime = 0;
  let statusCode = 0;
  let error = null;

  try {
    const response = await fetch(website.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Uptime-Checker/1.0',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    responseTime = Date.now() - startTime;
    statusCode = response.status;

    if (response.ok) {
      status = 'up';
    } else {
      status = 'down';
      error = `HTTP ${response.status}`;
    }
  } catch (err) {
    responseTime = Date.now() - startTime;
    status = 'down';
    error = err.message;
    console.error(`Error checking ${website.url}:`, err);
  }

  // Store the result
  const result = {
    url: website.url,
    name: website.name,
    status,
    responseTime,
    statusCode,
    error,
    timestamp: new Date().toISOString(),
  };

  // Store latest status
  await env.UPTIME_KV.put(`status:${website.id}`, JSON.stringify(result));

  // Store in history (keep last 100 checks)
  const historyKey = `history:${website.id}`;
  const existingHistory = await env.UPTIME_KV.get(historyKey);
  let history = existingHistory ? JSON.parse(existingHistory) : [];

  history.unshift(result);
  if (history.length > 100) {
    history = history.slice(0, 100);
  }

  await env.UPTIME_KV.put(historyKey, JSON.stringify(history));

  console.log(`Checked ${website.url}: ${status} (${responseTime}ms)`);
}

async function handleGetStatus(env, corsHeaders) {
  try {
    const websitesData = await env.UPTIME_KV.get('websites');
    if (!websitesData) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const websites = JSON.parse(websitesData);
    const statusPromises = websites.map(async website => {
      const statusData = await env.UPTIME_KV.get(`status:${website.id}`);
      const historyData = await env.UPTIME_KV.get(`history:${website.id}`);

      return {
        ...website,
        currentStatus: statusData ? JSON.parse(statusData) : null,
        history: historyData ? JSON.parse(historyData) : [],
      };
    });

    const results = await Promise.all(statusPromises);

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error getting status:', error);
    return new Response('Error getting status', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleGetWebsites(env, corsHeaders) {
  try {
    const websitesData = await env.UPTIME_KV.get('websites');
    const websites = websitesData ? JSON.parse(websitesData) : [];

    return new Response(JSON.stringify(websites), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error getting websites:', error);
    return new Response('Error getting websites', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleAddWebsite(request, env, corsHeaders) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { name, url } = await request.json();

    if (!name || !url) {
      return new Response('Name and URL are required', {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return new Response('Invalid URL format', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const websitesData = await env.UPTIME_KV.get('websites');
    const websites = websitesData ? JSON.parse(websitesData) : [];

    const newWebsite = {
      id: generateId(),
      name,
      url,
      createdAt: new Date().toISOString(),
    };

    websites.push(newWebsite);
    await env.UPTIME_KV.put('websites', JSON.stringify(websites));

    return new Response(JSON.stringify(newWebsite), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error adding website:', error);
    return new Response('Error adding website', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleManualCheck(request, env, corsHeaders) {
  try {
    const { websiteId } = await request.json();

    const websitesData = await env.UPTIME_KV.get('websites');
    if (!websitesData) {
      return new Response('No websites found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const websites = JSON.parse(websitesData);
    const website = websites.find(w => w.id === websiteId);

    if (!website) {
      return new Response('Website not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    await checkWebsite(website, env);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error performing manual check:', error);
    return new Response('Error performing check', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Authentication helpers
function generateSessionToken() {
  return Math.random().toString(36).substr(2, 15) + Date.now().toString(36);
}

function isAuthenticated(request) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const sessionToken = cookies.session;

  // In a real app, you'd validate this token against a database
  // For this simple implementation, we'll just check if it exists and is recent
  if (!sessionToken) return false;

  try {
    const timestamp = parseInt(sessionToken.split('').slice(-8).join(''), 36);
    const now = Date.now();
    // Session expires after 24 hours
    return now - timestamp < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function parseCookies(cookieString) {
  const cookies = {};
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

async function handleLogin(request, env, corsHeaders) {
  try {
    const { password } = await request.json();

    // Get admin password from environment variable
    const adminPassword = env.ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error('Admin password not set');
    }

    if (password !== adminPassword) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid password' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const sessionToken = generateSessionToken();

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`,
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Login failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

function handleLogout(corsHeaders) {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie':
        'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/',
      ...corsHeaders,
    },
  });
}

function handleAuthStatus(request, corsHeaders) {
  const authenticated = isAuthenticated(request);

  return new Response(JSON.stringify({ authenticated }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function getHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uptime Checker</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }        .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .card h2 {
            margin-bottom: 20px;
        }
        
        .card h2 {
            margin-bottom: 20px;
        }
        
        .card h2 {
            margin-bottom: 20px;
        }
        
        .add-website-form {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        
        .form-group {
            flex: 1;
            min-width: 200px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #333;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
            align-self: end;
        }
        
        .btn:hover {
            background: #5a6fd8;
        }
          .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .btn.logout {
            background: #ef4444;
        }
        
        .btn.logout:hover {
            background: #dc2626;
        }.website-list {
            display: grid;
            gap: 20px;
        }
        
        .website-item {
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            padding: 20px;
            transition: all 0.3s;
        }
        
        .website-item.up {
            border-color: #10b981;
            background: #f0fdf4;
        }
        
        .website-item.down {
            border-color: #ef4444;
            background: #fef2f2;
        }
        
        .website-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .website-info h3 {
            font-size: 1.3rem;
            margin-bottom: 5px;
        }
        
        .website-info .url {
            color: #666;
            word-break: break-all;
        }
        
        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
        }
        
        .status-badge.up {
            background: #10b981;
            color: white;
        }
        
        .status-badge.down {
            background: #ef4444;
            color: white;
        }
        
        .website-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .stat {
            text-align: center;
            padding: 10px;
            background: rgba(255,255,255,0.7);
            border-radius: 6px;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #333;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #666;
            margin-top: 5px;
        }
        
        .check-btn {
            background: #10b981;
            margin-top: 10px;
        }
          .check-btn:hover {
            background: #059669;
        }
        
        .history-section {
            margin-top: 15px;
            padding: 15px;
            background: rgba(255,255,255,0.5);
            border-radius: 6px;
        }
        
        .history-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .history-dots {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
        }
        
        .history-dot {
            width: 12px;
            height: 12px;
            border-radius: 2px;
            display: inline-block;
            cursor: pointer;
        }
        
        .history-dot.up {
            background: #10b981;
        }
        
        .history-dot.down {
            background: #ef4444;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        
        .empty-state h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .add-website-form {
                flex-direction: column;
            }
            
            .website-header {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Uptime Checker</h1>
            <p>Monitor your websites with Cloudflare Workers</p>
        </div>
          <div class="card" id="loginCard" style="display: none;">
            <h2>Admin Login</h2>
            <form class="add-website-form" id="loginForm">
                <div class="form-group">
                    <label for="adminPassword">Admin Password</label>
                    <input type="password" id="adminPassword" placeholder="Enter admin password" required>
                </div>
                <button type="submit" class="btn" id="loginBtn">Login</button>
            </form>
        </div>
        
        <div class="card" id="addWebsiteCard" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Add Website</h2>
                <button class="btn" id="logoutBtn" style="background: #ef4444; font-size: 14px; padding: 8px 16px;">Logout</button>
            </div>
            <form class="add-website-form" id="addWebsiteForm">
                <div class="form-group">
                    <label for="websiteName">Website Name</label>
                    <input type="text" id="websiteName" placeholder="My Website" required>
                </div>
                <div class="form-group">
                    <label for="websiteUrl">Website URL</label>
                    <input type="url" id="websiteUrl" placeholder="https://example.com" required>
                </div>                <button type="submit" class="btn" id="addBtn">Add Website</button>
            </form>
        </div><div class="card">
            <h2 style="margin-bottom: 20px;">Monitored Websites</h2>
            <div id="websiteList" class="loading">
                Loading websites...
            </div>
        </div>
    </div>    <script>
        let websites = [];
        let isAuthenticated = false;
        
        // Load websites on page load
        document.addEventListener('DOMContentLoaded', function() {
            checkAuthStatus();
            loadWebsites();
            setInterval(loadWebsites, 30000); // Refresh every 30 seconds
        });
        
        // Check authentication status
        async function checkAuthStatus() {
            try {
                const response = await fetch('/api/auth-status');
                const data = await response.json();
                isAuthenticated = data.authenticated;
                updateUIBasedOnAuth();
            } catch (error) {
                console.error('Error checking auth status:', error);
                isAuthenticated = false;
                updateUIBasedOnAuth();
            }
        }
        
        // Update UI based on authentication status
        function updateUIBasedOnAuth() {
            const loginCard = document.getElementById('loginCard');
            const addWebsiteCard = document.getElementById('addWebsiteCard');
            
            if (isAuthenticated) {
                loginCard.style.display = 'none';
                addWebsiteCard.style.display = 'block';
            } else {
                loginCard.style.display = 'block';
                addWebsiteCard.style.display = 'none';
            }
        }
        
        // Login form
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = document.getElementById('adminPassword').value;
            const loginBtn = document.getElementById('loginBtn');
            
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password }),
                });
                
                const data = await response.json();
                
                if (data.success) {
                    isAuthenticated = true;
                    updateUIBasedOnAuth();
                    document.getElementById('adminPassword').value = '';
                } else {
                    alert(data.message || 'Login failed');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Login failed');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        });
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', async function() {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                
                isAuthenticated = false;
                updateUIBasedOnAuth();
            } catch (error) {
                console.error('Error:', error);
                alert('Logout failed');
            }
        });
        
        // Add website form
        document.getElementById('addWebsiteForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('websiteName').value;
            const url = document.getElementById('websiteUrl').value;
            const addBtn = document.getElementById('addBtn');
            
            addBtn.disabled = true;
            addBtn.textContent = 'Adding...';
            
            try {
                const response = await fetch('/api/websites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, url }),
                });
                  if (response.ok) {
                    document.getElementById('websiteName').value = '';
                    document.getElementById('websiteUrl').value = '';
                    loadWebsites();
                } else if (response.status === 401) {
                    alert('Session expired. Please login again.');
                    isAuthenticated = false;
                    updateUIBasedOnAuth();
                } else {
                    alert('Error adding website');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error adding website');
            } finally {
                addBtn.disabled = false;
                addBtn.textContent = 'Add Website';
            }
        });
        
        async function loadWebsites() {
            try {
                const response = await fetch('/api/status');
                websites = await response.json();
                renderWebsites();
            } catch (error) {
                console.error('Error loading websites:', error);
                document.getElementById('websiteList').innerHTML = 
                    '<div class="empty-state"><h3>Error loading websites</h3></div>';
            }
        }
          function renderWebsites() {
            const container = document.getElementById('websiteList');
            
            if (websites.length === 0) {
                container.className = '';
                container.innerHTML = 
                    '<div class="empty-state"><h3>No websites monitored yet</h3><p>Add a website above to start monitoring</p></div>';
                return;
            }
            
            container.className = 'website-list';
            
            container.innerHTML = websites.map(website => {
                const status = website.currentStatus;
                const uptime = calculateUptime(website.history);
                const avgResponseTime = calculateAverageResponseTime(website.history);
                
                return \`
                    <div class="website-item \${status ? status.status : 'unknown'}">
                        <div class="website-header">
                            <div class="website-info">
                                <h3>\${website.name}</h3>
                                <div class="url">\${website.url}</div>
                            </div>
                            <div class="status-badge \${status ? status.status : 'unknown'}">
                                \${status ? status.status : 'Unknown'}
                            </div>
                        </div>
                          \${status ? \`
                            <div class="website-stats">
                                <div class="stat">
                                    <div class="stat-value">\${uptime}%</div>
                                    <div class="stat-label">Uptime (24h)</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">\${status.responseTime}ms</div>
                                    <div class="stat-label">Response Time</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">\${avgResponseTime}ms</div>
                                    <div class="stat-label">Avg Response</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">\${formatTime(status.timestamp)}</div>
                                    <div class="stat-label">Last Check</div>
                                </div>
                            </div>                            \${website.history && website.history.length > 0 ? \`
                                <div class="history-section">
                                    <div class="history-label">Recent History (last 100 checks):</div>
                                    <div class="history-dots">
                                        \${website.history.slice().reverse().map(check => 
                                            \`<span class="history-dot \${check.status}" title="\${check.status} - \${formatTime(check.timestamp)} - \${check.responseTime}ms"></span>\`
                                        ).join('')}
                                    </div>
                                </div>
                            \` : ''}
                            \${status.error ? \`<div style="color: #ef4444; margin-top: 10px; font-weight: 500;">Error: \${status.error}</div>\` : ''}
                        \` : '<div style="color: #666;">No check data available</div>'}
                        
                        <button class="btn check-btn" onclick="checkWebsite('\${website.id}')">
                            Check Now
                        </button>
                    </div>
                \`;
            }).join('');
        }
        
        async function checkWebsite(websiteId) {
            try {
                await fetch('/api/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ websiteId }),
                });
                
                // Refresh after a moment
                setTimeout(loadWebsites, 2000);
            } catch (error) {
                console.error('Error checking website:', error);
                alert('Error checking website');
            }
        }
        
        function calculateUptime(history) {
            if (!history || history.length === 0) return 0;
            
            const last24h = history.filter(check => {
                const checkTime = new Date(check.timestamp);
                const now = new Date();
                return now - checkTime < 24 * 60 * 60 * 1000; // 24 hours
            });
            
            if (last24h.length === 0) return 0;
            
            const upChecks = last24h.filter(check => check.status === 'up').length;
            return Math.round((upChecks / last24h.length) * 100);
        }
        
        function calculateAverageResponseTime(history) {
            if (!history || history.length === 0) return 0;
            
            const validChecks = history.filter(check => check.responseTime > 0);
            if (validChecks.length === 0) return 0;
            
            const total = validChecks.reduce((sum, check) => sum + check.responseTime, 0);
            return Math.round(total / validChecks.length);
        }
        
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
            return Math.floor(diff / 86400000) + 'd ago';
        }
    </script>
</body>
</html>`;
}
