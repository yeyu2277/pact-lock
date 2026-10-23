<script setup>
import { formatAmount, shortenAddress, shortenOrderId } from '~/utils/format.js'
import { roleOf, roleFunding, claimable } from '~/contracts/model.js'
import { pendingTransactions, forgetPending, indexOwnReceipt } from '~/contracts/pending.js'
import { loadIndex } from '~/contracts/indexer.js'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const access = useDapp()
const account = useAccountOrders(access)
const { store, orders } = account
const feedback = useAppFeedback()
const tab = ref('all'), page = ref(1), clearOpen = ref(false), pending = ref([]), checking = ref('')
const rangeOpen = ref(false), rangeMode = ref('custom'), startBlock = ref(''), rangeError = ref('')
const scanFrom = computed(() => store.index?.scanFrom ?? access.network.value?.pactLock.deploymentBlock)
function openRange(mode) {
  rangeMode.value = mode; startBlock.value = String(scanFrom.value ?? ''); rangeError.value = ''; rangeOpen.value = true
}
async function saveRange() {
  if (!access.ready.value || store.settingRange) return
  rangeError.value = ''
  if (rangeMode.value === 'custom' && (!/^\d+$/.test(startBlock.value.trim()) || !Number.isSafeInteger(Number(startBlock.value)) || Number(startBlock.value) < access.network.value.pactLock.deploymentBlock)) {
    rangeError.value = t('errors.INVALID_SCAN_BLOCK'); return
  }
  try {
    const index = await account.setStart({ latest: rangeMode.value === 'latest', startBlock: startBlock.value.trim() })
    if (!index) return
    rangeOpen.value = false
    feedback.success(t('account.rangeSaved'))
  } catch (error) { rangeError.value = feedback.message(error) }
}
watch(access.key, () => { rangeOpen.value = false; clearOpen.value = false })
const filtered = computed(() => orders.value.filter(record => tab.value === 'all' || record[tab.value]))
const visible = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20))
const columns = computed(() => [
  { accessorKey: 'id', header: t('common.id') }, { accessorKey: 'roleLabel', header: t('account.role') },
  { accessorKey: 'participation', header: t('account.participation') }, { id: 'status', header: t('account.status') },
  { accessorKey: 'fundingLabel', header: t('account.funding') }, { accessorKey: 'updated', header: t('common.updated') }, { id: 'actions', header: t('account.operations') },
])
function timeLabel(timestamp) {
  if (!timestamp) return t('common.never')
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  return minutes < 1 ? t('common.now') : minutes < 60 ? t('common.minutes', { count: minutes }) : new Date(timestamp).toLocaleString(locale.value)
}
const rows = computed(() => visible.value.map(record => {
  const order = store.snapshots[record.id.toLowerCase()]
  const role = order ? roleOf(order, access.wallet.address.value) : null
  const amount = order ? claimable(order, access.wallet.address.value) : 0n
  const funding = order && role ? roleFunding(order, role) : null
  return {
    ...record, order, roleLabel: role ? t('common.' + role) : '—',
    participation: t(record.created ? 'account.created' : 'account.accepted'),
    fundingLabel: order ? t(amount > 0n ? 'account.claimable' : 'account.funded') + ' ' + formatAmount(amount > 0n ? amount : funding, order.token.decimals) + ' ' + order.token.symbol : '—',
    claimable: amount > 0n, updated: timeLabel(order?.updatedAt),
  }
}))
const syncTitle = computed(() => t('account.' + ({ scanning: 'scanning', paused: 'paused', complete: 'complete', waiting: 'waiting', error: 'error', idle: 'idle' }[store.phase] || 'idle')))
const progress = computed(() => {
  if (!store.index?.target || !access.network.value) return 0
  const first = scanFrom.value - 1
  const total = store.index.target - first
  return total <= 0 ? 100 : Math.min(100, Math.max(0, (store.index.cursor - first) / total * 100))
})
watch(tab, () => { page.value = 1 })
watch(() => filtered.value.length, () => { if ((page.value - 1) * 20 >= filtered.value.length) page.value = 1 })
watch([access.key, access.ready, () => visible.value.map(record => record.id).join(',')], () => account.scheduleVisible(visible.value.map(record => record.id)), { immediate: true, flush: 'sync' })
let visibleTimer
function refreshVisible() {
  if (!access.ready.value || document.hidden) return
  account.scheduleVisible(visible.value.map(record => record.id))
}
onMounted(() => {
  visibleTimer = setInterval(refreshVisible, 60000)
  document.addEventListener('visibilitychange', refreshVisible)
  window.addEventListener('focus', refreshVisible)
})
onScopeDispose(() => {
  clearInterval(visibleTimer)
  if (import.meta.client) {
    document.removeEventListener('visibilitychange', refreshVisible)
    window.removeEventListener('focus', refreshVisible)
  }
})
let pendingGeneration = 0
async function loadPending() {
  const request = ++pendingGeneration
  pending.value = []
  if (!access.ready.value || !import.meta.client) return
  const records = await pendingTransactions(access.network.value, access.wallet.address.value)
  if (request === pendingGeneration) pending.value = records
}
watch([access.ready, access.key], loadPending, { immediate: true })
async function checkPending(record) {
  checking.value = record.hash
  const key = access.key.value
  try {
    const client = access.client()
    const receipt = await client.provider.getTransactionReceipt(record.hash)
    if (key !== access.key.value) return
    if (!receipt) { feedback.success(t('tx.pendingHint')); return }
    await forgetPending(client.network, access.wallet.address.value, record.hash)
    await loadPending()
    if (receipt.status !== 1) { feedback.notify({ code: 'PRECHECK_FAILED' }); return }
    await indexOwnReceipt(client.network, access.wallet.address.value, receipt)
    store.index = await loadIndex(client.network, access.wallet.address.value)
    if (record.orderId) await account.refresh(record.orderId)
    feedback.success(t('tx.success'))
  } catch (error) { feedback.notify(error) }
  finally { checking.value = '' }
}
async function clear() {
  try { await account.clear(); clearOpen.value = false; feedback.success(t('account.clearSuccess')) }
  catch (error) { feedback.notify(error) }
}
async function refresh(id) { try { await account.refresh(id) } catch (error) { feedback.notify(error) } }
const orderLink = id => localePath('/orders/' + access.chainId.value + '/' + id)
usePactSeo('account', { privatePage: true })
</script>
<template>
  <div class="page-shell account-page">
    <div class="page-heading"><h1>{{ t('account.title') }}</h1><p class="account-wallet">{{ t('account.wallet') }} {{ shortenAddress(access.wallet.address.value) }}<CopyButton v-if="access.wallet.address.value" :value="access.wallet.address.value" /><span v-if="access.network.value"><img :src="access.network.value.icon" alt="" width="24" height="24">{{ access.network.value.name }}</span></p></div>
    <WalletGate>
      <section class="sync-panel">
        <SiteIcon name="database" class="sync-symbol" />
        <div class="sync-progress"><h2>{{ syncTitle }}</h2><UProgress :model-value="progress" :max="100" /><p>{{ t('account.progress', { current: store.index?.cursor ?? '—', target: store.index?.target ?? '—' }) }}</p></div>
        <div class="sync-controls"><div>
          <UButton v-if="store.syncing" icon="i-pact-pause" @click="account.pause">{{ t('account.pause') }}</UButton>
          <UButton v-else icon="i-pact-arrows-clockwise" :disabled="!store.index || store.settingRange" @click="account.sync">{{ t(store.phase === 'paused' ? 'account.resume' : 'account.sync') }}</UButton>
          <UButton color="neutral" variant="ghost" icon="i-pact-trash" :disabled="!store.index || store.settingRange" @click="clearOpen = true">{{ t('account.clear') }}</UButton>
        </div><p>{{ t('account.cache') }}</p><small v-if="store.syncing">{{ t('account.partial') }}</small></div>
      </section>
      <section class="sync-range-panel" :aria-label="t('account.rangeTitle')">
        <div class="sync-range-details"><span>{{ t('account.deploymentBlock') }} <strong>{{ access.network.value?.pactLock.deploymentBlock ?? '—' }}</strong></span><span>{{ t('account.scanFrom') }} <strong>{{ scanFrom ?? '—' }}</strong></span><p>{{ t('account.manualHint') }}</p></div>
        <div class="sync-range-actions"><UButton color="neutral" variant="outline" :disabled="!store.index || store.syncing || store.settingRange" @click="openRange('custom')">{{ t('account.customStart') }}</UButton><UButton color="neutral" variant="outline" icon="i-pact-arrow-right" :disabled="!store.index || store.syncing || store.settingRange" @click="openRange('latest')">{{ t('account.skipHistory') }}</UButton></div>
      </section>
      <p v-if="store.volatile" class="notice" role="status">{{ t('account.volatile') }}</p>
      <p v-if="store.error" class="form-error" role="alert">{{ t('errors.' + store.error) }}</p>
      <section v-if="pending.length" class="pending-transactions">
        <h2>{{ t('tx.pendingResume') }}</h2><div v-for="record in pending" :key="record.hash" class="pending-row"><a :href="access.network.value.explorerUrl + '/tx/' + record.hash" target="_blank" rel="noopener noreferrer">{{ shortenAddress(record.hash, 10, 6) }}<SiteIcon name="arrow-square-out" /></a><span>{{ t(record.method === 'approve' ? 'tx.approval' : 'tx.pending') }}</span><UButton size="sm" variant="outline" color="neutral" :loading="checking === record.hash" @click="checkPending(record)">{{ t('tx.recheck') }}</UButton></div>
      </section>
      <div class="account-tabs" role="tablist" :aria-label="t('nav.account')"><button v-for="key in ['all', 'created', 'accepted']" :key="key" role="tab" :aria-selected="tab === key" :class="{ active: tab === key }" @click="tab = key">{{ t('account.' + key) }} <span>{{ key === 'all' ? orders.length : orders.filter(order => order[key]).length }}</span></button></div>
      <div class="account-table">
        <UTable :data="rows" :columns="columns" :ui="{ root: 'order-table', th: 'text-sm', td: 'py-5' }">
          <template #id-cell="{ row }"><div class="table-id"><NuxtLink :to="orderLink(row.original.id)">{{ shortenOrderId(row.original.id) }}</NuxtLink><CopyButton :value="row.original.id" /></div></template>
          <template #status-cell="{ row }"><OrderStatus v-if="row.original.order" :state="row.original.order.state" :provisional="row.original.unfinalized" /><span v-else>—</span></template>
          <template #actions-cell="{ row }"><div class="row-actions"><UButton :to="orderLink(row.original.id)" color="neutral" variant="outline" size="sm" trailing-icon="i-pact-arrow-right">{{ t(row.original.claimable ? 'account.viewClaim' : 'common.view') }}</UButton><UButton color="neutral" variant="outline" size="sm" icon="i-pact-arrows-clockwise" :loading="store.refreshing[row.original.id]" :aria-label="t('order.refresh')" @click="refresh(row.original.id)" /></div></template>
          <template #empty><EmptyState image="account-ledger" :title="t('account.emptyTitle')" :description="t('account.emptyDescription')" /></template>
        </UTable>
      </div>
      <div class="account-mobile-list">
        <EmptyState v-if="!rows.length" image="account-ledger" :title="t('account.emptyTitle')" :description="t('account.emptyDescription')" />
        <article v-for="row in rows" :key="row.id" class="mobile-order-row">
          <div class="mobile-order-top"><strong>{{ shortenOrderId(row.id) }}</strong><CopyButton :value="row.id" /><OrderStatus v-if="row.order" :state="row.order.state" :provisional="row.unfinalized" /></div>
          <p>{{ row.roleLabel }} · {{ row.participation }}</p><p class="mobile-order-funding">{{ row.fundingLabel }}</p>
          <div class="mobile-order-bottom"><small>{{ row.updated }}</small><UButton :to="orderLink(row.id)" color="neutral" variant="outline" trailing-icon="i-pact-arrow-right">{{ t(row.claimable ? 'account.viewClaim' : 'common.view') }}</UButton><UButton color="neutral" variant="outline" icon="i-pact-arrows-clockwise" :loading="store.refreshing[row.id]" :aria-label="t('order.refresh')" @click="refresh(row.id)" /></div>
        </article>
      </div>
      <div class="account-pagination"><span>{{ t('account.count', { count: filtered.length }) }}</span><UPagination v-model:page="page" :items-per-page="20" :total="filtered.length" :ui="{ first: 'hidden', last: 'hidden' }" /></div>
      <div class="account-bottom-note"><img src="/images/pact/account-ledger.png" alt="" width="260" height="174" loading="lazy"><p>{{ t('account.indexHint') }}</p></div>
    </WalletGate>
    <UModal v-model:open="clearOpen" :title="t('account.clearTitle')" :description="t('account.clearDescription')" :dismissible="!store.settingRange"><template #footer><UButton color="neutral" variant="outline" :disabled="store.settingRange" @click="clearOpen = false">{{ t('common.back') }}</UButton><UButton color="error" :loading="store.settingRange" @click="clear">{{ t('account.clear') }}</UButton></template></UModal>
    <UModal v-model:open="rangeOpen" :title="t(rangeMode === 'latest' ? 'account.skipTitle' : 'account.rangeTitle')" :description="t(rangeMode === 'latest' ? 'account.skipDescription' : 'account.rangeDescription')" :dismissible="!store.settingRange">
      <template #body><form id="scan-range-form" class="sync-range-form" @submit.prevent="saveRange">
        <UFormField v-if="rangeMode === 'custom'" :label="t('account.startBlock')" :description="t('account.startHelp', { block: access.network.value?.pactLock.deploymentBlock ?? '—' })"><UInput v-model="startBlock" inputmode="numeric" class="w-full" :disabled="store.settingRange" autocomplete="off" /></UFormField>
        <p class="sync-range-warning">{{ t('account.rangeWarning') }}</p><p v-if="rangeError" class="form-error" role="alert">{{ rangeError }}</p>
      </form></template>
      <template #footer><UButton color="neutral" variant="outline" :disabled="store.settingRange" @click="rangeOpen = false">{{ t('common.back') }}</UButton><UButton type="submit" form="scan-range-form" :loading="store.settingRange">{{ t('account.saveRange') }}</UButton></template>
    </UModal>
  </div>
</template>
