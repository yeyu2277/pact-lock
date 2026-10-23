<script setup>
const { businessNetworks } = usePactConfig()
const props = defineProps({ matchTriggerWidth: { type: Boolean, default: true } })
const { t } = useI18n()
const wallet = useWalletSession()
const feedback = useAppFeedback()
const switching = ref(false)
const { trigger, content } = useDropdownFocus()
const items = computed(() => businessNetworks.map(network => ({
  label: network.name, description: (network.testnet ? t('common.testnet') + ' · ' : '') + network.chainId,
  avatar: { src: network.icon, alt: network.name }, type: 'checkbox',
  checked: wallet.chainId.value === network.chainId, disabled: switching.value,
  onSelect: async () => {
    if (switching.value || wallet.chainId.value === network.chainId) return
    switching.value = true
    try { await wallet.switchNetwork(network.chainId) } catch (error) { feedback.notify(error) }
    finally { switching.value = false }
  },
})))
</script>
<template>
  <UDropdownMenu :items="items" :modal="false" :content="{ align: 'end', ...content }" :ui="{ content: ['network-options', !props.matchTriggerWidth && 'network-options-expanded'] }">
    <UButton ref="trigger" variant="outline" color="neutral" trailing-icon="i-pact-caret-down" :loading="switching" class="network-trigger" :aria-label="t('wallet.switchNetwork')">
      <img v-if="wallet.network.value?.icon" :src="wallet.network.value.icon" alt="" width="24" height="24">
      <SiteIcon v-else name="globe" />
      <span>{{ wallet.network.value?.name || t('wallet.chain', { id: wallet.chainId.value }) }}</span>
    </UButton>
  </UDropdownMenu>
</template>
