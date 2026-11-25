export async function up(pgm) {
  pgm.addColumn('users', {
    supabase_user_id: { type: 'uuid' },
  });
  pgm.alterColumn('users', 'password_hash', { notNull: false });
  pgm.createIndex('users', 'supabase_user_id', {
    name: 'users_supabase_user_id_unique',
    unique: true,
    where: 'supabase_user_id IS NOT NULL',
  });
}

export async function down(pgm) {
  pgm.dropIndex('users', 'supabase_user_id', { name: 'users_supabase_user_id_unique' });
  pgm.dropColumn('users', 'supabase_user_id');
  pgm.alterColumn('users', 'password_hash', { notNull: true });
}
