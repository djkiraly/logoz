const fs = require('fs');
const path = require('path');

// Resolve the listen port from the project's .env so this app can run on a
// non-default port when multiple sites share the server. Order of precedence:
// .env PORT -> process.env.PORT -> 3000.
function resolvePort() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const m = env.match(/^\s*PORT\s*=\s*"?(\d+)"?/m);
    if (m) return parseInt(m[1], 10);
  } catch {
    // .env not present/readable — fall through to env var / default
  }
  return parseInt(process.env.PORT || '', 10) || 3000;
}

const PORT = resolvePort();

module.exports = {
  apps: [
    {
      name: 'logoz',
      script: 'node_modules/.bin/next',
      args: `start -p ${PORT}`,
      cwd: '/var/www/logoz',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: String(PORT),
      },
      // Logging
      error_file: '/var/log/logoz/error.log',
      out_file: '/var/log/logoz/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful restart
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Health
      min_uptime: 10000,
      max_restarts: 10,
    },
  ],
};
