import { BrowserProvider, JsonRpcProvider } from 'ethers'
import { appError } from './errors.js'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
export function rpcErrorDetails(error) {
  const queue = [error], seen = new Set(), codes = [], statuses = [], messages = []
  while (queue.length && seen.size < 30) {
    const item = queue.shift()
    if (!item || typeof item !== 'object' || seen.has(item)) continue
    seen.add(item)
    if (item.code != null) codes.push(item.code)
    for (const status of [item.status, item.httpStatus, item.responseStatus]) if (Number.isInteger(Number(status)) && Number(status) >= 100) statuses.push(Number(status))
    if (typeof item.message === 'string') messages.push(item.message)
    for (const key of ['error', 'cause', 'data', 'info', 'originalError']) queue.push(item[key])
  }
  return { codes, statuses, message: messages.join(' ') }
}
export function retryable(error) {
  const { codes, statuses, message } = rpcErrorDetails(error)
  if (codes.some(code => Number(code) === 4001 || ['ACTION_REJECTED', 'ACCESS_REQUIRED', 'SESSION_CHANGED', 'UNSUPPORTED_NETWORK'].includes(code))) return false
  return statuses.some(status => [429, 500, 502, 503, 504].includes(status)) || codes.some(code => ['TIMEOUT', 'NETWORK_ERROR'].includes(code)) || /rate.?limit|too many requests|temporar(?:y|ily)|timeout|429|502|503/i.test(message)
}
export class RpcQueue {
  constructor({ interval = 500, concurrency = 2, maxRetries = 3, sleep = wait } = {}) {
    this.interval = interval; this.concurrency = concurrency; this.maxRetries = maxRetries; this.sleep = sleep
    this.active = 0; this.nextStart = 0; this.jobs = []; this.timer = null
  }
  run(task, guard = () => {}) {
    return new Promise((resolve, reject) => {
      this.jobs.push({ task, guard, resolve, reject, attempt: 0 })
      this.pump()
    })
  }
  pump() {
    if (this.timer || !this.jobs.length || this.active >= this.concurrency) return
    const delay = Math.max(0, this.nextStart - Date.now())
    if (delay) { this.timer = setTimeout(() => { this.timer = null; this.pump() }, delay); return }
    const job = this.jobs.shift()
    this.nextStart = Date.now() + this.interval
    this.active++
    Promise.resolve().then(() => { job.guard(); return job.task() }).then(job.resolve).catch(error => {
      if (job.attempt < this.maxRetries && retryable(error)) {
        const backoff = 1000 * 2 ** job.attempt++
        this.sleep(backoff).then(() => { this.jobs.push(job); this.pump() }, job.reject)
      } else job.reject(error)
    }).finally(() => { this.active--; this.pump() })
    this.pump()
  }
}
const providers = new Map()
class ThrottledProvider extends JsonRpcProvider {
  constructor(network) {
    super(network.rpcUrl, network.chainId, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: 250 })
    this.queue = new RpcQueue(network.rpcPolicy)
    this.chainId = network.chainId
    this.endpoint = network.rpcUrl
  }
  async _send(payload) {
    return this.queue.run(async () => {
      let http
      try {
        http = await fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) })
      } catch (error) {
        throw Object.assign(new Error(error.message), { code: error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR' })
      }
      if (!http.ok) throw Object.assign(new Error('RPC HTTP ' + http.status), { status: http.status })
      const body = await http.json()
      const response = Array.isArray(body) ? body : [body]
      const throttled = response.find(item => item.error && /limit|too many|temporar|429/i.test(item.error.message || ''))
      if (throttled) throw Object.assign(new Error(throttled.error.message), { code: 'NETWORK_ERROR' })
      return response
    })
  }
}
export function getReadProvider(network) {
  const key = network.chainId + ':' + network.rpcUrl
  if (!providers.has(key)) providers.set(key, new ThrottledProvider(network))
  return providers.get(key)
}
const walletProviders = new WeakMap()
const walletQueues = new WeakMap()
let walletProviderId = 0
export function getWalletReadProvider(network, ethereum, { scope = '', channel = 'business', guard = () => {} } = {}) {
  if (!ethereum || typeof ethereum.request !== 'function') throw appError('ACCESS_REQUIRED')
  guard()
  let chains = walletProviders.get(ethereum)
  if (!chains) { chains = new Map(); walletProviders.set(ethereum, chains) }
  const slot = network.chainId + ':' + channel
  const existing = chains.get(slot)
  if (existing?.scope === scope) return existing.provider
  let queues = walletQueues.get(ethereum)
  if (!queues) { queues = new Map(); walletQueues.set(ethereum, queues) }
  if (!queues.has(network.chainId)) queues.set(network.chainId, new RpcQueue(network.rpcPolicy))
  const queue = queues.get(network.chainId)
  const bridge = {
    request: payload => queue.run(async () => {
      const result = await ethereum.request(payload)
      guard()
      return result
    }, guard),
  }
  const provider = new BrowserProvider(bridge, network.chainId, { cacheTimeout: 250 })
  provider.rpcScope = 'wallet:' + ++walletProviderId
  chains.set(slot, { scope, provider })
  return provider
}
const cached = new Map()
const inflight = new Map()
export async function cachedRead(key, fetcher, { force = false, ttl = 60000, guard = () => {} } = {}) {
  guard()
  if (inflight.has(key)) return inflight.get(key)
  const existing = cached.get(key)
  if (!force && existing && Date.now() - existing.time < ttl) return existing.value
  const request = Promise.resolve().then(() => { guard(); return fetcher() }).then(value => {
    guard(); cached.set(key, { time: Date.now(), value }); return value
  }).finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}
export function invalidateReads(prefix) {
  for (const key of cached.keys()) if (key.startsWith(prefix)) cached.delete(key)
}
