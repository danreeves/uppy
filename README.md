# Website Uptime Checker

A serverless website uptime monitoring application built with Cloudflare Workers, KV storage, and cron jobs.

## Features

- 🚀 **Serverless**: Built on Cloudflare Workers for global edge deployment
- ⏰ **Automated Monitoring**: Cron jobs check websites every 5 minutes
- 📊 **Real-time Dashboard**: Beautiful web interface to view uptime status
- 💾 **Persistent Storage**: Uses Cloudflare KV for storing check results
- 📈 **Historical Data**: Keeps track of the last 100 checks per website
- ⚡ **Fast**: Sub-second response times from Cloudflare's global network
- 📱 **Responsive**: Mobile-friendly interface

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

5. **Deploy to Cloudflare Workers:**
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

### Web Interface

1. Visit your deployed worker URL (or localhost during development)
2. Add websites to monitor using the form
3. View real-time status and uptime statistics
4. Trigger manual checks with the "Check Now" button

### API Endpoints

#### Get Status
```http
GET /api/status
```
Returns the current status and history for all monitored websites.

#### Add Website
```http
POST /api/websites
Content-Type: application/json

{
  "name": "My Website",
  "url": "https://example.com"
}
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
