import { namespace, readRecord, updateRecord } from './storage.js'
import { loadIndex, indexKey } from './indexer.js'
import { pactInterface } from './client.js'
import { sameAddress } from '../utils/format.js'

const pendingKey = (network, address) => namespace(network, address) + ':pending'
export async function pendingTransactions(network, address) { return await readRecord(pendingKey(network, address)) || [] }
export async function rememberPending(network, address, transaction) {
  await updateRecord(pendingKey(network, address), records => [transaction, ...(records || []).filter(item => item.hash !== transaction.hash)].slice(0, 30))
}
export async function forgetPending(network, address, hash) {
  await updateRecord(pendingKey(network, address), records => (records || []).filter(item => item.hash !== hash))
}
export async function indexOwnReceipt(network, address, receipt) {
  const records = []
  for (const log of receipt.logs) {
    if (!sameAddress(log.address, network.pactLock.address)) continue
    try {
      const event = pactInterface.parseLog(log)
      if (event?.name === 'OrderCreated' && sameAddress(event.args.creator, address) || event?.name === 'OrderAccepted' && sameAddress(event.args.counterparty, address)) {
        records.push({ key: receipt.hash + ':' + log.index + ':' + receipt.blockHash, orderId: event.args.orderId, type: event.name === 'OrderCreated' ? 'created' : 'accepted', blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, transactionHash: receipt.hash, logIndex: log.index, unfinalized: true })
      }
    } catch {}
  }
  if (!records.length) return
  const index = await loadIndex(network, address)
  await updateRecord(indexKey(network, address), saved => {
    const current = saved || index
    const logs = [...new Map([...current.logs, ...records].map(log => [log.key, log])).values()]
    return { ...current, logs }
  })
}
