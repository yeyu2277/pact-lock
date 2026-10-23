import { Contract, VoidSigner, ZeroAddress, isAddress } from 'ethers'
import abi from './abi.json' with { type: 'json' }
import { erc20Abi, pactInterface } from './client.js'
import { appError } from './errors.js'
import { isNativeAsset, orderActions, roleFunding } from './model.js'
import { sameAddress } from '../utils/format.js'
import { transactionFees } from './fees.js'

export async function reviewTransaction(client, request, identity) {
  identity.assert()
  const { method, args = [] } = request
  let asset = request.asset || ZeroAddress, funding = BigInt(request.funding || 0), order
  if (method !== 'createOrder') {
    order = await client.getOrder(args[0], { force: true })
    if (!orderActions(order, identity.address).includes(method)) throw appError('SESSION_CHANGED')
    asset = order.asset
    funding = method === 'acceptOrder' ? roleFunding(order, Number(order.creatorRole) === 0 ? 'payee' : 'payer') : 0n
    if (method === 'claim' && (!isAddress(args[1]) || sameAddress(args[1], ZeroAddress) || sameAddress(args[1], client.network.pactLock.address))) throw appError('INVALID_ADDRESS')
  }
  if (funding > 0n) {
    if (BigInt(await client.getBalance(asset, identity.address, { force: true })) < funding) throw Object.assign(appError('INSUFFICIENT_FUNDS'), { asset })
    if (!isNativeAsset(asset)) {
      const token = new Contract(asset, erc20Abi, client.provider)
      const allowance = await token.allowance(identity.address, client.network.pactLock.address)
      identity.assert()
      if (allowance < funding) return { approval: true, asset, funding, reset: allowance > 0n, method, args, order }
    }
  }
  const value = isNativeAsset(asset) ? funding : 0n
  identity.assert()
  return { approval: false, method, args, asset, funding, value, order }
}
export async function prepareTransaction(client, request, identity) {
  const plan = await reviewTransaction(client, request, identity)
  if (plan.approval) return plan
  const { method, args, value } = plan
  const contract = new Contract(client.network.pactLock.address, abi, new VoidSigner(identity.address, client.provider))
  await contract[method].staticCall(...args, { value })
  identity.assert()
  const gas = await contract[method].estimateGas(...args, { value })
  identity.assert()
  return { ...plan, gasLimit: gas * 120n / 100n }
}
export async function prepareApproval(client, plan, identity, amount) {
  identity.assert()
  const token = new Contract(plan.asset, erc20Abi, new VoidSigner(identity.address, client.provider))
  const call = await token.approve.populateTransaction(client.network.pactLock.address, amount)
  const result = await client.provider.call({ ...call, from: identity.address })
  // SafeERC20 also accepts legacy tokens that return no value on approval.
  if (result !== '0x' && !token.interface.decodeFunctionResult('approve', result)[0]) throw appError('PRECHECK_FAILED')
  const gas = await token.approve.estimateGas(client.network.pactLock.address, amount)
  identity.assert()
  return { amount, gasLimit: gas * 120n / 100n }
}
export async function sendPrepared(client, plan, identity, getSigner) {
  identity.assert()
  const signer = await getSigner()
  identity.assert()
  if (!sameAddress(await signer.getAddress(), identity.address) || Number((await signer.provider.getNetwork()).chainId) !== client.network.chainId) throw appError('SESSION_CHANGED')
  const fees = await transactionFees(client, identity.assert)
  identity.assert()
  if (plan.approval) return new Contract(plan.asset, erc20Abi, signer).approve(client.network.pactLock.address, plan.amount, { gasLimit: plan.gasLimit, ...fees })
  return new Contract(client.network.pactLock.address, abi, signer)[plan.method](...plan.args, { value: plan.value, gasLimit: plan.gasLimit, ...fees })
}
export function orderIdFromReceipt(receipt, contractAddress) {
  for (const log of receipt.logs) {
    if (!sameAddress(log.address, contractAddress)) continue
    try { const event = pactInterface.parseLog(log); if (event?.name === 'OrderCreated') return event.args.orderId } catch {}
  }
  return null
}
export async function waitForReceipt(client, transaction, identity, { interval = 4000, signal } = {}) {
  const assertWaiting = () => {
    if (signal?.aborted) throw appError('WAIT_CANCELLED')
    identity.assert()
  }
  const pause = () => new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop) }
    const stop = () => { cleanup(); reject(appError('WAIT_CANCELLED')) }
    const timer = setTimeout(() => { cleanup(); resolve() }, interval)
    signal?.addEventListener('abort', stop, { once: true })
    if (signal?.aborted) stop()
  })
  // Poll only while the initiating wallet/network is still authorized.
  for (let attempt = 0; attempt < 90; attempt++) {
    assertWaiting()
    if (typeof document !== 'undefined' && document.hidden) {
      await pause(); continue
    }
    const receipt = await client.provider.getTransactionReceipt(transaction.hash)
    assertWaiting()
    if (receipt) {
      if (receipt.status !== 1) throw appError('PRECHECK_FAILED')
      return receipt
    }
    await pause()
  }
  throw Object.assign(appError('PENDING_TRANSACTION'), { hash: transaction.hash })
}
