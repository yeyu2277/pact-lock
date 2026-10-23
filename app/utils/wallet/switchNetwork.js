export function isUnknownWalletChain(error) {
  const queue = [error]
  const seen = new Set()
  let unknown = false
  while (queue.length && seen.size < 24) {
    const current = queue.shift()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    if (Number(current.code) === 4001 || current.code === 'ACTION_REJECTED') return false
    if (Number(current.code) === 4902) unknown = true
    queue.push(current.cause, current.data, current.originalError, current.error)
  }
  return unknown
}

export async function switchWalletNetwork(provider, network, assertCurrentWallet = () => {}) {
  const target = Number(network.id)
  const request = {
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: `0x${target.toString(16)}` }],
  }
  const readChainId = async () => {
    const chainId = Number(await provider.request({ method: 'eth_chainId' }))
    assertCurrentWallet()
    return chainId
  }
  assertCurrentWallet()
  if (await readChainId() === target) return
  assertCurrentWallet()
  try {
    // Known chains keep the RPC configuration already stored in the wallet.
    await provider.request(request)
  } catch (error) {
    if (!isUnknownWalletChain(error)) throw error
    assertCurrentWallet()
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: request.params[0].chainId,
        chainName: network.name,
        nativeCurrency: network.nativeCurrency,
        rpcUrls: network.rpcUrls.chainDefault?.http || network.rpcUrls.default.http,
        blockExplorerUrls: [network.blockExplorers.default.url],
      }],
    })
    assertCurrentWallet()
    // Adding a network does not necessarily activate it.
    if (await readChainId() !== target) {
      assertCurrentWallet()
      await provider.request(request)
    }
  }
  assertCurrentWallet()
  if (await readChainId() !== target) throw new Error('Wallet did not switch to the selected network')
}
