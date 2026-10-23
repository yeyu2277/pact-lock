import { createPactClient } from '~/contracts/client.js'
import { appError } from '~/contracts/errors.js'

export function useDapp(requiredChain) {
  const { businessNetworks, deploymentById, defaultChainId, defaultNetwork } = usePactConfig()
  const wallet = useWalletSession()
  const chainId = computed(() => Number(toValue(requiredChain) || (wallet.connected.value ? wallet.chainId.value : defaultChainId)))
  const network = computed(() => deploymentById(chainId.value))
  const reason = computed(() => !wallet.connected.value ? 'connect' : !network.value ? toValue(requiredChain) ? 'undeployed' : 'network' : !wallet.deployment.value || wallet.chainId.value !== chainId.value ? 'network' : null)
  const ready = computed(() => !reason.value)
  const key = computed(() => [chainId.value, wallet.address.value.toLowerCase(), wallet.session.value.revision].join(':'))
  function guard() {
    if (!ready.value) throw appError(reason.value === 'connect' ? 'ACCESS_REQUIRED' : 'UNSUPPORTED_NETWORK')
  }
  function client() {
    guard()
    const capturedKey = key.value
    return createPactClient(network.value, { provider: wallet.getReadProvider(), guard: () => { guard(); if (key.value !== capturedKey) throw appError('SESSION_CHANGED') } })
  }
  function identity() {
    guard()
    const captured = { address: wallet.address.value, chainId: chainId.value, revision: wallet.session.value.revision }
    return {
      ...captured,
      assert() {
        guard()
        if (wallet.session.value.revision !== captured.revision || wallet.address.value !== captured.address || chainId.value !== captured.chainId) throw appError('SESSION_CHANGED')
      },
    }
  }
  return { wallet, chainId, network, reason, ready, key, guard, client, identity, businessNetworks, defaultNetwork }
}
