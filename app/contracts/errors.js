import { Interface } from 'ethers'
import abi from './abi.json' with { type: 'json' }
import { erc20Abi } from './erc20.js'

const contractInterface = new Interface([...abi, ...erc20Abi])
export function decodeError(error) {
  const known = new Set(['REOWN_PROJECT_ID_MISSING', 'ACCESS_REQUIRED', 'SESSION_CHANGED', 'UNSUPPORTED_NETWORK', 'INVALID_AMOUNT', 'INVALID_ADDRESS', 'INVALID_ORDER_ID', 'INVALID_TOKEN', 'INVALID_SCAN_BLOCK', 'INVALID_FEE_CONFIG', 'LOG_QUERY_UNAVAILABLE', 'PRECHECK_FAILED', 'SCAN_PAUSED', 'COPY_FAILED', 'AGREEMENT_REQUIRED', 'PENDING_TRANSACTION'])
  if (known.has(error?.code)) return error.code
  const queue = [error], seen = new Set()
  let fallback = ''
  while (queue.length && seen.size < 30) {
    const value = queue.shift()
    if (!value || typeof value !== 'object' || seen.has(value)) continue
    seen.add(value)
    if (known.has(value.code)) return value.code
    if (value.code === 4001 || value.code === 'ACTION_REJECTED') return 'REJECTED'
    if (value.code === 'INSUFFICIENT_FUNDS') return 'INSUFFICIENT_FUNDS'
    if (value.code === 'TRANSACTION_REPLACED' && value.cancelled) return 'REPLACED'
    for (const data of [value.data, value.result]) {
      if (typeof data === 'string' && data.startsWith('0x')) {
        try { const parsed = contractInterface.parseError(data); if (parsed) fallback = parsed.name } catch {}
      }
    }
    if (/insufficient funds/i.test(value.message || '')) fallback ||= 'INSUFFICIENT_FUNDS'
    for (const key of ['error', 'cause', 'info', 'originalError', 'data']) if (value[key] && typeof value[key] === 'object') queue.push(value[key])
  }
  return fallback || 'RPC_ERROR'
}
export const appError = code => Object.assign(new Error(code), { code })
