exports.up = async (knex) => {
  const map = {
    'TIFFINS': 'South Indian',
    'SI-MEALS': 'South Indian',
    'default South Indian': 'South Indian',
    'NORTH INDIAN': 'North Indian',
    'MOCKTAILS & CONTINENTAL': 'Continental',
    'Continental Kitchen': 'Continental',
    'CHAT & SOFTY': 'Bakery',
    'CHINESE & DOSA': 'Chinese',
    'STAFF': 'South Indian',
    'RESTAURANT': 'South Indian',
    'ROOM SERVICE': 'South Indian',
  };

  for (const [oldName, newName] of Object.entries(map)) {
    // Update indents
    await knex('indents').where('dept', oldName).update({ dept: newName });
    
    // Update issuances
    await knex('issuances').where('dept', oldName).update({ dept: newName });
    
    // Update production
    await knex('production').where('dept', oldName).update({ dept: newName });
    
    // Update leftovers
    await knex('leftovers').where('dept', oldName).update({ dept: newName });
  }
};

exports.down = async (knex) => {
  // No meaningful down migration as data is irreversibly mapped
};
