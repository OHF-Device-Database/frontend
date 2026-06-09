// @ts-check
import { defineConfig, envField, memoryCache } from "astro/config";

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  build: {
    // External stylesheets persist correctly across ClientRouter navigations.
    inlineStylesheets: "never",
  },
  env: {
    schema: {
      API_AUTHORITY: envField.string({ context: "server", access: "public", optional: true }),
    },
  },
  adapter: node({
    mode: "standalone",
  }),
  experimental: {
    cache: {
      provider: memoryCache(),
    },
  },
});
