const knex = require('knex')(require('../knexfile').development);

const itemsToPcs = [
  'CURD CUPS',
  'SILVER CONTAINER -750ML',
  'GARBAGE BAGS',
  'DUST BIN COVER',
  'PILLOW COVERS',
  '4*6 PARCEL COVER',
  '5*8 PARCEL COVER',
  '4X6 COVER',
  '6X8 COVER',
  '7*9 SILVER COVER',
  '6X8 SILVEER COVER',
  'BUTTER COVERS',
  'FALUDA GLASS',
  'FALUFA GLASSES',
  'GARBAGE BAGS (24*32)',
  '500 ML RECTANGULAR',
  'CLEEN WRAP',
  'SILVER CONTAINER -750ML',
  'SILVER CONTAINER -250ML',
  'SILVER CONTAINER -500ML',
  'ALUMINIUM FOIL',
  'ROLL',
  'CLING FILM',
  'CLEAN WRAP',
  'CLEEN WRAP',
  'SWEET BOX',
  'MEALS BOX',
  'PAPER CUPS',
  'TEA CUPS',
  'SPOONS',
  'FORKS',
  'KNIVES',
  'TISSUES',
  'HAND GLOVES',
  'SCRUBBER ORDINARY',
  'STEEL SCRUBBER'
];

async function run() {
  console.log("Updating stock units in database...");
  
  // 1. Update items in stock table to 'pcs' if they are packaging/disposable
  for (const name of itemsToPcs) {
    const count = await knex('stock')
      .whereRaw("LOWER(name) = LOWER(?)", [name])
      .update({ unit: 'pcs' });
    if (count > 0) {
      console.log(`Updated unit to 'pcs' for item: ${name} (${count} batch(es) updated)`);
    }
  }

  // Also do a wildcard search for items containing packaging keywords and having unit 'kg' or 'L'
  const mismatchedWildcard = await knex('stock')
    .where(qb => {
      qb.whereILike('name', '%box%')
        .orWhereILike('name', '%cup%')
        .orWhereILike('name', '%glass%')
        .orWhereILike('name', '%lid%')
        .orWhereILike('name', '%spoon%')
        .orWhereILike('name', '%plate%')
        .orWhereILike('name', '%cover%')
        .orWhereILike('name', '%bag%')
        .orWhereILike('name', '%container%')
        .orWhereILike('name', '%scrubber%');
    })
    .andWhere(qb => {
      qb.where('unit', 'kg')
        .orWhere('unit', 'L');
    })
    .andWhereNot('name', 'like', '%Cabbage%');

  for (const row of mismatchedWildcard) {
    const count = await knex('stock')
      .where('id', row.id)
      .update({ unit: 'pcs' });
    if (count > 0) {
      console.log(`Updated wildcard item '${row.name}' (ID: ${row.id}) from '${row.unit}' to 'pcs'`);
    }
  }

  console.log("Stock units corrected successfully.");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
