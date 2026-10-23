import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { switchWalletNetwork } from './switchNetwork.js'
import { formatUnits } from 'ethers'
import { getWalletReadProvider } from '../../contracts/rpc.js'
import { appError } from '../../contracts/errors.js'

export class WalletEthersAdapter extends EthersAdapter {
  constructor({ getProvider, getProviderType, networkById = () => undefined } = {}) {
    super()
    this.networkById = networkById
    this.getSelectedProvider = getProvider
    this.getSelectedProviderType = getProviderType
  }

  async connect(params) {
    if (!['INJECTED', 'ANNOUNCED'].includes(params.type)) {
      return super.connect(params)
    }

    // AppKit 1.8.24's standard connect() requests a network switch on injection.
    // Its syncConnection() already authorizes accounts, reads eth_chainId and
    // subscribes to provider events without switching the user's wallet network.
    const result = await this.syncConnection(params)
    const connector = this.connectors.find(item => item.id === result.id)
    const caipNetwork = this.getCaipNetworks().find(item => Number(item.id) === result.chainId)
    this.addConnection({
      connectorId: result.id,
      accounts: [{ address: result.address }],
      caipNetwork,
    })
    this.emit('accountChanged', {
      address: result.address,
      chainId: result.chainId,
      connector,
    })
    this.emit('switchNetwork', { chainId: result.chainId })
    return result
  }

  async switchNetwork({ caipNetwork }) {
    const provider = this.getSelectedProvider?.()
    if (!provider) throw new Error('Connect a wallet first')
    const assertCurrentWallet = () => {
      if (this.getSelectedProvider() !== provider) throw new Error('Wallet changed during network switch')
    }
    await switchWalletNetwork(provider, caipNetwork, assertCurrentWallet)
    if (this.getSelectedProviderType?.() === 'WALLET_CONNECT') {
      provider.setDefaultChain(caipNetwork.caipNetworkId)
    }
    this.emit('switchNetwork', { chainId: caipNetwork.id })
  }

  // The SDK's default balance reader creates its own HTTP JsonRpcProvider.
  async getBalance({ address, chainId }) {
    const network = this.getCaipNetworks().find(item => String(item.id) === String(chainId))
    const raw = this.getSelectedProvider?.()
    if (!network || !raw || !address) throw appError('ACCESS_REQUIRED')
    if (Number(await raw.request({ method: 'eth_chainId' })) !== Number(network.id)) throw appError('UNSUPPORTED_NETWORK')
    const key = network.caipNetworkId + ':' + address.toLowerCase()
    if (this.balancePromises[key]) return this.balancePromises[key]
    const provider = getWalletReadProvider({ chainId: Number(network.id), rpcPolicy: this.networkById(network.id)?.rpcPolicy }, raw, {
      channel: 'appkit', scope: address.toLowerCase(),
      guard: () => { if (this.getSelectedProvider?.() !== raw) throw appError('SESSION_CHANGED') },
    })
    this.balancePromises[key] = provider.getBalance(address).then(balance => ({
      balance: formatUnits(balance, network.nativeCurrency.decimals), symbol: network.nativeCurrency.symbol,
    })).finally(() => { delete this.balancePromises[key] })
    return this.balancePromises[key]
  }
}
