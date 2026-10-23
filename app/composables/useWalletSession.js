import { appError } from '~/contracts/errors.js'
import { getWalletReadProvider } from '~/contracts/rpc.js'

export function useWalletSession() {
  const { businessNetworks, deploymentById, networkById, defaultChainId, supportedNetworks } = usePactConfig()
  const session = useState('pact-wallet-session', () => ({ connected: false, address: '', chainId: null, revision: 0 }))
  const app = useNuxtApp()
  const busy = useState('pact-wallet-opening', () => false)
  const getRawProvider = () => app.$appKit?.getWalletProvider()
  function getReadProvider() {
    const raw = getRawProvider(), captured = { ...session.value }
    if (!captured.connected || !raw) throw appError('ACCESS_REQUIRED')
    const network = deploymentById(captured.chainId)
    if (!network) throw appError('UNSUPPORTED_NETWORK')
    return getWalletReadProvider(network, raw, {
      scope: captured.address.toLowerCase() + ':' + captured.revision,
      guard: () => {
        const current = session.value
        if (!current.connected) throw appError('ACCESS_REQUIRED')
        if (current.revision !== captured.revision || current.chainId !== captured.chainId || current.address !== captured.address || getRawProvider() !== raw) throw appError('SESSION_CHANGED')
      },
    })
  }
  async function connect() {
    if (busy.value) return
    if (!app.$appKit) throw appError('REOWN_PROJECT_ID_MISSING')
    busy.value = true
    try { await app.$appKit.open({ view: session.value.connected ? 'Account' : 'Connect', namespace: 'eip155' }) }
    finally { busy.value = false }
  }
  async function switchNetwork(chainId = defaultChainId) {
    const target = businessNetworks.find(item => item.chainId === Number(chainId))
    if (!target || !session.value.connected || !app.$appKit) throw appError('UNSUPPORTED_NETWORK')
    await app.$appKit.switchNetwork(supportedNetworks.find(item => item.id === target.chainId), { throwOnFailure: true })
  }
  async function getSigner() {
    const raw = getRawProvider()
    if (!raw || !session.value.connected) throw appError('ACCESS_REQUIRED')
    const { BrowserProvider } = await import('ethers')
    return new BrowserProvider(raw, 'any').getSigner(session.value.address)
  }
  async function disconnect() {
    await app.$appKit?.disconnect('eip155')
    session.value = { connected: false, address: '', chainId: null, revision: session.value.revision + 1 }
  }
  return {
    session, busy, connect, switchNetwork, getSigner, getReadProvider, disconnect,
    connected: computed(() => session.value.connected),
    address: computed(() => session.value.address),
    chainId: computed(() => session.value.chainId),
    network: computed(() => networkById(session.value.chainId)),
    deployment: computed(() => deploymentById(session.value.chainId)),
  }
}
