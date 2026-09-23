import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated build/type output (OpenNext/Cloudflare/Wrangler), never
    // hand-authored: linting it just surfaces noise from bundled/generated
    // code we don't control.
    ".open-next/**",
    ".wrangler/**",
    "worker-configuration.d.ts",
  ]),
]);

export default eslintConfig;
