<script setup>
const { businessNetworks, deploymentById, defaultNetwork } = usePactConfig()
const props = defineProps({ matchTriggerWidth: { type: Boolean, default: true }, modelValue: { type: Number, default: null } })
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const wallet = useWalletSession()
const feedback = useAppFeedback()
const switching = ref(false)
const { trigger, content } = useDropdownFocus()
const currentNetwork = computed(() => wallet.connected.value ? wallet.network.value : deploymentById(props.modelValue) || defaultNetwork)
const currentChainId = computed(() => wallet.connected.value ? wallet.chainId.value : currentNetwork.value.chainId)
const items = computed(() => businessNetworks.map(network => ({
  label: network.name, description: (network.testnet ? t('common.testnet') + ' · ' : '') + network.chainId,
  avatar: { src: network.icon, alt: network.name }, type: 'checkbox',
  checked: currentChainId.value === network.chainId, disabled: switching.value,
  onSelect: async () => {
    if (switching.value || currentChainId.value === network.chainId) return
    if (!wallet.connected.value) { emit('update:modelValue', network.chainId); return }
    switching.value = true
    try { await wallet.switchNetwork(network.chainId) } catch (error) { feedback.notify(error) }
    finally { switching.value = false }
  },
})))
</script>
<template>
  <UDropdownMenu :items="items" :modal="false" :content="{ align: 'end', ...content }" :ui="{ content: ['network-options', !props.matchTriggerWidth && 'network-options-expanded'] }">
    <UButton ref="trigger" variant="outline" color="neutral" trailing-icon="i-pact-caret-down" :loading="switching" class="network-trigger" :aria-label="t('wallet.switchNetwork')">
      <img v-if="currentNetwork?.icon" :src="currentNetwork.icon" alt="" width="24" height="24">
      <SiteIcon v-else name="globe" />
      <span>{{ currentNetwork?.name || t('wallet.chain', { id: currentChainId }) }}</span>
    </UButton>
  </UDropdownMenu>
</template>
