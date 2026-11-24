export async function up(pgm) {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'varchar(320)', notNull: true },
    full_name: { type: 'varchar(160)', notNull: true },
    password_hash: { type: 'text', notNull: true },
    email_verified_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('users', 'lower(email)', { name: 'users_email_lower_unique', unique: true });

  pgm.createTable('libraries', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(180)', notNull: true },
    slug: { type: 'varchar(100)', notNull: true, unique: true },
    library_type: { type: 'varchar(40)', notNull: true },
    location: { type: 'varchar(180)' },
    status: { type: 'varchar(24)', notNull: true, default: 'active' },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('libraries', 'libraries_status_check', {
    check: "status IN ('active', 'suspended', 'archived')",
  });

  pgm.createTable('memberships', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    library_id: { type: 'uuid', notNull: true, references: 'libraries(id)', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    role: { type: 'varchar(24)', notNull: true },
    status: { type: 'varchar(24)', notNull: true, default: 'active' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('memberships', 'memberships_library_user_unique', {
    unique: ['library_id', 'user_id'],
  });
  pgm.addConstraint('memberships', 'memberships_role_check', {
    check: "role IN ('owner', 'admin', 'librarian', 'staff', 'member')",
  });
  pgm.addConstraint('memberships', 'memberships_status_check', {
    check: "status IN ('active', 'invited', 'suspended', 'removed')",
  });
  pgm.createIndex('memberships', ['user_id', 'status'], { name: 'memberships_user_status_idx' });

  pgm.createTable('audit_logs', {
    id: { type: 'bigserial', primaryKey: true },
    library_id: { type: 'uuid', references: 'libraries(id)', onDelete: 'SET NULL' },
    actor_user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    action: { type: 'varchar(100)', notNull: true },
    resource_type: { type: 'varchar(80)' },
    resource_id: { type: 'varchar(120)' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('audit_logs', ['library_id', 'created_at'], { name: 'audit_logs_library_created_idx' });
  pgm.createIndex('audit_logs', ['actor_user_id', 'created_at'], { name: 'audit_logs_actor_created_idx' });
}

export async function down(pgm) {
  pgm.dropTable('audit_logs');
  pgm.dropTable('memberships');
  pgm.dropTable('libraries');
  pgm.dropTable('users');
}
