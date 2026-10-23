<script setup>
import { shortenAddress } from '~/utils/format.js'
import { copyText } from '~/utils/clipboard.js'
const props = defineProps({ inDrawer: Boolean })
const emit = defineEmits(['manage-wallet'])
const { t } = useI18n()
const localePath = useLocalePath()
const wallet = useWalletSession()
const feedback = useAppFeedback()
const copied = ref(false)
let timer
function manageWallet() {
  if (props.inDrawer) emit('manage-wallet')
  else wallet.connect().catch(feedback.notify)
}
const menu = computed(() => [
  [{ label: t('nav.account'), icon: 'i-pact-user-circle', to: localePath('/account') }],
  [
    { label: t('wallet.copy'), icon: copied.value ? 'i-pact-check' : 'i-pact-copy', onSelect: async () => {
      try { await copyText(wallet.address.value); copied.value = true; clearTimeout(timer); timer = setTimeout(() => { copied.value = false }, 1500) }
      catch { feedback.notify({ code: 'COPY_FAILED' }) }
    } },
    ...(wallet.network.value ? [{ label: t('wallet.view'), icon: 'i-pact-arrow-square-out', to: wallet.network.value.explorerUrl + '/address/' + wallet.address.value, target: '_blank' }] : []),
    { label: t('wallet.account'), icon: 'i-pact-wallet', onSelect: manageWallet },
  ],
  [{ label: t('wallet.disconnect'), icon: 'i-pact-sign-out', color: 'error', onSelect: () => wallet.disconnect().catch(feedback.notify) }],
])
onBeforeUnmount(() => clearTimeout(timer))
</script>
<template>
  <div class="wallet-controls">
    <template v-if="wallet.connected.value">
      <NetworkMenu :match-trigger-width="inDrawer" />
      <UDropdownMenu :items="menu" :external-icon="false" :content="{ align: 'end' }" :ui="{ content: 'wallet-options min-w-60' }">
        <UButton color="neutral" variant="outline" icon="i-pact-wallet" trailing-icon="i-pact-caret-down" class="address-trigger" :title="wallet.address.value"><span class="wallet-address-label">{{ shortenAddress(wallet.address.value) }}</span></UButton>
      </UDropdownMenu>
    </template>
    <UButton v-else icon="i-pact-wallet" :loading="wallet.busy.value" class="connect-button" @click="wallet.connect().catch(feedback.notify)">{{ t('wallet.connect') }}</UButton>
  </div>
</template>
