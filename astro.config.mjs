// @ts-check
import { defineConfig, envField } from 'astro/config';
import wix from "@wix/astro";
import wixPages from "@wix/astro-pages";

import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";

// https://astro.build/config
export default defineConfig({
  integrations: [wix(), wixPages(), react()],
  security: { checkOrigin: false },
  adapter: wixHostingAdapter(),

  image: {
    domains: ["static.wixstatic.com"],
  },

  env: {
    schema: {
      // A Wix API key (read CMS drafts, read member badges) for the Admin-only
      // draft previews. Server-only; without it the drafts pages are switched off.
      BAYC_ADMIN_API_KEY: envField.string({ access: "secret", context: "server", optional: true }),
    },
  },

  output: "server",
});