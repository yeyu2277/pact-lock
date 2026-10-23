<script setup>
const props = defineProps({ chainId: { type: [Number, String], default: null } })
const { t } = useI18n()
const localePath = useLocalePath()
const access = useDapp(() => props.chainId)
const feedback = useAppFeedback()
const { ready, reason, network } = access
const working = ref(false)
async function unlock() {
  working.value = true
  try {
    if (reason.value === 'connect') await access.wallet.connect()
    else await access.wallet.switchNetwork(network.value?.chainId || access.defaultNetwork.chainId)
  } catch (error) { feedback.notify(error) }
  finally { working.value = false }
}
</script>
<template>
  <div class="gated-region" :class="{ 'is-locked': !ready }" :data-access="ready ? 'ready' : reason">
    <div class="gated-content" :inert="!ready || undefined" :aria-hidden="!ready || undefined"><slot /></div>
    <section v-if="!ready" class="gate-overlay" :aria-label="t(reason === 'connect' ? 'gate.connectTitle' : reason === 'undeployed' ? 'gate.undeployedTitle' : 'gate.networkTitle')">
      <div class="gate-panel">
        <div class="gate-symbol"><SiteIcon :name="reason === 'connect' ? 'wallet' : 'globe'" /></div>
        <h2>{{ t(reason === 'connect' ? 'gate.connectTitle' : reason === 'undeployed' ? 'gate.undeployedTitle' : 'gate.networkTitle') }}</h2>
        <p>{{ reason === 'connect' ? t('gate.connectDescription') : reason === 'undeployed' ? t('gate.undeployedDescription') : chainId && network ? t('gate.mismatch', { network: network.name }) : t('gate.networkDescription') }}</p>
        <UButton v-if="reason !== 'undeployed'" size="xl" :icon="reason === 'connect' ? 'i-pact-wallet' : 'i-pact-arrows-clockwise'" :loading="working" @click="unlock">{{ reason === 'connect' ? t('wallet.connect') : t('wallet.switchTo', { network: network?.name || access.defaultNetwork.name }) }}</UButton>
        <UButton v-else :to="localePath('/orders')" size="lg">{{ t('nav.orders') }}</UButton>
        <span class="gate-caption">{{ t('gate.secure') }}</span>
      </div>
    </section>
  </div>
</template>
