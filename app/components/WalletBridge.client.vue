<script setup>
const wallet = useWallet()
const { session } = useWalletSession()
let previousProvider
onMounted(() => watch([wallet.isConnected, wallet.address, wallet.chainId, wallet.walletProvider], ([connected, address, chainId, provider]) => {
  const next = { connected: Boolean(connected && address), address: address || '', chainId: chainId ? Number(chainId) : null }
  const previous = session.value
  if (previous.connected !== next.connected || previous.address !== next.address || previous.chainId !== next.chainId || previousProvider !== provider) {
    session.value = { ...next, revision: previous.revision + 1 }
  }
  previousProvider = provider
}, { immediate: true, flush: 'sync' }))
</script>

<template><span hidden aria-hidden="true" /></template>
