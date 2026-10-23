import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { locales, defaultLocale } from './app/config/locales.js'

const iconDirectory = fileURLToPath(new URL('./public/icons/phosphor/', import.meta.url))
const localIcons = readdirSync(iconDirectory).filter(file => file.endsWith('.svg')).map(file => 'pact:' + file.slice(0, -4))

export default defineNuxtConfig({
  compatibilityDate: '2026-10-20',
  ssr: true,
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@nuxtjs/i18n',
  ],
  css: ['~/assets/css/main.css'],
  // Use local system fonts; no font-provider requests are needed to build.
  ui: { fonts: false },
  colorMode: { preference: 'dark', fallback: 'dark' },
  icon: {
    provider: 'none',
    fallbackToApi: false,
    customCollections: [{ prefix: 'pact', dir: iconDirectory }],
    clientBundle: { icons: localIcons, includeCustomCollections: true, scan: true, sizeLimitKb: 256 },
  },
  runtimeConfig: {
    public: {
      siteUrl: 'http://localhost:3000',
      reownProjectId: '',
      networksJson: '',
      defaultChainId: 137,
      githubUrl: '',
      telegramUrl: '',
      xUrl: '',
      siteLocales: locales.map(({ code, language }) => ({ code, language })),
      defaultLocale,
      i18n: {
        baseUrl: 'http://localhost:3000',
      },
    },
  },
  app: {
    head: {
      title: 'Pact Lock',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  i18n: {
    defaultLocale,
    strategy: 'prefix_except_default',
    langDir: 'locales',
    locales,
    // Stable URLs for crawlers; users choose their language explicitly.
    detectBrowserLanguage: false,
    vueI18n: './i18n.config.js',
  },
  piniaPluginPersistedstate: {
    storage: 'cookies',
    key: 'pact-lock-%id',
    cookieOptions: {
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    },
  },
})
