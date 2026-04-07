module.exports = {
  apps: [
    {
      name: 'logoz',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/logoz',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
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
