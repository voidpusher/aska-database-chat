import mysql from "mysql2/promise";
import pg from "pg";

const { Client: PostgresClient } = pg;

function getPort(connection, fallbackPort) {
  const parsedPort = Number.parseInt(
    String(connection.port || ""),
    10,
  );

  return Number.isFinite(parsedPort)
    ? parsedPort
    : fallbackPort;
}

function normalizeSchemaRows(rows) {
  const schemaMap = new Map();

  for (const row of rows) {
    const tableName = row.table_name;
    const table =
      schemaMap.get(tableName) || {
        table: tableName,
        columns: [],
      };

    table.columns.push({
      name: row.column_name,
      type: row.data_type,
      required:
        row.is_nullable === "NO" ||
        row.is_nullable === 0,
      primaryKey:
        row.column_key === "PRI" ||
        row.constraint_type === "PRIMARY KEY",
    });

    schemaMap.set(tableName, table);
  }

  return Array.from(schemaMap.values()).sort((left, right) =>
    left.table.localeCompare(right.table),
  );
}

async function withPostgresClient(connection, callback) {
  const client = new PostgresClient({
    host: connection.host,
    port: getPort(connection, 5432),
    user: connection.username,
    password: connection.password,
    database: connection.databaseName,
    ssl: connection.ssl
      ? { rejectUnauthorized: true }
      : undefined,
    connectionTimeoutMillis: 8000,
  });

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function withMysqlClient(connection, callback) {
  const client = await mysql.createConnection({
    host: connection.host,
    port: getPort(connection, 3306),
    user: connection.username,
    password: connection.password,
    database: connection.databaseName,
    connectTimeout: 8000,
    ssl: connection.ssl
      ? { rejectUnauthorized: true }
      : undefined,
  });

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function testRelationalConnection(connection) {
  if (connection.databaseType === "postgresql") {
    return withPostgresClient(connection, async (client) => {
      const databaseResult = await client.query(
        "SELECT current_database() AS database_name",
      );
      const tableCountResult = await client.query(`
        SELECT COUNT(*)::int AS total
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      `);

      return {
        ok: true,
        databaseName:
          databaseResult.rows[0]?.database_name ||
          connection.databaseName,
        tableCount: Number(
          tableCountResult.rows[0]?.total || 0,
        ),
      };
    });
  }

  if (connection.databaseType === "mysql") {
    return withMysqlClient(connection, async (client) => {
      const [databaseRows] = await client.query(
        "SELECT DATABASE() AS database_name",
      );
      const [tableCountRows] = await client.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.tables
          WHERE table_schema = ?
            AND table_type = 'BASE TABLE'
        `,
        [connection.databaseName],
      );

      return {
        ok: true,
        databaseName:
          databaseRows[0]?.database_name ||
          connection.databaseName,
        tableCount: Number(tableCountRows[0]?.total || 0),
      };
    });
  }

  throw new Error("Unsupported relational database type.");
}

export async function getRelationalSchemaOverview(connection) {
  if (connection.databaseType === "postgresql") {
    return withPostgresClient(connection, async (client) => {
      const result = await client.query(`
        SELECT
          columns.table_name,
          columns.column_name,
          columns.data_type,
          columns.is_nullable,
          tc.constraint_type
        FROM information_schema.columns AS columns
        LEFT JOIN information_schema.key_column_usage AS kcu
          ON columns.table_schema = kcu.table_schema
         AND columns.table_name = kcu.table_name
         AND columns.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints AS tc
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema = tc.table_schema
        WHERE columns.table_schema = 'public'
        ORDER BY columns.table_name, columns.ordinal_position
      `);

      return {
        databasePath: `${connection.host}:${connection.port || 5432}/${connection.databaseName}`,
        schema: normalizeSchemaRows(result.rows),
      };
    });
  }

  if (connection.databaseType === "mysql") {
    return withMysqlClient(connection, async (client) => {
      const [rows] = await client.query(
        `
          SELECT
            table_name,
            column_name,
            data_type,
            is_nullable,
            column_key
          FROM information_schema.columns
          WHERE table_schema = ?
          ORDER BY table_name, ordinal_position
        `,
        [connection.databaseName],
      );

      return {
        databasePath: `${connection.host}:${connection.port || 3306}/${connection.databaseName}`,
        schema: normalizeSchemaRows(rows),
      };
    });
  }

  throw new Error("Unsupported relational database type.");
}
