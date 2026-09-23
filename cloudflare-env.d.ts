// Merges the Wrangler-generated `Env` (see worker-configuration.d.ts) into the
// `CloudflareEnv` type used by `getCloudflareContext()` from @opennextjs/cloudflare.
// Intentional declaration merging: this interface only exists to extend
// the generated `Env` under the name @opennextjs/cloudflare expects.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CloudflareEnv extends Env {}
