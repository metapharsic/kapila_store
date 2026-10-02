require("dotenv").config();

module.exports = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: "./db/migrations" },
    seeds: { directory: "./db/seeds" },
    pool: { min: 2, max: 20 },
  },
  test: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: "./db/migrations" },
    seeds: { directory: "./db/seeds" },
  },
  production: {
    client: "pg",
    connection: { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } },
    migrations: { directory: "./db/migrations" },
    pool: { min: 2, max: 20 },
  },
};
