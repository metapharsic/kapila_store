/**
 * Kapila IMS - 477 Canonical SKUs Master Database Seed
 */
const fs = require('fs');
const path = require('path');

exports.seed = async function(knex) {
  const seedFile = path.resolve(__dirname, 'master_database_seed.json');
  if (!fs.existsSync(seedFile)) {
    console.warn('[Seed] master_database_seed.json not found, skipping');
    return;
  }
  const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  
  if (data.stock && data.stock.length > 0) {
    console.log(`[Seed] Seeding ${data.stock.length} stock SKUs...`);
    for (const item of data.stock) {
      await knex('stock')
        .insert(item)
        .onConflict('id')
        .merge();
    }
  }

  if (data.indent_templates && data.indent_templates.length > 0) {
    console.log(`[Seed] Seeding ${data.indent_templates.length} indent templates...`);
    await knex('indent_templates').del();
    const chunkSize = 200;
    for (let i = 0; i < data.indent_templates.length; i += chunkSize) {
      await knex('indent_templates').insert(data.indent_templates.slice(i, i + chunkSize));
    }
  }
};
