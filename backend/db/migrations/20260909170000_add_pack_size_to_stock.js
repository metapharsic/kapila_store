exports.up = async function(knex) {
  // Add pack_size to stock
  await knex.schema.table('stock', function(table) {
    table.float('pack_size').defaultTo(1.0);
  });

  // Seed the market-standard default pack sizes for Disposal category
  const defaults = [
    { name: 'Buffet Plates', pack_size: 50 },
    { name: 'Butter Paper', pack_size: 500 },
    { name: 'Caps', pack_size: 100 },
    { name: 'Dust Bin Covers', pack_size: 50 },
    { name: 'Faluda Glass', pack_size: 50 },
    { name: 'Hand Gloves', pack_size: 100 },
    { name: 'Ice Cream Cups', pack_size: 100 },
    { name: 'Idly Box', pack_size: 100 },
    { name: 'Napkins', pack_size: 100 },
    { name: 'Straws Big', pack_size: 500 },
    { name: 'Straws Small', pack_size: 500 },
    { name: 'Tea Cups Big', pack_size: 100 },
    { name: 'Tea Cups Small', pack_size: 100 },
    { name: 'Tooth Pick', pack_size: 500 },
    { name: 'Water Glass', pack_size: 100 },
    { name: 'Wooden Fork', pack_size: 100 },
    { name: 'Wooden Icecream Spoon', pack_size: 100 },
    { name: 'Wooden Spoons Big', pack_size: 100 },
    { name: 'Wooden Spoons Small', pack_size: 100 }
  ];

  for (const item of defaults) {
    await knex('stock')
      .whereRaw('LOWER(name) = ?', [item.name.toLowerCase()])
      .update({ pack_size: item.pack_size });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('stock', function(table) {
    table.dropColumn('pack_size');
  });
};
