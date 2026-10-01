// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false },
  vite: { server: { allowedHosts: ['www.vacanthr.com', 'vacanthr.com'] } }, // dev only: lets the e2e suite exercise the www → apex redirect // keeps the e2e locators clean; never shipped to production anyway
  site: 'https://vacanthr.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // Marketing pages opt into static prerendering via `export const prerender = true`.
  // Dynamic pages (careers, auth, dashboards) render on request.
});
