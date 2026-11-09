// pm2 process file. pm2 keeps the app running, restarts it if it crashes and starts it again after a server reboot.
module.exports = {
  apps: [{
    name: `sheplates-${process.env.PORT || 3000}`,
    cwd: process.env.APP_CURRENT || __dirname + "/../..",
    script: "node_modules/.bin/vinext",
    args: "start",
    env: { NODE_ENV: "production", HOST: "127.0.0.1" },
    max_memory_restart: "700M",
    kill_timeout: 8000,
    time: true,
  }],
};
