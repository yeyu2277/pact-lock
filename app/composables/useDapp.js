import { createPactClient } from '~/contracts/client.js'
import { appError } from '~/contracts/errors.js'
import { getReadProvider } from '~/contracts/rpc.js'

export function useDapp(requiredChain, { publicRead = false, preferredChain } = {}) {
  const { businessNetworks, deploymentById, defaultChainId, defaultNetwork } = usePactConfig()
  const wallet = useWalletSession()
  const chainId = computed(() => Number(toValue(requiredChain) || (wallet.connected.value ? wallet.chainId.value : toValue(preferredChain) || defaultChainId)))
  const network = computed(() => deploymentById(chainId.value))
  const reason = computed(() => !wallet.connected.value && !publicRead ? 'connect' : !network.value ? toValue(requiredChain) ? 'undeployed' : 'network' : wallet.connected.value && (!wallet.deployment.value || wallet.chainId.value !== chainId.value) ? 'network' : null)
  const ready = computed(() => !reason.value)
  const writeReady = computed(() => wallet.connected.value && ready.value)
  const key = computed(() => [chainId.value, wallet.connected.value ? 'wallet' : 'public', wallet.address.value.toLowerCase(), wallet.session.value.revision].join(':'))
  function guard() {
    if (!ready.value) throw appError(reason.value === 'connect' ? 'ACCESS_REQUIRED' : 'UNSUPPORTED_NETWORK')
  }
  function client() {
    guard()
    const capturedKey = key.value
    const provider = wallet.connected.value ? wallet.getReadProvider() : getReadProvider(network.value)
    return createPactClient(network.value, { provider, guard: () => { guard(); if (key.value !== capturedKey) throw appError('SESSION_CHANGED') } })
  }
  function guardWrite() {
    if (!wallet.connected.value) throw appError('ACCESS_REQUIRED')
    guard()
  }
  function identity() {
    guardWrite()
    const captured = { address: wallet.address.value, chainId: chainId.value, revision: wallet.session.value.revision }
    return {
      ...captured,
      assert() {
        guardWrite()
        if (wallet.session.value.revision !== captured.revision || wallet.address.value !== captured.address || chainId.value !== captured.chainId) throw appError('SESSION_CHANGED')
      },
    }
  }
  return { wallet, chainId, network, reason, ready, writeReady, key, guard, guardWrite, client, identity, businessNetworks, defaultNetwork }
}
