# Database Architecture & Objects

This file serves as the definitive index for database objects (Tables, Indexes, Functions, Triggers) for the Kapila project.

## Schema Source of Truth
For the complete, exact DDL of every object, refer to the [schema.sql](../backend/db/schema.sql) file. This file must be kept updated via pg_dump whenever new migrations are added.

## Guidelines for Modifying Database Objects

### 1. Tables
- All tables must be defined in Knex migrations under ackend/db/migrations/.
- Pluralize table names (e.g., users, issuances).
- Every table must have an id serial primary key unless it's a many-to-many join table with a composite primary key.
- Standard auditing columns (created_at, updated_at, created_by, updated_by) should be included on business tables.

### 2. Indexes
- Naming Convention: idx_<table_name>_<column_name>.
- Always add indexes for foreign keys to prevent full-table scans during cascading deletes or joins.
- Add composite indexes for frequently queried pairs (e.g., idx_stock_department_item).

### 3. Functions & Stored Procedures
- Define functions in dedicated migrations.
- Naming Convention: n_<action>_<entity> (e.g., n_calculate_low_stock).
- Keep business logic in the application layer (Node.js) unless the function strictly deals with data integrity or high-performance bulk operations.

### 4. Triggers
- Naming Convention: 	rg_<table_name>_<action> (e.g., 	rg_users_updated_at).
- Triggers should be used sparingly and primarily for auditing (e.g., updating updated_at columns automatically) or maintaining strict consistency invariants.
