const escapeXml = text => text.replace(/[<>&"']/g, value => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[value]))
export default defineEventHandler(event => {
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  const config = useRuntimeConfig(event).public
  const locales = config.siteLocales
  const defaultLocale = config.defaultLocale
  const base = config.siteUrl.replace(/\/$/, '')
  const routes = ['/', '/orders', '/orders/new', '/guide']
  const entries = routes.flatMap(path => locales.map(locale => {
    const localized = code => base + (code === defaultLocale ? '' : '/' + code) + (path === '/' ? '' : path)
    return '<url><loc>' + escapeXml(localized(locale.code) || base + '/') + '</loc>' + locales.map(alternate => '<xhtml:link rel="alternate" hreflang="' + alternate.language + '" href="' + escapeXml(localized(alternate.code)) + '" />').join('') + '</url>'
  }))
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + entries.join('') + '</urlset>'
})
