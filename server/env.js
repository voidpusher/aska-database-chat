import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Load local secrets before application modules read configuration. Existing
// deployment environment variables take precedence over .env values.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
