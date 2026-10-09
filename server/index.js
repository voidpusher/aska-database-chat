import { pathToFileURL } from "node:url";
import { app } from "./app.js";
import { checkStoreHealth, getStoreMode } from "./data-store.js";
import { getMissingProductionEnvVars, getRuntimeSummary, isProduction } from "./runtime.js";

const port = Number(process.env.PORT || 4000);
const DEFAULT_ENCRYPTION_KEY = "local-development-only-orrico-secret-key";

function assertProductionRequirements() {
  if (!isProduction()) {
    return;
  }

  const missing = getMissingProductionEnvVars();

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}. Refusing to start.`,
    );
  }

  const encryptionKey = String(process.env.APP_ENCRYPTION_KEY || "").trim();

  if (!encryptionKey || encryptionKey === DEFAULT_ENCRYPTION_KEY) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be set to a strong secret in production. Refusing to start.",
    );
  }

  const storeMode = getStoreMode();

  if (storeMode !== "postgresql") {
    throw new Error(
      "DATABASE_URL must be set to a PostgreSQL connection string in production. SQLite is not safe for multi-instance deployments. Refusing to start.",
    );
  }
}

const currentModuleUrl = pathToFileURL(process.argv[1] || "").href;

if (import.meta.url === currentModuleUrl) {
  assertProductionRequirements();

  const server = app.listen(port, async () => {
    const storeHealth = await checkStoreHealth().catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Store check failed.",
    }));
    const runtime = getRuntimeSummary({
      storeMode: getStoreMode(),
      storeHealth,
    });

    console.log(`Aska API listening on http://localhost:${port}`);
    console.log(
      JSON.stringify({
        level: "info",
        event: "server_start",
        port,
        runtime,
      }),
    );
  });

  // Graceful shutdown — finish in-flight requests before exiting
  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(JSON.stringify({ level: "info", event: "shutdown_initiated", signal }));

    server.close((err) => {
      if (err) {
        console.error(JSON.stringify({ level: "error", event: "shutdown_error", error: err.message }));
        process.exit(1);
      }
      console.log(JSON.stringify({ level: "info", event: "shutdown_complete" }));
      process.exit(0);
    });

    // Force-kill if shutdown takes longer than 15s
    setTimeout(() => {
      console.error(JSON.stringify({ level: "error", event: "shutdown_timeout" }));
      process.exit(1);
    }, 15_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error(JSON.stringify({ level: "fatal", event: "uncaught_exception", error: err.message, stack: err.stack }));
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    console.error(JSON.stringify({ level: "fatal", event: "unhandled_rejection", reason: String(reason) }));
  });
}
