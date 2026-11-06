import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envFile = join(dirname(fileURLToPath(import.meta.url)), ".env");

if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envFile);
  } catch {}
}
