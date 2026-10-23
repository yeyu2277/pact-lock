import { BrowserProvider } from 'ethers'
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/vue'
import { appError } from '~/contracts/errors.js'

// Call from a client component's setup; AppKit owns the connection and session state.
export function useWallet() {
  const { supportedNetworks } = usePactConfig()
  const { $appKit } = useNuxtApp()
  const account = useAppKitAccount({ namespace: 'eip155' })
  const network = useAppKitNetwork()
  // Keep the reactive object so reconnecting or switching wallets updates the provider.
  const providerState = useAppKitProvider('eip155')

  async function openWallet() {
    if (!$appKit) throw appError('REOWN_PROJECT_ID_MISSING')
    await $appKit.open({
      view: account.value.isConnected ? 'Account' : 'Connect',
      namespace: 'eip155',
    })
  }

  function getEthersProvider() {
    if (!account.value.isConnected || !providerState.walletProvider) {
      throw new Error('Connect a wallet first')
    }
    return new BrowserProvider(providerState.walletProvider, 'any')
  }

  async function getSigner() {
    return getEthersProvider().getSigner(account.value.address)
  }

  async function openNetworks() {
    if (!$appKit) throw appError('REOWN_PROJECT_ID_MISSING')
    await $appKit.open({ view: 'Networks', namespace: 'eip155' })
  }

  // Call only in response to a user's explicit network selection.
  async function switchChain(chainId) {
    const target = supportedNetworks.find(item => item.id === Number(chainId))
    if (!target) throw new Error('Unsupported network')
    if (!account.value.isConnected || !$appKit) throw new Error('Connect a wallet first')
    await $appKit.switchNetwork(target, { throwOnFailure: true })
  }

  return {
    address: computed(() => account.value.address),
    walletProvider: computed(() => providerState.walletProvider),
    isConnected: computed(() => account.value.isConnected),
    chainId: computed(() => network.value.chainId),
    networkName: computed(() => supportedNetworks.find(item => item.id === Number(network.value.chainId))?.name),
    isSupportedNetwork: computed(() => supportedNetworks.some(item => item.id === Number(network.value.chainId))),
    supportedNetworks,
    isConfigured: Boolean($appKit),
    openWallet,
    getEthersProvider,
    getSigner,
    openNetworks,
    switchChain,
  }
}
