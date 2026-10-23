import { appError } from './errors.js'
import { rpcErrorDetails } from './rpc.js'

const limits = new WeakMap()
function rangeFailure(error) {
  const { codes, statuses, message } = rpcErrorDetails(error)
  if (codes.some(code => Number(code) === 4001 || ['ACTION_REJECTED', 'ACCESS_REQUIRED', 'SESSION_CHANGED', 'UNSUPPORTED_NETWORK'].includes(code))) return null
  if (/block.?range|ranges?\s+(?:over|limit|exceed)|range.{0,50}(?:large|limit|exceed|maximum)|too many (?:results|logs)|response size|limited to.{0,30}blocks|maximum.{0,30}blocks/i.test(message) || statuses.includes(413)) return 'range'
  // MetaMask can hide the node's useful error body behind HTTP 400.
  return statuses.includes(400) ? 'opaque' : null
}

// Read a single bounded chunk. Never split into per-block loops automatically.
export async function readLogChunk(client, filter, { assert = client.guard } = {}) {
  const configured = client.network.rpcPolicy.scanChunk
  let size = Math.min(Number.isSafeInteger(configured) && configured > 0 ? configured : 1000, limits.get(client.provider) || Infinity, filter.toBlock - filter.fromBlock + 1)
  let reduced = false
  for (;;) {
    assert()
    const fromBlock = filter.fromBlock
    const toBlock = Math.min(filter.toBlock, fromBlock + size - 1)
    const query = { ...filter, fromBlock, toBlock }
    let logs
    try {
      logs = await client.provider.getLogs(query)
    } catch (error) {
      assert()
      const kind = rangeFailure(error)
      if (!kind) throw error
      if (size <= 1) throw Object.assign(appError('LOG_QUERY_UNAVAILABLE'), { cause: error })
      size = kind === 'opaque' ? Math.max(1, Math.min(100, Math.floor(size / 2))) : Math.max(1, Math.floor(size / 2))
      reduced = true
      continue
    }
    assert()
    // Some endpoints silently cap result counts rather than returning an error.
    if (logs.length >= 1000) {
      if (size <= 1) throw appError('LOG_QUERY_UNAVAILABLE')
      size = Math.max(1, Math.floor(size / 2)); reduced = true; continue
    }
    if (reduced) limits.set(client.provider, Math.min(limits.get(client.provider) || Infinity, size))
    return { logs, fromBlock, toBlock }
  }
}
