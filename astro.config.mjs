// @ts-check
import { defineConfig, envField, memoryCache } from "astro/config";

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  build: {
    // External stylesheets persist correctly across ClientRouter navigations.
    inlineStylesheets: "never",
  },
  env: {
    schema: {
      API_AUTHORITY: envField.string({ context: "server", access: "public", optional: true }),
      // Preview edition is no-indexed by default. Set NOINDEX=false for a real production deploy.
      NOINDEX: envField.boolean({ context: "server", access: "public", optional: true, default: true }),
    },
  },
  adapter: netlify(),
  experimental: {
    cache: {
      provider: memoryCache(),
    },
  },
});
