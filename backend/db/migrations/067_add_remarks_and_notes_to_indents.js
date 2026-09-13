exports.up = async function(knex) {
  const hasRemarks = await knex.schema.hasColumn('indents', 'remarks');
  if (!hasRemarks) {
    await knex.schema.alterTable('indents', function(table) {
      table.text('remarks').nullable();
      table.string('shift', 20).nullable().defaultTo('MORNING');
      table.string('priority', 20).nullable().defaultTo('NORMAL');
    });
  }

  const hasItemNotes = await knex.schema.hasColumn('indent_items', 'notes');
  if (!hasItemNotes) {
    await knex.schema.alterTable('indent_items', function(table) {
      table.text('notes').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasRemarks = await knex.schema.hasColumn('indents', 'remarks');
  if (hasRemarks) {
    await knex.schema.alterTable('indents', function(table) {
      table.dropColumn('remarks');
      table.dropColumn('shift');
      table.dropColumn('priority');
    });
  }

  const hasItemNotes = await knex.schema.hasColumn('indent_items', 'notes');
  if (hasItemNotes) {
    await knex.schema.alterTable('indent_items', function(table) {
      table.dropColumn('notes');
    });
  }
};
