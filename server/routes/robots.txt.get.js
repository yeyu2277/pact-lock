export default defineEventHandler(event => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  const siteUrl = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '')
  const url = new URL(siteUrl)
  if (['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname.endsWith('.example')) return 'User-agent: *\nDisallow: /\n'
  return 'User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /*/account\nSitemap: ' + siteUrl + '/sitemap.xml\n'
})
