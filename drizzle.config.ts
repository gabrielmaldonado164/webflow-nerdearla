import { defineConfig } from "drizzle-kit";

import { resolveDatabaseConfig } from "./src/db/config";

// Migrations never fall back to a local file implicitly: use `npm run db:migrate:local`.
const { url, authToken } = resolveDatabaseConfig(process.env, { allowLocalFallback: false });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: { url, authToken },
});
