type LocalSchemaDatabase = {
  getAllSync<T>(source: string): T[]
  execSync(source: string): void
}

const supportedTables = new Set([
  'inspection_drafts',
  'inspection_measurements_local',
  'inspection_photo_queue',
])

/**
 * Add only missing local SQLite columns. Unlike a blanket catch around ALTER
 * TABLE, this does not hide disk, corruption, locking, or schema errors.
 */
export function ensureLocalColumns(
  database: LocalSchemaDatabase,
  statements: string[],
): void {
  const columnsByTable = new Map<string, Set<string>>()

  for (const statement of statements) {
    const match = statement.match(
      /^ALTER TABLE ([a-z_][a-z0-9_]*) ADD COLUMN ([a-z_][a-z0-9_]*)\s+.+$/i,
    )
    if (!match) throw new Error(`Unsupported local schema migration: ${statement}`)

    const [, table, column] = match
    if (!supportedTables.has(table)) {
      throw new Error(`Unsupported local schema migration table: ${table}`)
    }

    let columns = columnsByTable.get(table)
    if (!columns) {
      const rows = database.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
      columns = new Set(rows.map((row) => row.name))
      columnsByTable.set(table, columns)
    }

    if (columns.has(column)) continue
    database.execSync(statement)
    columns.add(column)
  }
}
