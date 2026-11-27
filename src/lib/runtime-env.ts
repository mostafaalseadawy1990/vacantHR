// Runtime environment variables/secrets.
// @astrojs/cloudflare v13+ removed `Astro.locals.runtime.env`; bindings are read from `cloudflare:workers`.
// Falls back to import.meta.env (local dev / vitest). `locals.runtime` is NOT read: its getter throws on v13+.
type Env = Record<string, string | undefined>;

let workerEnv: Env = {};
try {
  // Not resolvable outside workerd (e.g. vitest), hence the guarded dynamic import.
  const spec = 'cloudflare:workers';
  workerEnv = ((await import(/* @vite-ignore */ spec)) as { env: Env }).env ?? {};
} catch { /* not running on Workers */ }

export function runtimeEnv(_ctx?: unknown): Env {
  return new Proxy({} as Env, {
    get: (_t, k: string) => workerEnv[k] ?? (import.meta.env as Env)[k],
  });
}
