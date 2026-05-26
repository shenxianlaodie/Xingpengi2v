module.exports = {
  apps: [
    {
      name: 'tuzi-server',
      cwd: '/root/Xingpengi2v/server',
      script: 'src/index.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'development',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'tuzi-client',
      cwd: '/root/Xingpengi2v/client',
      script: 'node_modules/.bin/vite',
      args: '--host 0.0.0.0 --port 5173',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'development',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
