<script setup>
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const getRouteBaseName = useRouteBaseName()
const mobileOpen = ref(false)
const wallet = useWalletSession()
const feedback = useAppFeedback()
let manageWalletAfterClose = false
function requestWalletManagement() {
  manageWalletAfterClose = true
  mobileOpen.value = false
}
function afterMenuClosed() {
  if (!manageWalletAfterClose) return
  manageWalletAfterClose = false
  wallet.connect().catch(feedback.notify)
}
const links = computed(() => [{ path: '/', label: t('nav.home'), icon: 'house', base: 'index' }, { path: '/orders', label: t('nav.orders'), icon: 'magnifying-glass', base: 'orders' }, { path: '/orders/new', label: t('nav.create'), icon: 'file-text', base: 'orders-new' }, { path: '/guide', label: t('nav.guide'), icon: 'book-open', base: 'guide' }])
const active = link => link.base === 'orders' ? String(getRouteBaseName(route)).startsWith('orders') && getRouteBaseName(route) !== 'orders-new' : getRouteBaseName(route) === link.base
watch(() => route.fullPath, () => { mobileOpen.value = false })
</script>
<template>
  <header class="site-header">
    <div class="header-inner">
      <BrandMark />
      <nav class="desktop-nav" :aria-label="t('nav.menu')">
        <NuxtLink v-for="link in links" :key="link.path" :to="localePath(link.path)" :class="{ active: active(link) }">{{ link.label }}</NuxtLink>
      </nav>
      <div class="header-actions">
        <div class="desktop-github"><SocialLinks github-only /></div>
        <div class="desktop-language"><LanguageMenu /></div>
        <div class="header-wallet-controls" :class="{ 'is-connected': wallet.connected.value }"><WalletControls /></div>
        <UButton class="mobile-menu-button" color="neutral" variant="ghost" icon="i-pact-list" :aria-label="t('nav.openMenu')" @click="mobileOpen = true" />
      </div>
    </div>
    <USlideover v-model:open="mobileOpen" side="right" :title="t('nav.menu')" :description="t('nav.menuDescription')" :close="{ 'aria-label': t('nav.close') }" :ui="{ content: 'mobile-drawer', header: 'mobile-drawer-header', body: 'mobile-drawer-body', title: 'mobile-drawer-title', description: 'mobile-drawer-description' }" @after:leave="afterMenuClosed">
      <template #body>
        <BrandMark />
        <section v-if="wallet.connected.value" class="mobile-wallet-panel">
          <p>{{ t('wallet.menuTitle') }}</p>
          <WalletControls in-drawer @manage-wallet="requestWalletManagement" />
        </section>
        <nav class="mobile-nav" :aria-label="t('nav.menu')">
          <NuxtLink v-for="link in links" :key="link.path" :to="localePath(link.path)" :class="{ active: active(link) }" @click="mobileOpen = false"><SiteIcon :name="link.icon" />{{ link.label }}<SiteIcon name="caret-right" /></NuxtLink>
        </nav>
        <div class="mobile-language"><span>{{ t('app.language') }}</span><LanguageMenu /></div>
        <div class="mobile-drawer-bottom"><SocialLinks /></div>
      </template>
    </USlideover>
  </header>
</template>
