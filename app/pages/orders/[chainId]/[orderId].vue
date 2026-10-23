<script setup>
import { ZeroAddress } from 'ethers'
import { formatAmount, shortenAddress, shortenOrderId, isOrderId, sameAddress, validAddress } from '~/utils/format.js'
import { orderActions, claimable, roleOf, roleFunding } from '~/contracts/model.js'
import { orderGuidance, participantStatus } from '~/contracts/presentation.js'

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const chainId = computed(() => Number(route.params.chainId) || -1)
const orderId = computed(() => String(route.params.orderId || ''))
const access = useDapp(chainId)
const recent = useRecentOrders(access)
const feedback = useAppFeedback()
const tx = useTransaction()
const order = ref(null), loading = ref(false), error = ref(''), agreed = ref(false), recipient = ref('')
const cancelOpen = ref(false)
let generation = 0
const actions = computed(() => order.value ? orderActions(order.value, access.wallet.address.value) : [])
const primaryAction = computed(() => actions.value.find(action => action !== 'cancelOrder'))
const role = computed(() => order.value ? roleOf(order.value, access.wallet.address.value) : null)
const terminal = computed(() => [4, 5].includes(Number(order.value?.state)))
const myClaim = computed(() => order.value ? claimable(order.value, access.wallet.address.value) : 0n)
const payout = computed(() => {
  if (!order.value || !role.value) return null
  if (terminal.value) return myClaim.value > 0n ? myClaim.value : null
  return role.value === 'payer' ? BigInt(order.value.payerDeposit) : BigInt(order.value.paymentAmount) + BigInt(order.value.payeeDeposit)
})
const participants = computed(() => ['payer', 'payee'].map(name => ({
  name, address: order.value?.[name] || '', me: sameAddress(order.value?.[name], access.wallet.address.value),
  exists: Boolean(order.value?.[name] && !sameAddress(order.value[name], ZeroAddress)),
  funding: order.value ? roleFunding(order.value, name) : null,
  status: participantStatus(order.value, name),
})))
const guidance = computed(() => orderGuidance(order.value, access.wallet.address.value))
const tokenExplorer = computed(() => order.value && !sameAddress(order.value.asset, ZeroAddress) && access.network.value?.explorerUrl ? access.network.value.explorerUrl + '/address/' + order.value.asset : '')
const actionLabels = { acceptOrder: 'order.accept', activateOrder: 'order.activate', confirmCompletion: 'order.confirm', claim: 'order.claim' }
const actionAgreement = computed(() => t({ acceptOrder: 'order.acceptAgreement', activateOrder: 'order.activateAgreement', confirmCompletion: 'order.confirmAgreement', claim: 'order.claimAgreement' }[primaryAction.value] || 'order.confirmAgreement'))
async function load(force = false) {
  const request = ++generation
  error.value = ''
  if (!access.ready.value || !import.meta.client) { order.value = null; return }
  if (!isOrderId(orderId.value)) { error.value = t('errors.INVALID_ORDER_ID'); return }
  loading.value = true
  try {
    const result = await access.client().getOrder(orderId.value, { force })
    if (request !== generation) return
    order.value = result
    await recent.remember(result)
  } catch (cause) { if (request === generation) error.value = feedback.message(cause) }
  finally { if (request === generation) loading.value = false }
}
watch([access.ready, access.key, orderId], () => {
  order.value = null; agreed.value = false; recipient.value = access.wallet.address.value
  load()
}, { immediate: true })
async function perform(method) {
  if (!method) return
  if (method !== 'cancelOrder' && !agreed.value) { feedback.notify({ code: 'AGREEMENT_REQUIRED' }); return }
  let address = recipient.value.trim()
  if (method === 'claim') {
    address = validAddress(address)
    if (!address || sameAddress(address, ZeroAddress) || sameAddress(address, access.network.value.pactLock.address)) { feedback.notify({ code: 'INVALID_ADDRESS' }); return }
  }
  cancelOpen.value = false
  try {
    await tx.prepare(access, { method, args: method === 'claim' ? [orderId.value, address] : [orderId.value], onSuccess: async () => { agreed.value = false; await load(true) } })
  } catch (cause) { feedback.notify(cause) }
}
async function share() {
  try { const { copyText } = await import('~/utils/clipboard.js'); await copyText(window.location.href); feedback.success(t('common.copied')) } catch (cause) { feedback.notify(cause) }
}
usePactSeo('order', { privatePage: true })
onScopeDispose(() => { generation++ })
</script>
<template>
  <div class="page-shell order-page">
    <div class="breadcrumb"><NuxtLink :to="localePath('/orders')">{{ t('nav.orders') }}</NuxtLink><span>/</span>{{ t('order.title') }}</div>
    <WalletGate :chain-id="chainId">
      <div class="order-heading">
        <div><div class="order-title-row"><h1>{{ t('order.title') }}</h1><OrderStatus v-if="order" :state="order.state" /></div>
          <div class="order-identity"><span>{{ t('common.id') }} {{ shortenOrderId(orderId) }}</span><CopyButton :value="orderId" /><span v-if="access.network.value" class="order-chain"><img :src="access.network.value.icon" width="22" height="22" alt="">{{ access.network.value.name }}</span></div>
        </div><div class="order-heading-actions"><UButton color="neutral" variant="outline" icon="i-pact-link" @click="share">{{ t('common.share') }}</UButton><UButton color="neutral" variant="outline" icon="i-pact-arrows-clockwise" :loading="loading" @click="load(true)">{{ t('common.refresh') }}</UButton></div>
      </div>
      <div v-if="error" class="order-read-error"><EmptyState :title="error" :description="t('order.notFound')" /><UButton @click="load(true)">{{ t('common.retry') }}</UButton></div>
      <template v-else>
        <OrderLifecycle :order="order" />
        <div class="order-detail-layout">
          <div class="order-information">
            <section class="order-funds"><div class="section-heading"><h2>{{ t('order.funds') }}</h2><span class="order-asset"><img v-if="order?.token?.icon" :src="order.token.icon" width="26" height="26" alt="">{{ order?.token?.symbol || '—' }}<span class="subtle-pill">{{ t(order && !sameAddress(order.designatedCounterparty, ZeroAddress) ? 'order.designated' : 'order.public') }}</span></span></div>
              <div v-if="order" class="order-asset-identity">
                <div class="order-asset-label"><span>{{ t(sameAddress(order.asset, ZeroAddress) ? 'common.native' : 'order.tokenContract') }}</span><span>{{ access.network.value?.name }}</span></div>
                <p v-if="sameAddress(order.asset, ZeroAddress)" class="order-asset-hint">{{ t('order.nativeAssetHint') }}</p>
                <template v-else>
                  <div class="order-token-contract"><a v-if="tokenExplorer" :href="tokenExplorer" target="_blank" rel="noopener noreferrer">{{ order.asset }}</a><span v-else>{{ order.asset }}</span><CopyButton :value="order.asset" /></div>
                  <p class="order-asset-hint">{{ t('order.assetIdentityHint') }}</p>
                </template>
              </div>
              <dl class="order-money-grid"><div v-for="key in ['paymentAmount', 'payerDeposit', 'payeeDeposit', 'lockedAmount']" :key="key"><dt>{{ t({ paymentAmount: 'order.payment', payerDeposit: 'order.payerDeposit', payeeDeposit: 'order.payeeDeposit', lockedAmount: 'order.locked' }[key]) }}</dt><dd>{{ formatAmount(order?.[key], order?.token?.decimals) }} {{ order?.token?.symbol }}</dd></div></dl>
            </section>
            <section class="order-parties"><h2>{{ t('order.parties') }}</h2>
              <div v-for="participant in participants" :key="participant.name" class="participant-row">
                <div class="participant-identity"><span class="participant-avatar"><img :src="'/images/pact/' + (participant.name === 'payer' ? 'empty-search' : 'confirmation-helper') + '.png'" alt="" width="100" height="100" loading="lazy"></span><div><strong :class="{ accent: participant.me }">{{ t('common.' + participant.name) }}<template v-if="participant.me"> · {{ t('common.me') }}</template></strong><span class="participant-address"><span class="participant-address-text" :title="participant.exists ? participant.address : undefined">{{ participant.exists ? shortenAddress(participant.address) : '—' }}</span><CopyButton v-if="participant.exists" :value="participant.address" /></span></div></div>
                <div class="participant-funding"><small>{{ t('order.funded') }}</small><strong>{{ participant.exists ? formatAmount(participant.funding, order?.token?.decimals) : '—' }} {{ order?.token?.symbol }}</strong></div>
                <span class="confirmation-pill" :class="{ confirmed: ['order.confirmed', 'order.claimed'].includes(participant.status) }">{{ t(participant.status) }}</span>
              </div>
              <p v-if="order && !sameAddress(order.designatedCounterparty, ZeroAddress)" class="designated-note">{{ t('order.counterparty') }}: {{ shortenAddress(order.designatedCounterparty) }}<CopyButton :value="order.designatedCounterparty" /></p>
            </section>
          </div>
          <aside class="order-action-panel">
            <h2>{{ t(guidance.title) }}</h2>
            <p v-if="guidance.hint">{{ t(guidance.hint) }}</p>
            <div v-if="payout !== null" class="order-payout"><span>{{ t(terminal ? 'order.claimable' : 'order.expected') }}</span><strong>{{ formatAmount(payout, order?.token?.decimals) }} {{ order?.token?.symbol }}</strong><img src="/images/pact/confirmation-helper.png" alt="" width="130" height="130" loading="lazy"></div>
            <p v-if="order && !role && primaryAction !== 'acceptOrder'" class="muted">{{ t('order.outsider') }}</p>
            <UFormField v-if="primaryAction === 'claim'" :label="t('order.recipient')" class="recipient-field"><UInput v-model="recipient" class="w-full" spellcheck="false" autocomplete="off" :placeholder="t('common.address')" /><p class="field-hint">{{ t('order.recipientHint') }}</p></UFormField>
            <template v-if="primaryAction"><UCheckbox v-model="agreed" :label="actionAgreement" class="action-agreement" /><UButton size="xl" class="order-primary" :loading="tx.busy.value" @click="perform(primaryAction)">{{ t(actionLabels[primaryAction]) }}</UButton><p class="preflight-caption">{{ t('create.preflight') }}</p></template>
            <p v-else-if="terminal && role" class="notice">{{ t(order?.[role + 'Claimed'] ? 'order.alreadyClaimed' : 'order.noClaim') }}</p>
            <UButton v-if="actions.includes('cancelOrder')" color="error" variant="outline" class="cancel-order-button" @click="cancelOpen = true">{{ t('order.cancel') }}</UButton>
            <p v-if="guidance.boundary" class="order-boundary"><SiteIcon name="info" />{{ t(guidance.boundary) }}</p>
            <p v-if="order?.updatedAt" class="updated-note">{{ t('order.refreshHint') }} {{ new Date(order.updatedAt).toLocaleTimeString() }}</p>
          </aside>
        </div>
      </template>
    </WalletGate>
    <UModal v-model:open="cancelOpen" :title="t('order.cancelTitle')" :description="t('order.cancelAgreement')"><template #footer><UButton color="neutral" variant="outline" @click="cancelOpen = false">{{ t('common.back') }}</UButton><UButton color="error" @click="perform('cancelOrder')">{{ t('order.cancel') }}</UButton></template></UModal>
  </div>
</template>
