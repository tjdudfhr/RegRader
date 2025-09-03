module.exports = {
  apps: [
    {
      name: 'law-update-server',
      script: './docs/law_update_server.js',
      cwd: '/home/user/webapp',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/law-server-error.log',
      out_file: './logs/law-server-out.log',
      log_file: './logs/law-server-combined.log',
      time: true
    }
  ]
};