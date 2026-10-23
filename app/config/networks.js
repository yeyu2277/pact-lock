// Fallback values. Deployments override the complete list via NUXT_PUBLIC_NETWORKS_JSON.
export const defaultNetworks = {
  POLYGON: {
    chainId: 137,
    feeMode: 'minimum',
    minPriorityFeeGwei: '25',
    name: 'Polygon',
    rpcUrl: 'https://polygon.drpc.org',
    explorerUrl: 'https://polygonscan.com',
    nativeSymbol: 'POL',
    nativeDecimals: 18,
    testnet: false,
    pactLock: {
      enabled: true,
      address: '0x4392EC2e28289398318C19003170856aAD883009',
      deploymentBlock: 96028171,
    },
    tokens: [
      { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', name: 'USD Coin', symbol: 'USDC', decimals: 6, icon: '/icons/tokens/usdc.png' },
      { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', name: 'USDT0', symbol: 'USDT0', decimals: 6, icon: '/icons/tokens/usdt0.png' },
      { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', name: '(PoS) Dai Stablecoin', symbol: 'DAI', decimals: 18, icon: '/icons/tokens/dai.png' },
    ],
  },
  POLYGON_AMOY: {
    chainId: 80002,
    feeMode: 'minimum',
    minPriorityFeeGwei: '25',
    name: 'Polygon Amoy',
    rpcUrl: 'https://polygon-amoy.drpc.org',
    explorerUrl: 'https://amoy.polygonscan.com',
    nativeSymbol: 'POL',
    nativeDecimals: 18,
    testnet: true,
    pactLock: {
      enabled: true,
      address: '0x8391a0d46534b45a8FF04e39f0501A911973DcFe',
      deploymentBlock: 50924191,
    },
    tokens: [],
  },
}
