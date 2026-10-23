const originalBalanceReader = Symbol.for('pact-lock.appkit.original-balance-reader')

// AppKit treats a rejected balance display refresh as a failed reconnect.
// Keep that optional read separate from authorization and business balance checks.
export function protectAppKitBalance(appKit) {
  if (!appKit[originalBalanceReader]) appKit[originalBalanceReader] = appKit.updateNativeBalance
  appKit.updateNativeBalance = async function (...args) {
    try {
      return await appKit[originalBalanceReader].apply(this, args)
    } catch (error) {
      if (import.meta.dev) console.warn('[Pact Lock] Wallet balance display could not refresh.', { chainId: args[1], code: error?.code || 'RPC_ERROR' })
      // Preserve the last displayed balance (or leave it unavailable), without
      // inventing a zero balance or resetting the wallet's connection.
      return undefined
    }
  }
}
