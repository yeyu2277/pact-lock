import { zeroPadValue } from 'ethers'
import { pactInterface } from './client.js'
import { namespace, readRecord, updateRecord, deleteRecord } from './storage.js'
import { appError } from './errors.js'
import { readLogChunk } from './logs.js'

const created = pactInterface.getEvent('OrderCreated').topicHash
const accepted = pactInterface.getEvent('OrderAccepted').topicHash
export const indexKey = (network, address) => namespace(network, address) + ':index'
export const emptyIndex = network => ({ scanFrom: network.pactLock.deploymentBlock, cursor: network.pactLock.deploymentBlock - 1, cursorHash: null, logs: [], target: null })
export const loadIndex = async (network, address) => await readRecord(indexKey(network, address)) || emptyIndex(network)
export const clearIndex = (network, address) => deleteRecord(indexKey(network, address))
export async function setScanStart(client, address, { startBlock, latest = false } = {}) {
  const { network, provider, guard } = client
  guard()
  const deployment = network.pactLock.deploymentBlock
  if (!latest && (!/^\d+$/.test(String(startBlock)) || !Number.isSafeInteger(Number(startBlock)) || Number(startBlock) < deployment)) throw appError('INVALID_SCAN_BLOCK')
  const head = await provider.getBlock('latest')
  guard()
  if (!head || !Number.isSafeInteger(head.number) || !head.hash) throw appError('RPC_ERROR')
  const scanFrom = latest ? head.number + 1 : Number(startBlock)
  if (scanFrom < deployment || scanFrom > head.number + 1) throw appError('INVALID_SCAN_BLOCK')
  const cursor = scanFrom - 1
  const checkpoint = cursor === head.number ? head : cursor >= deployment ? await provider.getBlock(cursor) : null
  guard()
  if (cursor >= deployment && !checkpoint?.hash) throw appError('RPC_ERROR')
  return updateRecord(indexKey(network, address), saved => ({
    ...(saved || emptyIndex(network)), scanFrom, cursor, cursorHash: checkpoint?.hash || null, target: null,
  }))
}
export function indexedOrders(index) {
  const orders = new Map()
  for (const log of [...index.logs].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)) {
    const record = orders.get(log.orderId) || { id: log.orderId, created: false, accepted: false, blockNumber: log.blockNumber }
    record[log.type] = true
    record.unfinalized ||= Boolean(log.unfinalized)
    record.blockNumber = Math.max(record.blockNumber, log.blockNumber)
    orders.set(log.orderId, record)
  }
  return [...orders.values()].sort((a, b) => b.blockNumber - a.blockNumber)
}
export async function scanOrders(client, address, { signal, onProgress = () => {}, initial } = {}) {
  const { network, provider, guard } = client
  const assert = () => {
    guard()
    if (signal?.aborted || (typeof document !== 'undefined' && document.hidden)) throw appError('SCAN_PAUSED')
  }
  assert()
  let index = initial || await loadIndex(network, address)
  let target
  try { target = (await provider.getBlock('finalized'))?.number } catch (error) { assert() }
  if (!Number.isInteger(target)) target = Math.max(network.pactLock.deploymentBlock - 1, await provider.getBlockNumber() - network.rpcPolicy.confirmations)
  assert()
  const overlap = network.rpcPolicy.overlap
  const scanFrom = Math.max(network.pactLock.deploymentBlock, index.scanFrom || network.pactLock.deploymentBlock)
  let start = Math.max(scanFrom, index.cursor - overlap + 1)
  if (index.cursorHash) {
    const previous = await provider.getBlock(index.cursor)
    if (!previous || previous.hash !== index.cursorHash) {
      // A checkpoint mismatch invalidates the cached history, not just its newest row.
      index = { ...emptyIndex(network), scanFrom, cursor: scanFrom - 1 }
      start = scanFrom
      assert()
      await updateRecord(indexKey(network, address), () => index)
    }
  }
  index = { ...index, target }
  onProgress(index)
  while (start <= target) {
    assert()
    const { logs, toBlock: end } = await readLogChunk(client, { address: network.pactLock.address, fromBlock: start, toBlock: target, topics: [[created, accepted], null, zeroPadValue(address, 32)] }, { assert })
    assert()
    const block = await provider.getBlock(end)
    if (!block) throw appError('RPC_ERROR')
    const records = logs.filter(log => !log.removed).map(log => {
      const parsed = pactInterface.parseLog(log)
      return { key: log.transactionHash + ':' + log.index + ':' + log.blockHash, orderId: parsed.args.orderId, type: parsed.name === 'OrderCreated' ? 'created' : 'accepted', blockNumber: log.blockNumber, blockHash: log.blockHash, transactionHash: log.transactionHash, logIndex: log.index }
    })
    assert()
    index = await updateRecord(indexKey(network, address), saved => {
      const current = saved || index
      const merged = [...current.logs.filter(log => log.blockNumber < start || log.blockNumber > end), ...records]
      return { ...current, scanFrom, cursor: Math.max(end, current.cursor), cursorHash: end >= current.cursor ? block.hash : current.cursorHash, target, logs: [...new Map(merged.map(log => [log.key, log])).values()] }
    })
    onProgress(index)
    start = end + 1
  }
  return index
}
