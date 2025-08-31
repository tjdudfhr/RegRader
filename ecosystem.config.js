module.exports = {
  apps: [{
    name: 'law-watch',
    script: 'python3',
    args: '-m http.server 3000 -d docs',
    cwd: '/home/user/webapp',
    interpreter: 'none',
    env: {
      NODE_ENV: 'production'
    },
    autorestart: true,
    max_restarts: 10
  }]
};