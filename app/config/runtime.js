import { defineChain } from '@reown/appkit/networks'
import { isAddress, ZeroAddress, parseUnits } from 'ethers'
import { defaultNetworks } from './networks.js'
import { site as siteDefaults } from './site.js'

const networkIcons = { 1: 'ethereum', 137: 'polygon', 80002: 'polygon', 56: 'bsc', 42161: 'arbitrum', 10: 'optimism', 8453: 'base', 43114: 'avalanche' }
const rpcDefaults = { interval: 500, concurrency: 2, maxRetries: 3, scanChunk: 1000, confirmations: 64, overlap: 64 }
const fail = (field, message) => { throw new Error(`[Pact Lock config] ${field}: ${message}`) }
function integer(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === '' || value == null || typeof value === 'boolean' || !Number.isSafeInteger(Number(value)) || Number(value) < minimum || Number(value) > maximum) fail(field, 'expected an integer in range')
  return Number(value)
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(field, 'required')
  return value.trim()
}
function url(value, field) {
  const result = text(value, field)
  try { if (['http:', 'https:'].includes(new URL(result).protocol)) return result.replace(/\/$/, '') } catch {}
  fail(field, 'expected an http(s) URL')
}
function icon(value, field) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) fail(field, 'expected a local public asset path beginning with /')
  return value
}
function address(value, field) {
  if (typeof value !== 'string' || !isAddress(value) || value.toLowerCase() === ZeroAddress) fail(field, 'expected a nonzero EVM address')
  return value
}
function flag(value, field) {
  if (value !== undefined && typeof value !== 'boolean') fail(field, 'expected true or false')
}

// Pure factory: never change module-level configuration shared by SSR requests.
export function resolvePactConfig(config = {}) {
  let input = config.networksJson
  if (typeof input === 'string') {
    try { input = input.trim() ? JSON.parse(input) : defaultNetworks } catch { fail('NUXT_PUBLIC_NETWORKS_JSON', 'invalid JSON') }
  }
  input ??= defaultNetworks
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length) fail('NUXT_PUBLIC_NETWORKS_JSON', 'expected a nonempty object keyed by network name')
  const ids = new Set()
  const networks = Object.fromEntries(Object.entries(input).map(([key, value]) => {
    const field = `networks.${key}`
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'expected a network object')
    const chainId = integer(value.chainId, field + '.chainId', 1)
    if (ids.has(chainId)) fail(field + '.chainId', 'duplicate chain ID')
    ids.add(chainId)
    flag(value.enabled, field + '.enabled'); flag(value.testnet, field + '.testnet')
    const network = {
      ...value, chainId, name: text(value.name, field + '.name'),
      rpcUrl: url(value.rpcUrl, field + '.rpcUrl'), explorerUrl: url(value.explorerUrl, field + '.explorerUrl'),
      nativeSymbol: text(value.nativeSymbol, field + '.nativeSymbol'),
      nativeDecimals: integer(value.nativeDecimals, field + '.nativeDecimals', 0, 80),
      icon: icon(value.icon || (networkIcons[chainId] ? `/icons/networks/${networkIcons[chainId]}.png` : '/favicon.svg'), field + '.icon'),
    }
    if (value.nativeName !== undefined) network.nativeName = text(value.nativeName, field + '.nativeName')
    if (value.pactLock) {
      flag(value.pactLock.enabled, field + '.pactLock.enabled')
      network.pactLock = { ...value.pactLock }
      if (value.pactLock.enabled) {
        network.pactLock.address = address(value.pactLock.address, field + '.pactLock.address')
        network.pactLock.deploymentBlock = integer(value.pactLock.deploymentBlock, field + '.pactLock.deploymentBlock')
      }
    }
    if (value.feeMode && !['wallet', 'minimum'].includes(value.feeMode)) fail(field + '.feeMode', 'expected wallet or minimum')
    if (value.feeMode === 'minimum') {
      network.minPriorityFeeGwei = String(value.minPriorityFeeGwei ?? '')
      try { if (parseUnits(network.minPriorityFeeGwei, 'gwei') < 0n) throw new Error() } catch { fail(field + '.minPriorityFeeGwei', 'expected a nonnegative gwei amount') }
    }
    network.rpcPolicy = { ...rpcDefaults, ...value.rpcPolicy }
    for (const [name, amount] of Object.entries(network.rpcPolicy)) network.rpcPolicy[name] = integer(amount, field + '.rpcPolicy.' + name, ['concurrency', 'scanChunk'].includes(name) ? 1 : 0)
    if (value.tokens !== undefined && !Array.isArray(value.tokens)) fail(field + '.tokens', 'expected an array')
    const tokens = new Set()
    network.tokens = (value.tokens || []).map((token, index) => {
      const tokenField = field + '.tokens[' + index + ']'
      const tokenAddress = address(token?.address, tokenField + '.address')
      if (tokens.has(tokenAddress.toLowerCase())) fail(tokenField + '.address', 'duplicate token address')
      tokens.add(tokenAddress.toLowerCase())
      return { ...token, address: tokenAddress, name: text(token.name, tokenField + '.name'), symbol: text(token.symbol, tokenField + '.symbol'), decimals: integer(token.decimals, tokenField + '.decimals', 0, 80), ...(token.icon ? { icon: icon(token.icon, tokenField + '.icon') } : {}) }
    })
    return [key, network]
  }))
  const available = Object.values(networks).filter(network => network.enabled !== false)
  const businessNetworks = available.filter(network => network.pactLock?.enabled && network.pactLock.address)
  const defaultChainId = integer(config.defaultChainId ?? 137, 'NUXT_PUBLIC_DEFAULT_CHAIN_ID', 1)
  const defaultNetwork = businessNetworks.find(network => network.chainId === defaultChainId)
  if (!defaultNetwork) fail('NUXT_PUBLIC_DEFAULT_CHAIN_ID', 'must identify an enabled network with a PactLock deployment')
  const supportedNetworks = available.map(network => defineChain({
    id: network.chainId, name: network.name, chainNamespace: 'eip155', caipNetworkId: `eip155:${network.chainId}`,
    nativeCurrency: { name: network.nativeName || network.nativeSymbol, symbol: network.nativeSymbol, decimals: network.nativeDecimals },
    rpcUrls: { default: { http: [network.rpcUrl] } },
    blockExplorers: { default: { name: 'Explorer', url: network.explorerUrl } }, testnet: Boolean(network.testnet),
  }))
  const links = Object.fromEntries(['github', 'telegram', 'x'].map(key => {
    const value = config[key + 'Url']
    return [key, value ? url(value, `NUXT_PUBLIC_${key.toUpperCase()}_URL`) : '']
  }))
  return {
    networks, businessNetworks, supportedNetworks, defaultChainId, defaultNetwork,
    networkById: id => available.find(network => network.chainId === Number(id)),
    deploymentById: id => businessNetworks.find(network => network.chainId === Number(id)),
    customRpcUrls: Object.fromEntries(supportedNetworks.map(network => [network.caipNetworkId, network.rpcUrls.default.http.map(url => ({ url }))])),
    site: { ...siteDefaults, links },
  }
}
