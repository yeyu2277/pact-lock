import { parseUnits } from 'ethers'
import { appError } from './errors.js'

// Only networks with an explicit admission-floor policy override wallet pricing.
export async function transactionFees(client, assert = () => {}) {
  assert()
  if (!client.network.feeMode || client.network.feeMode === 'wallet') return {}
  if (client.network.feeMode !== 'minimum') throw appError('INVALID_FEE_CONFIG')
  let priority
  try { priority = parseUnits(client.network.minPriorityFeeGwei, 'gwei') }
  catch { throw appError('INVALID_FEE_CONFIG') }
  if (priority < 0n) throw appError('INVALID_FEE_CONFIG')
  const block = await client.provider.getBlock('latest')
  assert()
  if (typeof block?.baseFeePerGas !== 'bigint' || block.baseFeePerGas < 0n || block.baseFeePerGas * 2n + priority <= 0n) throw appError('RPC_ERROR')
  // The ceiling leaves room for base-fee movement; it is not the final charge.
  return { maxPriorityFeePerGas: priority, maxFeePerGas: block.baseFeePerGas * 2n + priority }
}
