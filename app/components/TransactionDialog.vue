<script setup>
import { formatAmount, shortenAddress } from '~/utils/format.js'
const { deploymentById } = usePactConfig()
const { t } = useI18n()
const tx = useTransaction()
const { state, busy } = tx
const phase = computed(() => state.value.phase)
const titles = computed(() => t('tx.' + (phase.value === 'unconfirmed' ? 'pending' : phase.value === 'idle' ? 'title' : phase.value)))
const explorer = computed(() => deploymentById(state.value.summary?.chainId)?.explorerUrl)
const amount = computed(() => formatAmount(state.value.summary?.claimAmount ?? state.value.summary?.amount, state.value.summary?.decimals))
</script>
<template>
  <UModal :open="state.open" :title="t(state.action === 'claim' ? 'order.claim' : 'tx.title')" :description="titles" :dismissible="!busy" :close="{ 'aria-label': t(busy ? 'tx.stopWaiting' : 'common.close') }" :ui="{ content: 'transaction-modal max-w-lg' }" @update:open="value => { if (!value) tx.close() }">
    <template #body>
      <div class="transaction-state" :class="'phase-' + phase">
        <SiteIcon :name="['success', 'approved'].includes(phase) ? 'check-circle' : phase === 'error' || phase === 'unconfirmed' ? 'warning-circle' : ['approval', 'ready'].includes(phase) ? 'wallet' : 'spinner-gap'" :class="{ 'animate-spin': busy }" />
        <h3>{{ titles }}</h3>
        <p v-if="phase === 'approval'">{{ t('tx.approvalHint') }}</p>
        <p v-if="phase === 'approved'">{{ t('tx.approvedHint') }}</p>
      </div>
      <TransactionProgress :phase="phase" :prepared="state.preflightPassed" />
      <dl v-if="state.summary" class="transaction-summary">
        <div><dt>{{ t('common.network') }}</dt><dd>{{ state.summary.network }}</dd></div>
        <div v-if="state.orderId"><dt>{{ t('tx.order') }}</dt><dd>{{ shortenAddress(state.orderId, 8, 6) }}<CopyButton :value="state.orderId" /></dd></div>
        <div v-if="state.summary.claimAmount !== null || BigInt(state.summary.amount || '0') > 0n"><dt>{{ t(state.summary.claimAmount !== null ? 'tx.claim' : 'tx.amount') }}</dt><dd class="accent">{{ amount }} {{ state.summary.symbol }}</dd></div>
        <div v-if="state.summary.recipient"><dt>{{ t('tx.recipient') }}</dt><dd>{{ shortenAddress(state.summary.recipient) }}<CopyButton :value="state.summary.recipient" /></dd></div>
      </dl>
      <p v-if="phase === 'ready'" class="notice"><SiteIcon name="info" />{{ t('tx.hint') }}</p>
      <p v-if="phase === 'unconfirmed'" class="notice">{{ t('tx.pendingHint') }}</p>
      <p v-if="busy" class="notice">{{ t(phase === 'signing' ? 'tx.walletWaitHint' : phase === 'pending' ? 'tx.pendingCloseHint' : 'tx.stopWaitHint') }}</p>
      <p v-if="state.error" class="form-error" role="alert">{{ t('errors.' + state.error) }}</p>
      <a v-if="state.hash && explorer" class="transaction-link" :href="explorer + '/tx/' + state.hash" target="_blank" rel="noopener noreferrer">{{ t('order.viewTransaction') }}<SiteIcon name="arrow-square-out" /></a>
    </template>
    <template #footer>
      <div class="transaction-actions">
        <UButton color="neutral" variant="outline" @click="tx.close">{{ t(busy ? 'tx.stopWaiting' : phase === 'success' ? 'tx.done' : 'common.close') }}</UButton>
        <UButton v-if="['ready', 'approval', 'approved'].includes(phase)" @click="tx.proceed">{{ t(phase === 'approval' ? 'tx.approve' : 'tx.continue') }}</UButton>
        <UButton v-else-if="phase === 'unconfirmed'" @click="tx.recheck">{{ t('tx.recheck') }}</UButton>
        <UButton v-else-if="busy" :loading="true" disabled>{{ t('tx.waiting') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
