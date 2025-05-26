# Website Uptime Checker

A serverless website uptime monitoring application built with Cloudflare Workers, KV storage, and cron jobs.

## Features

- 🚀 **Serverless**: Built on Cloudflare Workers for global edge deployment
- ⏰ **Automated Monitoring**: Cron jobs check websites every 5 minutes
- 📊 **Real-time Dashboard**: Beautiful web interface to view uptime status
- 🔐 **Secure Admin Panel**: Password-protected website management
- 💾 **Persistent Storage**: Uses Cloudflare KV for storing check results
- 📈 **Historical Data**: Keeps track of the last 100 checks per website
- ⚡ **Fast**: Sub-second response times from Cloudflare's global network
- 📱 **Responsive**: Mobile-friendly interface
- 🟢🔴 **Visual History**: Color-coded squares showing uptime patterns

## Quick Start

### Prerequisites

- Node.js and npm installed
- Cloudflare account
- Wrangler CLI (will be installed locally via npm)

### Setup

1. **Clone and install dependencies:**

   ```bash
   cd uppy
   npm install
   ```

2. **Login to Cloudflare:**

   ```bash
   npx wrangler login
   ```

3. **Create KV namespaces:**

   ```bash
   npm run kv:create
   npm run kv:create-preview
   ```

4. **Update wrangler.toml:**
   Replace the `id` and `preview_id` values in `wrangler.toml` with the IDs returned from the previous step.

5. **Set up authentication:**

   ```bash
   npm run setup-auth
   ```

   This will help you configure a secure admin password for website management.

6. **Deploy to Cloudflare Workers:**
   ```bash
   npm run deploy
   ```

### Development

Run the worker locally:

```bash
npm run dev
```

This will start a local development server where you can test the application.

## Usage

### Authentication

The application has two access levels:

1. **Public Access**: Anyone can view the uptime dashboard and website status
2. **Admin Access**: Password-protected access to add/manage websites

To access admin features:

1. Click the login area on the dashboard
2. Enter your admin password (set during setup)
3. You can now add websites and access management features
4. Use the logout button to end your admin session

### Web Interface

1. Visit your deployed worker URL (or localhost during development)
2. **For viewing**: Browse uptime status, statistics, and history
3. **For managing**: Login with admin password to add websites
4. View real-time status with color-coded history squares
5. Trigger manual checks with the "Check Now" button

### API Endpoints

#### Get Status

```http
GET /api/status
```

Returns the current status and history for all monitored websites.

#### Add Website (Admin Only)

```http
POST /api/websites
Content-Type: application/json
Cookie: session=your-session-token

{
  "name": "My Website",
  "url": "https://example.com"
}
```

#### Login

```http
POST /api/login
Content-Type: application/json

{
  "password": "your-admin-password"
}
```

#### Logout

```http
POST /api/logout
```

#### Check Auth Status

```http
GET /api/auth-status
```

#### Manual Check

```http
POST /api/check
Content-Type: application/json

{
  "websiteId": "website-id"
}
```

## Configuration

### Authentication

#### Development Setup

Create a `.dev.vars` file in your project root (automatically handled by setup script):

```bash
ADMIN_PASSWORD=your-password-here
```

> **Note**: The `.dev.vars` file is automatically added to `.gitignore` to keep your password secure.

#### Production Setup (Recommended)

Use Cloudflare secrets for better security:

```bash
wrangler secret put ADMIN_PASSWORD
```

#### Security Features

- **Session-based authentication**: Uses secure HTTP-only cookies
- **Session expiration**: Sessions expire after 24 hours
- **Public dashboard**: Monitoring data remains publicly viewable
- **Protected management**: Only authenticated users can add/remove websites

### Cron Schedule

The default cron schedule checks websites every 5 minutes. You can modify this in `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
# crons = ["*/1 * * * *"]  # Every minute
# crons = ["0 */6 * * *"]  # Every 6 hours
```

### Data Retention

- Latest status: Stored indefinitely
- Historical data: Last 100 checks per website
- You can modify the history limit in the `checkWebsite` function

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cron Trigger  │───▶│ Cloudflare      │───▶│ Target Websites │
│   (Every 5min)  │    │ Worker          │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Cloudflare KV   │
                       │ Storage         │
                       │ - websites      │
                       │ - status:id     │
                       │ - history:id    │
                       └─────────────────┘
```

## Data Structure

### Website Object

```json
{
  "id": "abc123",
  "name": "My Website",
  "url": "https://example.com",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Status Object

```json
{
  "url": "https://example.com",
  "name": "My Website",
  "status": "up",
  "responseTime": 250,
  "statusCode": 200,
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Monitoring

The application provides several metrics:

- **Uptime Percentage**: Calculated from checks in the last 24 hours
- **Response Time**: Current and average response times
- **Status History**: Visual timeline of up/down status
- **Error Details**: HTTP status codes and error messages

## Deployment Options

### Production Deployment

```bash
npm run deploy
```

### Custom Domain

Add a custom domain in the Cloudflare Workers dashboard or via wrangler:

```bash
npx wrangler deploy --name uptime-checker --route "monitor.yourdomain.com/*"
```

## Troubleshooting

### Authentication Issues

**"Invalid password" error:**

- Check that `ADMIN_PASSWORD` is set correctly in wrangler.toml or as a secret
- For development: Verify the password in `[vars]` section
- For production: Use `wrangler secret list` to verify the secret exists

**Session expired errors:**

- Sessions expire after 24 hours for security
- Simply log in again to get a new session
- Check browser cookies if issues persist

**Login form not appearing:**

- Ensure you're accessing the correct URL
- Check browser console for JavaScript errors
- Try refreshing the page

### Monitoring Issues

**Websites not being checked:**

- Verify cron triggers are enabled in your Cloudflare dashboard
- Check worker logs for errors during scheduled executions
- Ensure the worker has KV namespace access

**Manual checks failing:**

- Check if the website URL is accessible
- Verify the URL format (must include http:// or https://)
- Review worker logs for timeout or connection errors

### Common Issues

1. **KV Namespace not found**: Make sure you've created the KV namespaces and updated the IDs in `wrangler.toml`

2. **Cron not triggering**: Cron triggers only work on the paid Workers plan

3. **Timeout errors**: The worker has a 30-second timeout for website checks. Slow websites may fail.

### Debugging

Check the worker logs:

```bash
npx wrangler tail
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial use.

## Support

For issues and questions:

- Check the Cloudflare Workers documentation
- Review the worker logs with `npx wrangler tail`
- Ensure KV namespaces are properly configured
