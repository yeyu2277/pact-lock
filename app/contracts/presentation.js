import { ZeroAddress } from 'ethers'
import { sameAddress } from '../utils/format.js'
import { claimable, orderActions, roleOf } from './model.js'

export function allFundsClaimed(order) {
  if (!order || ![4, 5].includes(Number(order.state))) return false
  const roles = ['payer', 'payee'].filter(role => order[role] && !sameAddress(order[role], ZeroAddress))
  return roles.length > 0 && roles.every(role => order[role + 'Claimed'])
}

export function orderGuidance(order, address) {
  if (!order) return { title: 'common.loading', hint: '', boundary: '' }
  const state = Number(order.state), role = roleOf(order, address)
  const action = orderActions(order, address).find(name => name !== 'cancelOrder')
  if (state === 4 || state === 5) {
    const cancelled = state === 4, complete = allFundsClaimed(order)
    const prefix = cancelled ? 'cancelled' : 'settled'
    const hint = complete ? 'allClaimedHint' : role && order[role + 'Claimed'] ? prefix + 'ClaimedHint' : role && claimable(order, address) > 0n ? prefix + 'Hint' : prefix + 'PublicHint'
    return { title: cancelled ? 'state.cancelled' : 'state.settled', hint: 'order.' + hint, boundary: 'order.' + (complete ? 'closedBoundary' : prefix + 'Boundary') }
  }
  const boundary = 'order.' + (state === 3 ? 'boundary' : 'beforeActivationBoundary')
  if (state === 1) {
    const designated = !sameAddress(order.designatedCounterparty, ZeroAddress)
    if (action === 'acceptOrder') return { title: 'order.accept', hint: 'order.' + (designated ? 'designatedAcceptHint' : 'publicAcceptHint'), boundary }
    if (sameAddress(order.creator, address)) return { title: 'order.waitingAcceptTitle', hint: 'order.' + (designated ? 'waitingDesignatedAccept' : 'waitingAccept'), boundary }
    return { title: 'state.open', hint: 'order.' + (designated ? 'designatedOnlyHint' : 'waitingAccept'), boundary }
  }
  if (state === 2) return { title: action === 'activateOrder' ? 'order.activate' : 'order.waitingActivationTitle', hint: action === 'activateOrder' ? 'order.activateHint' : 'order.waitingActivation', boundary }
  if (state === 3) {
    if (action === 'confirmCompletion') return { title: 'order.confirm', hint: 'order.' + (order[role === 'payer' ? 'payeeConfirmed' : 'payerConfirmed'] ? 'nextHint' : 'activeHint'), boundary }
    if (role) return { title: 'order.waitingConfirmTitle', hint: 'order.waitingConfirm', boundary }
    return { title: 'state.active', hint: 'order.activeHint', boundary }
  }
  return { title: 'order.none', hint: '', boundary: '' }
}

export function participantStatus(order, role) {
  if (!order || !order[role] || sameAddress(order[role], ZeroAddress)) return 'order.notJoined'
  if ([4, 5].includes(Number(order.state))) return order[role + 'Claimed'] ? 'order.claimed' : 'order.notClaimed'
  if (Number(order.state) !== 3) return 'order.notActive'
  return order[role + 'Confirmed'] ? 'order.confirmed' : 'order.notConfirmed'
}

export function orderLifecycle(order) {
  const state = Number(order?.state), complete = allFundsClaimed(order)
  if (state === 4) return { items: ['order.lifecycle.0', 'state.cancelled', 'order.refundClaims'], step: complete ? 3 : 2 }
  return {
    items: Array.from({ length: 6 }, (_, i) => 'order.lifecycle.' + i),
    step: state === 5 ? complete ? 6 : 5 : state === 3 ? order.payerConfirmed || order.payeeConfirmed ? 3 : 2 : state === 2 ? 1 : order ? 0 : -1,
  }
}
