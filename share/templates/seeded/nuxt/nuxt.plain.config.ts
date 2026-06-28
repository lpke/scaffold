// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  alias: {
    components: fileURLToPath(new URL('./{{NUXT_ALIAS_ROOT}}components', import.meta.url)),
    composables: fileURLToPath(new URL('./{{NUXT_ALIAS_ROOT}}composables', import.meta.url)),
    data: fileURLToPath(new URL('./{{NUXT_ALIAS_ROOT}}data', import.meta.url)),
    pages: fileURLToPath(new URL('./{{NUXT_ALIAS_ROOT}}pages', import.meta.url)),
    types: fileURLToPath(new URL('./{{NUXT_ALIAS_ROOT}}types', import.meta.url)),
    utils: fileURLToPath(new URL('./{{NUXT_ALIAS_ROOT}}utils', import.meta.url)),
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      title: 'Vue + Nuxt',
      meta: [
        {
          name: 'description',
          content: 'Scaffolded Vue + Nuxt App',
        },
      ],
    },
  },
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
});
