import {
  getSchemaOverview as getSqliteSchemaOverview,
  resolveSqliteDatabasePath,
} from "./demo-retail-db.js";
import {
  getRelationalSchemaOverview,
} from "./live-relational-db.js";
import mysql from "mysql2/promise";
import pg from "pg";
import { DatabaseSync } from "node:sqlite";

const { Client: PostgresClient } = pg;

function getPort(connection, fallbackPort) {
  const parsedPort = Number.parseInt(
    String(connection?.port || ""),
    10,
  );

  return Number.isFinite(parsedPort)
    ? parsedPort
    : fallbackPort;
}

export async function getSchemaOverviewForConnection(connection) {
  if (
    connection &&
    ["postgresql", "mysql"].includes(connection.databaseType)
  ) {
    return getRelationalSchemaOverview(connection);
  }

  return getSqliteSchemaOverview(connection);
}

const SLOW_QUERY_THRESHOLD_MS = 500;

function logSlowQuery(sql, durationMs) {
  console.warn(`[slow-query] ${durationMs}ms — ${sql.slice(0, 120).replace(/\s+/g, " ")}`);
}

export async function executeReadOnlyQuery(connection, sql) {
  const normalizedSql = String(sql || "").trim().replace(/;\s*$/, "");
  // Ignore quoted values and comments when checking statement structure.
  const structure = normalizedSql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|--[^\n]*|\/\*[\s\S]*?\*\//g, " ");

  if (
    !/^(select|with)\b/i.test(structure.trim()) || structure.includes(";") ||
    /\b(insert|update|delete|drop|alter|create|truncate|attach|detach|pragma|copy|call|execute|grant|revoke|into|lock|load_extension|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_sleep|dblink|lo_import|lo_export|load_file|sleep|benchmark)\b/i.test(structure)
  ) {
    throw new Error("Only read-only SELECT queries are allowed.");
  }

  const start = Date.now();
  const boundedSql = `SELECT * FROM (${normalizedSql}) AS aska_result LIMIT 500`;

  let rows;

  if (
    connection &&
    connection.databaseType === "postgresql"
  ) {
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
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const result = await client.query(boundedSql);
      rows = result.rows;
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.end();
    }
  } else if (
    connection &&
    connection.databaseType === "mysql"
  ) {
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
      await client.query("SET SESSION MAX_EXECUTION_TIME = 10000");
      await client.query("START TRANSACTION READ ONLY");
      const [result] = await client.query(boundedSql);
      rows = result;
    } finally {
      await client.rollback().catch(() => undefined);
      await client.end();
    }
  } else {
    const database = new DatabaseSync(resolveSqliteDatabasePath(connection), { readOnly: true });

    try {
      database.exec("PRAGMA query_only = ON");
      rows = database.prepare(boundedSql).all();
    } finally {
      database.close();
    }
  }

  const duration = Date.now() - start;
  if (duration >= SLOW_QUERY_THRESHOLD_MS) {
    logSlowQuery(normalizedSql, duration);
  }

  return rows;
}
