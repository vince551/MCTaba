export async function up(pgm) {
  pgm.createTable('books', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    library_id: { type: 'uuid', notNull: true, references: 'libraries(id)', onDelete: 'CASCADE' },
    title: { type: 'varchar(240)', notNull: true },
    author: { type: 'varchar(180)', notNull: true },
    category: { type: 'varchar(80)', notNull: true, default: 'Uncategorized' },
    isbn: { type: 'varchar(20)' },
    status: { type: 'varchar(20)', notNull: true, default: 'active' },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('books', 'books_status_check', {
    check: "status IN ('active', 'archived')",
  });
  pgm.createIndex('books', ['library_id', 'created_at'], { name: 'books_library_created_idx' });
  pgm.createIndex('books', ['library_id', 'title'], { name: 'books_library_title_idx' });

  pgm.createTable('book_copies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    library_id: { type: 'uuid', notNull: true, references: 'libraries(id)', onDelete: 'CASCADE' },
    book_id: { type: 'uuid', notNull: true, references: 'books(id)', onDelete: 'CASCADE' },
    barcode: { type: 'varchar(64)', notNull: true, unique: true },
    status: { type: 'varchar(20)', notNull: true, default: 'available' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('book_copies', 'book_copies_status_check', {
    check: "status IN ('available', 'borrowed', 'lost', 'damaged', 'withdrawn')",
  });
  pgm.createIndex('book_copies', ['library_id', 'book_id'], { name: 'book_copies_library_book_idx' });
  pgm.createIndex('book_copies', ['library_id', 'status'], { name: 'book_copies_library_status_idx' });
}

export async function down(pgm) {
  pgm.dropTable('book_copies');
  pgm.dropTable('books');
}
