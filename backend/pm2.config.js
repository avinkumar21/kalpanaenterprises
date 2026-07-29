module.exports = {
  apps: [
    {
      name: 'gravity-backend',
      script: './src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8082
      },
      error_file: '../logs/pm2-error.log',
      out_file: '../logs/pm2-out.log',
      time: true
    }
  ]
};
