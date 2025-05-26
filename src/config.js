/**
 * Configuration for the Uptime Checker
 * Modify these values to customize the behavior
 */

export const CONFIG = {
  // How many historical checks to store per website
  MAX_HISTORY_ITEMS: 100,

  // Timeout for website checks (in milliseconds)
  CHECK_TIMEOUT: 30000,

  // User agent string for checks
  USER_AGENT: 'Uptime-Checker/1.0',

  // How often to refresh the dashboard (in milliseconds)
  DASHBOARD_REFRESH_INTERVAL: 30000,

  // Time window for uptime calculation (in milliseconds)
  UPTIME_WINDOW: 24 * 60 * 60 * 1000, // 24 hours

  // HTTP status codes that are considered "up"
  SUCCESS_STATUS_CODES: [
    200, 201, 202, 203, 204, 205, 206, 301, 302, 303, 304, 307, 308,
  ],

  // Default cron schedule (every 5 minutes)
  DEFAULT_CRON: '*/5 * * * *',

  // Colors for the UI
  COLORS: {
    primary: '#667eea',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    text: '#333',
    textLight: '#666',
    background: '#f8fafc',
  },
};
