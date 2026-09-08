// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://vacanthr.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // Marketing pages opt into static prerendering via `export const prerender = true`.
  // Dynamic pages (careers, auth, dashboards) render on request.
});
