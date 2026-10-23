export function usePactSeo(page, { privatePage = false } = {}) {
  const { site } = usePactConfig()
  const { t, locale } = useI18n()
  const route = useRoute()
  const config = useRuntimeConfig()
  useSeoMeta({
    title: () => t('seo.' + page + '.title') + ' | Pact Lock',
    description: () => t('seo.' + page + '.description'),
    keywords: () => t('seo.keywords'),
    robots: () => privatePage ? 'noindex, nofollow' : 'index, follow',
    ogTitle: () => t('seo.' + page + '.title') + ' | Pact Lock',
    ogDescription: () => t('seo.' + page + '.description'),
    ogImage: () => new URL(site.shareImages[locale.value] || site.shareImages.en, config.public.siteUrl).href,
    ogImageWidth: 1729,
    ogImageHeight: 910,
    ogUrl: () => new URL(route.path, config.public.siteUrl).href,
    twitterCard: 'summary_large_image',
  })
}
