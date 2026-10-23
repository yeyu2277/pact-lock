<script setup>
import { en, es, pt_br, ja, ko, vi, id, zh_cn, zh_tw as zhHant } from '@nuxt/ui/locale'

const { locale } = useI18n()
const uiLocales = { en, es, ja, ko, vi, id, 'pt-BR': pt_br, 'zh-CN': zh_cn, 'zh-Hant': { ...zhHant, code: 'zh-Hant' } }
const uiLocale = computed(() => uiLocales[locale.value] || en)
const localeHead = useLocaleHead({ seo: true })
const colorMode = useColorMode()
colorMode.preference = 'dark'
const mobileNotifications = ref(false)
let stopNotificationViewport = () => {}
onMounted(() => {
  const viewport = window.matchMedia('(max-width: 760px)')
  const update = () => { mobileNotifications.value = viewport.matches }
  update()
  viewport.addEventListener('change', update)
  stopNotificationViewport = () => viewport.removeEventListener('change', update)
})
onBeforeUnmount(() => stopNotificationViewport())
useHead(() => ({
  htmlAttrs: { ...localeHead.value.htmlAttrs },
  link: localeHead.value.link,
  meta: localeHead.value.meta,
}))
useSeoMeta({ ogSiteName: 'Pact Lock', ogType: 'website', themeColor: '#0c1110' })
</script>
<template><UApp :locale="uiLocale" :toaster="{ position: mobileNotifications ? 'top-center' : 'bottom-right' }"><NuxtLayout><NuxtPage /></NuxtLayout></UApp></template>
