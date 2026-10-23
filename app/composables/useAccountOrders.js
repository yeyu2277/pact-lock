import { loadIndex, clearIndex, indexedOrders, scanOrders, setScanStart } from '~/contracts/indexer.js'
import { readRecord, writeRecord, deleteRecords, namespace, storageIsVolatile } from '~/contracts/storage.js'
import { decodeError } from '~/contracts/errors.js'
import { appError } from '~/contracts/errors.js'
import { allFundsClaimed } from '~/contracts/presentation.js'

export function useAccountOrders(access) {
  const store = useAccountStore()
  let controller, activeScan, generation = 0, scanRun = 0
  let visibleTimer, visibleRun = 0, activeVisibleKey = null
  const orders = computed(() => store.index ? indexedOrders(store.index) : [])
  const scope = () => namespace(access.network.value, access.wallet.address.value)
  function pause() { scanRun++; controller?.abort(); store.syncing = false; if (store.phase === 'scanning') store.phase = 'paused' }
  async function sync() {
    if (!access.ready.value || !store.index || store.syncing || store.settingRange) return
    const request = generation, run = ++scanRun
    const currentScope = scope(), client = access.client(), address = access.wallet.address.value
    store.syncing = true; store.phase = 'scanning'; store.error = ''
    try {
      await activeScan?.catch(() => {})
      if (request !== generation || run !== scanRun) return
      controller = new AbortController()
      activeScan = scanOrders(client, address, {
        signal: controller.signal,
        initial: store.index,
        onProgress: index => { if (request === generation && run === scanRun && store.scope === currentScope) store.index = index },
      })
      const index = await activeScan
      if (request === generation && run === scanRun) store.phase = index.cursor > index.target ? 'waiting' : 'complete'
    } catch (error) {
      if (request !== generation || run !== scanRun) return
      if (decodeError(error) === 'SCAN_PAUSED') store.phase = 'paused'
      else { store.phase = 'error'; store.error = decodeError(error) }
    } finally {
      if (request === generation && run === scanRun) { store.syncing = false; store.volatile = storageIsVolatile() }
    }
  }
  async function refresh(id, force = true) {
    if (!access.ready.value || store.refreshing[id]) return
    const saved = store.snapshots[id.toLowerCase()]
    if (!force && allFundsClaimed(saved)) return saved
    const request = generation, currentScope = scope()
    store.refreshing[id] = true
    try {
      const order = await access.client().getOrder(id, { force })
      if (request !== generation || store.scope !== currentScope) return
      store.snapshot(order)
      await writeRecord(currentScope + ':snapshot:' + id.toLowerCase(), order)
      return order
    } finally { if (request === generation) delete store.refreshing[id] }
  }
  function cancelVisible() {
    clearTimeout(visibleTimer); visibleTimer = undefined
    visibleRun++; activeVisibleKey = null
  }
  function scheduleVisible(ids) {
    const key = [generation, ...ids].join(':')
    // Focus and timer events must not restart an existing refresh of this page.
    if (key === activeVisibleKey) return
    cancelVisible()
    if (!import.meta.client || !access.ready.value || !ids.length || document.hidden) return
    const run = visibleRun, pending = [...ids]
    visibleTimer = setTimeout(() => {
      visibleTimer = undefined
      if (run === visibleRun) void hydrateVisible(pending)
    }, 300)
  }
  async function hydrateVisible(ids) {
    cancelVisible()
    if (!access.ready.value) return
    const request = generation, run = visibleRun, currentScope = scope()
    activeVisibleKey = [generation, ...ids].join(':')
    const current = () => run === visibleRun && request === generation && access.ready.value && currentScope === scope() && !(typeof document !== 'undefined' && document.hidden)
    try {
      for (const id of ids) {
        if (!current()) return
        if (!store.snapshots[id.toLowerCase()]) {
          const saved = await readRecord(currentScope + ':snapshot:' + id.toLowerCase())
          if (!current()) return
          if (saved) store.snapshot(saved)
        }
        if (!store.snapshots[id.toLowerCase()] || Date.now() - store.snapshots[id.toLowerCase()].updatedAt > 60000) {
          try { await refresh(id, false) } catch (error) {
            if (current()) store.error = decodeError(error)
          }
        }
      }
    } catch (error) { if (current()) store.error = decodeError(error) }
    finally { if (run === visibleRun) activeVisibleKey = null }
  }
  async function clear() {
    if (!access.ready.value || store.settingRange) return
    const currentScope = scope(), client = access.client(), address = access.wallet.address.value
    pause(); cancelVisible()
    const request = ++generation
    store.settingRange = true; store.refreshing = {}
    try {
      await activeScan?.catch(() => {})
      if (request !== generation || !access.ready.value || currentScope !== scope()) throw appError('SESSION_CHANGED')
      await clearIndex(client.network, address)
      await deleteRecords(currentScope + ':snapshot:')
      const index = await loadIndex(client.network, address)
      if (request !== generation) return
      store.index = index
      store.snapshots = {}
      store.phase = 'idle'
    } finally { if (request === generation) store.settingRange = false }
  }
  async function setStart(options) {
    if (!access.ready.value || !store.index || store.settingRange) return
    const currentScope = scope(), key = access.key.value, client = access.client(), address = access.wallet.address.value
    pause(); cancelVisible()
    const request = ++generation
    store.settingRange = true; store.refreshing = {}
    const guard = () => {
      client.guard()
      if (request !== generation || key !== access.key.value || currentScope !== scope()) throw appError('SESSION_CHANGED')
    }
    try {
      await activeScan?.catch(() => {})
      guard()
      const index = await setScanStart({ ...client, guard }, address, options)
      guard()
      store.index = index; store.phase = 'idle'; store.error = ''; store.volatile = storageIsVolatile()
      return index
    } finally { if (request === generation) store.settingRange = false }
  }
  watch([access.ready, access.key], async () => {
    pause(); cancelVisible(); const request = ++generation
    if (!access.ready.value || !import.meta.client) { store.reset(''); return }
    const currentScope = scope()
    store.reset(currentScope)
    const index = await loadIndex(access.network.value, access.wallet.address.value)
    if (request !== generation) return
    store.index = index; store.volatile = storageIsVolatile()
  }, { immediate: true })
  if (import.meta.client) {
    const visibility = () => { if (document.hidden) { pause(); cancelVisible() } }
    onMounted(() => document.addEventListener('visibilitychange', visibility))
    onScopeDispose(() => { pause(); cancelVisible(); generation++; document.removeEventListener('visibilitychange', visibility) })
  }
  return { store, orders, sync, pause, refresh, hydrateVisible, scheduleVisible, clear, setStart }
}
