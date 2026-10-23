<script setup>
const { defaultNetwork } = usePactConfig()
const wallet = useWalletSession()
const network = computed(() => wallet.connected.value ? wallet.deployment.value || defaultNetwork : defaultNetwork)
const { t } = useI18n()
const localePath = useLocalePath()
</script>
<template>
  <footer class="site-footer"><div class="footer-inner">
    <BrandMark />
    <nav :aria-label="t('nav.guide')">
      <NuxtLink :to="localePath('/guide')">{{ t('nav.guide') }}</NuxtLink>
      <a :href="network.explorerUrl + '/address/' + network.pactLock.address" target="_blank" rel="noopener noreferrer">{{ t('common.explorer') }}</a>
    </nav>
    <SocialLinks />
  </div></footer>
</template>
