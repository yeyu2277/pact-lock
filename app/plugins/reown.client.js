import { createAppKit } from '@reown/appkit/vue'
import { site } from '~/config/site.js'
import { featuredWalletIds, walletTheme } from '~/config/wallet.js'
import { WalletEthersAdapter } from '~/utils/wallet/WalletEthersAdapter.js'
import { protectAppKitBalance } from '~/utils/wallet/protectAppKitBalance.js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const projectId = config.public.reownProjectId?.trim()

  // A missing project ID should not prevent the rest of the site from loading.
  if (!projectId) return { provide: { appKit: null } }

  const { supportedNetworks, customRpcUrls, networkById } = usePactConfig()
  let appKit
  const adapter = new WalletEthersAdapter({
    networkById,
    getProvider: () => appKit?.getWalletProvider(),
    getProviderType: () => appKit?.getWalletProviderType(),
  })
  appKit = createAppKit({
    adapters: [adapter],
    projectId,
    networks: supportedNetworks,
    customRpcUrls,
    allowUnsupportedChain: true,
    enableCoinbase: false,
    enableBaseAccount: false,
    featuredWalletIds,
    metadata: {
      name: 'Pact Lock',
      description: 'Pact Lock',
      // Use the actual origin for local preview and deployed domain verification.
      url: window.location.origin,
      icons: [new URL(site.logo, window.location.origin).href],
    },
    themeMode: 'dark',
    themeVariables: walletTheme,
    features: {
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
      send: false,
      history: false,
      analytics: false,
    },
  })

  protectAppKitBalance(appKit)
  return { provide: { appKit } }
})
