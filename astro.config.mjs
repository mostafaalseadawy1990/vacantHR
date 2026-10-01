// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false }, // keeps the e2e locators clean; never shipped to production anyway
  site: 'https://vacanthr.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // Marketing pages opt into static prerendering via `export const prerender = true`.
  // Dynamic pages (careers, auth, dashboards) render on request.
});
