import { readRecord, updateRecord, namespace } from '~/contracts/storage.js'

export function useRecentOrders(access) {
  const records = ref([])
  let generation = 0
  const key = () => namespace(access.network.value, access.wallet.address.value) + ':recent'
  const current = (request, scope) => request === generation && access.ready.value && key() === scope
  watch([access.ready, access.key], async () => {
    const request = ++generation
    records.value = []
    if (!access.ready.value || !import.meta.client) return
    const scope = key()
    const saved = await readRecord(scope)
    if (current(request, scope)) records.value = saved || []
  }, { immediate: true })
  async function remember(order) {
    access.guard()
    const scope = key(), request = ++generation
    const record = { id: order.id.toLowerCase(), chainId: order.chainId, updatedAt: Date.now(), state: order.state, symbol: order.token.symbol }
    // Merge against persistent history in one transaction, never an unloaded or stale page list.
    const saved = await updateRecord(scope, history => [record, ...(history || []).filter(item => item.id.toLowerCase() !== record.id)].slice(0, 10))
    if (current(request, scope)) records.value = saved
  }
  async function clear() {
    access.guard()
    const scope = key(), request = ++generation
    records.value = []
    const saved = await updateRecord(scope, () => [])
    if (current(request, scope)) records.value = saved
  }
  onScopeDispose(() => { generation++ })
  return { records, remember, clear }
}
