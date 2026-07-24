module.exports = {
  apps: [
    {
      name: "aether-ar",
      script: ".output/server/index.mjs",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
      out_file: "/var/log/aether/out.log",
      error_file: "/var/log/aether/error.log",
      time: true,
    },
  ],
};
