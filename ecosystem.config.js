module.exports = {
  apps: [
    {
      name: "kapila-backend",
      cwd: "C:/Kapila_store/backend",
      script: "npm",
      args: "run dev",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
    {
      name: "kapila-frontend",
      cwd: "C:/Kapila_store/frontend",
      script: "npm",
      args: "run dev",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
