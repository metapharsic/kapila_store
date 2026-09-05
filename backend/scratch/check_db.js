require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const knex = require('knex');
const config = require('../knexfile');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('knex config:', config[process.env.NODE_ENV || 'development']);

const db = knex(config[process.env.NODE_ENV || 'development']);

db.raw('SELECT current_database() as db, current_user as user')
  .then(res => {
    console.log('Connection success:', res.rows[0]);
    return db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  })
  .then(res => {
    console.log('Tables in public schema:', res.rows.map(r => r.table_name));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to DB:', err);
    process.exit(1);
  });
