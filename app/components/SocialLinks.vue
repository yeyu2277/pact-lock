<script setup>
const { site } = usePactConfig()
defineProps({ githubOnly: Boolean })
const { t } = useI18n()
const links = [{ key: 'github', name: 'GitHub', icon: 'github-logo' }, { key: 'telegram', name: 'Telegram', icon: 'telegram-logo' }, { key: 'x', name: 'X', icon: 'x-logo' }]
</script>
<template>
  <div class="social-links">
    <template v-for="link in githubOnly ? links.slice(0, 1) : links" :key="link.key">
      <a v-if="site.links[link.key]" :href="site.links[link.key]" target="_blank" rel="noopener noreferrer" :aria-label="link.name"><SiteIcon :name="link.icon" /></a>
      <span v-else class="social-unset" :title="link.name + ' · ' + t('common.comingSoon')" :aria-label="link.name + ' · ' + t('common.comingSoon')"><SiteIcon :name="link.icon" /></span>
    </template>
  </div>
</template>
