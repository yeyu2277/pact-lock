import { Contract, Interface, ZeroAddress, getAddress, isAddress } from 'ethers'
import abi from './abi.json' with { type: 'json' }
import { cachedRead, getReadProvider, invalidateReads } from './rpc.js'
import { appError } from './errors.js'
import { normalizeOrder, isNativeAsset } from './model.js'
import { isOrderId } from '../utils/format.js'
import { readRecord, writeRecord } from './storage.js'
import { erc20Abi } from './erc20.js'

export { erc20Abi } from './erc20.js'
export const pactInterface = new Interface(abi)
// The homepage counter is the only application read using the configured HTTP RPC.
export function readCreatedOrderCount(network, { guard = () => {}, ...options } = {}) {
  guard()
  if (!network?.pactLock?.enabled || !isAddress(network.pactLock.address)) throw appError('UNSUPPORTED_NETWORK')
  const contract = new Contract(network.pactLock.address, abi, getReadProvider(network))
  const key = 'pact:' + network.chainId + ':' + network.pactLock.address.toLowerCase() + ':stats'
  return cachedRead(key, async () => (await contract.nextOrderNonce()).toString(), { ...options, guard })
}
export function createPactClient(network, { provider, guard = () => {} } = {}) {
  if (!network?.pactLock?.enabled || !isAddress(network.pactLock.address)) throw appError('UNSUPPORTED_NETWORK')
  if (!provider) throw appError('ACCESS_REQUIRED')
  const contract = new Contract(network.pactLock.address, abi, provider)
  const basePrefix = 'pact:' + network.chainId + ':' + network.pactLock.address.toLowerCase() + ':'
  const prefix = basePrefix + (provider.rpcScope || 'provided') + ':'
  const read = (key, fetcher, options = {}) => cachedRead(prefix + key, fetcher, { ...options, guard })
  function nativeAsset() {
    return { address: ZeroAddress, name: network.nativeName || network.nativeSymbol, symbol: network.nativeSymbol, decimals: network.nativeDecimals, icon: network.icon, native: true }
  }
  async function token(address, { force = false } = {}) {
    guard()
    if (isNativeAsset(address)) return nativeAsset()
    if (!isAddress(address) || address.toLowerCase() === network.pactLock.address.toLowerCase()) throw appError('INVALID_TOKEN')
    const normalized = getAddress(address)
    const value = await read('token:' + normalized, async () => {
      const saved = !force && await readRecord(basePrefix + 'token:' + normalized)
      if (saved && Date.now() - saved.updatedAt < 86400000) return saved.value
      guard()
      if (await provider.getCode(normalized) === '0x') throw appError('INVALID_TOKEN')
      const erc20 = new Contract(normalized, erc20Abi, provider)
      const decimals = Number(await erc20.decimals())
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 80) throw appError('INVALID_TOKEN')
      const [name, symbol] = await Promise.all([erc20.name().catch(() => 'ERC20'), erc20.symbol().catch(() => 'ERC20')])
      const preset = network.tokens.find(item => item.address.toLowerCase() === normalized.toLowerCase())
      const value = { address: normalized, name: String(name).slice(0, 100), symbol: String(symbol).slice(0, 20), decimals, icon: preset?.icon || null, native: false }
      guard(); await writeRecord(basePrefix + 'token:' + normalized, { value, updatedAt: Date.now() })
      return value
    }, { force, ttl: 86400000 })
    // Chain metadata remains cached; artwork always follows deployment config.
    return { ...value, icon: network.tokens.find(item => item.address.toLowerCase() === normalized.toLowerCase())?.icon || null }
  }
  async function getOrder(id, { force = false } = {}) {
    if (!isOrderId(id)) throw appError('INVALID_ORDER_ID')
    const order = await read('order:' + id.toLowerCase(), async () => {
      const value = normalizeOrder(await contract.getOrder(id))
      return { ...value, id, chainId: network.chainId, updatedAt: Date.now() }
    }, { force })
    return { ...order, token: await token(order.asset) }
  }
  return {
    network, provider, contract, prefix, guard, token, nativeAsset, getOrder,
    getBalance: (asset, address, options) => read('balance:' + asset + ':' + address, async () => (isNativeAsset(asset) ? await provider.getBalance(address) : await new Contract(asset, erc20Abi, provider).balanceOf(address)).toString(), options),
    invalidate(id) {
      invalidateReads(basePrefix + 'stats')
      invalidateReads(prefix + 'balance:')
      if (id) invalidateReads(prefix + 'order:' + id.toLowerCase())
    },
  }
}
