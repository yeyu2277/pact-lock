import { ZeroAddress } from 'ethers'
import { sameAddress } from '../utils/format.js'

export const STATES = ['none', 'open', 'pending', 'active', 'cancelled', 'settled']
export const ORDER_FIELDS = ['creator', 'designatedCounterparty', 'counterparty', 'asset', 'payer', 'payee', 'creatorRole', 'state', 'paymentAmount', 'payerDeposit', 'payeeDeposit', 'lockedAmount', 'payerConfirmed', 'payeeConfirmed', 'payerClaimed', 'payeeClaimed']
export function normalizeOrder(result) {
  return Object.fromEntries(ORDER_FIELDS.map((key, i) => {
    const value = result[key] ?? result[i]
    return [key, typeof value === 'bigint' ? value.toString() : value]
  }))
}
export const isNativeAsset = address => sameAddress(address, ZeroAddress)
export const roleOf = (order, address) => sameAddress(order.payer, address) ? 'payer' : sameAddress(order.payee, address) ? 'payee' : null
export const roleFunding = (order, role) => role === 'payer' ? BigInt(order.paymentAmount) + BigInt(order.payerDeposit) : BigInt(order.payeeDeposit)
export function claimable(order, address) {
  const state = Number(order.state), role = roleOf(order, address)
  if (![4, 5].includes(state) || !role || order[role + 'Claimed']) return 0n
  if (role === 'payer') return state === 4 ? roleFunding(order, role) : BigInt(order.payerDeposit)
  return state === 4 ? BigInt(order.payeeDeposit) : BigInt(order.paymentAmount) + BigInt(order.payeeDeposit)
}
export function orderActions(order, address) {
  if (!order || !address) return []
  const state = Number(order.state), creator = sameAddress(order.creator, address), role = roleOf(order, address)
  if (state === 1) return creator ? ['cancelOrder'] : (isNativeAsset(order.designatedCounterparty) || sameAddress(order.designatedCounterparty, address)) ? ['acceptOrder'] : []
  if (state === 2) return creator ? ['activateOrder', 'cancelOrder'] : sameAddress(order.counterparty, address) ? ['cancelOrder'] : []
  if (state === 3) return role && !order[role + 'Confirmed'] ? ['confirmCompletion'] : []
  return claimable(order, address) > 0n ? ['claim'] : []
}
