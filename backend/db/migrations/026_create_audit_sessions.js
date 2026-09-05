exports.up = (knex) =>
  knex.schema.createTable("audit_sessions", (t) => {
    t.increments("id").primary();
    t.string("reference").notNullable().unique();
    t.string("auditor_name").notNullable();
    t.integer("department_id").nullable().references("id").inTable("departments").onDelete("SET NULL");
    t.string("status").notNullable().defaultTo("in_progress"); // in_progress | completed | cancelled
    t.jsonb("snapshot").notNullable();
    t.text("notes").nullable();
    t.integer("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTableIfExists("audit_sessions");
