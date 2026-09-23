// Merges the Wrangler-generated `Env` (see worker-configuration.d.ts) into the
// `CloudflareEnv` type used by `getCloudflareContext()` from @opennextjs/cloudflare.
interface CloudflareEnv extends Env {}
