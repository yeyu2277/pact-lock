import { reviewTransaction, prepareTransaction, prepareApproval, sendPrepared, waitForReceipt, orderIdFromReceipt } from '~/contracts/transactions.js'
import { rememberPending, forgetPending, indexOwnReceipt } from '~/contracts/pending.js'
import { namespace, writeRecord } from '~/contracts/storage.js'
import { claimable } from '~/contracts/model.js'
import { sameAddress } from '~/utils/format.js'
import { decodeError, appError } from '~/contracts/errors.js'

export function useTransaction() {
  const state = useState('pact-transaction', () => ({ open: false, phase: 'idle', action: '', summary: null, hash: '', orderId: '', error: '', approvalHash: '', preflightPassed: false }))
  const app = useNuxtApp()
  const context = () => app._pactTransaction
  const active = ctx => context() === ctx && !ctx.cancelled
  const assertActive = ctx => { if (!active(ctx)) throw appError('WAIT_CANCELLED') }
  const guardedIdentity = (ctx, identity) => ({ ...identity, assert() { assertActive(ctx); identity.assert() } })
  const busy = computed(() => ['reviewing', 'preparing', 'approving', 'signing', 'pending'].includes(state.value.phase))
  async function review(ctx) {
    ctx.identity.assert()
    state.value.phase = 'reviewing'
    const plan = await reviewTransaction(ctx.client, ctx.request, ctx.identity)
    assertActive(ctx)
    ctx.plan = plan
    const token = plan.order?.token || await ctx.client.token(plan.asset)
    assertActive(ctx)
    state.value.summary.amount = plan.funding.toString()
    state.value.summary.symbol = token.symbol
    state.value.summary.decimals = token.decimals
    if (ctx.request.method === 'claim') state.value.summary.claimAmount = claimable(plan.order, ctx.identity.address).toString()
    state.value.phase = plan.approval ? 'approval' : 'ready'
  }
  async function prepare(access, request) {
    if (busy.value || state.value.open && ['approval', 'approved', 'ready'].includes(state.value.phase)) return
    access.guard()
    const client = access.client(), identity = access.identity()
    const ctx = { access, client, request, plan: null, cancelled: false, controller: new AbortController(), hash: '', orderId: request.method === 'createOrder' ? '' : request.args?.[0] || '' }
    ctx.identity = guardedIdentity(ctx, identity)
    app._pactTransaction = ctx
    state.value = { open: true, phase: 'reviewing', action: request.method, summary: { network: client.network.name, chainId: client.network.chainId, amount: '0', symbol: '', decimals: 18, recipient: request.method === 'claim' ? request.args[1] : '', claimAmount: null }, hash: '', orderId: ctx.orderId, error: '', approvalHash: '', preflightPassed: false }
    try { await review(ctx) }
    catch (error) { if (active(ctx)) { state.value.error = decodeError(error); state.value.phase = 'error' } }
  }
  async function track(ctx, transaction, method, approvalStep = '') {
    // A wallet may return a broadcast hash after the user has stopped waiting.
    // Save it under the original wallet/network without reviving or changing a later dialog.
    ctx.hash = transaction.hash
    ctx.pendingApproval = approvalStep
    if (active(ctx)) { state.value.hash = transaction.hash; state.value.phase = 'pending' }
    await rememberPending(ctx.client.network, ctx.identity.address, { hash: transaction.hash, method, orderId: ctx.orderId, timestamp: Date.now() })
    assertActive(ctx)
    const receipt = await waitForReceipt(ctx.client, transaction, ctx.identity, { signal: ctx.controller.signal })
    assertActive(ctx)
    return receipt
  }
  async function finishApproval(ctx) {
    ctx.identity.assert()
    const reset = ctx.pendingApproval === 'reset'
    await forgetPending(ctx.client.network, ctx.identity.address, ctx.hash)
    assertActive(ctx)
    if (!reset) state.value.approvalHash = ctx.hash
    ctx.hash = ''
    state.value.hash = ''
    state.value.error = ''
    ctx.pendingApproval = ''
    if (reset) ctx.plan.reset = false
    // Defer the contract preflight until the user continues to the wallet.
    state.value.phase = reset ? 'approval' : 'approved'
  }
  async function proceed() {
    if (busy.value || !context()) return
    const ctx = context()
    try {
      ctx.identity.assert()
      if (state.value.phase === 'approval') {
        state.value.phase = 'approving'
        if (ctx.plan.reset) {
          const reset = await prepareApproval(ctx.client, ctx.plan, ctx.identity, 0n)
          ctx.identity.assert()
          state.value.phase = 'signing'
          await track(ctx, await sendPrepared(ctx.client, { ...reset, approval: true, asset: ctx.plan.asset }, ctx.identity, ctx.access.wallet.getSigner), 'approve', 'reset')
          await finishApproval(ctx)
          ctx.identity.assert()
        }
        state.value.phase = 'approving'
        const approval = await prepareApproval(ctx.client, ctx.plan, ctx.identity, ctx.plan.funding)
        ctx.identity.assert()
        state.value.phase = 'signing'
        await track(ctx, await sendPrepared(ctx.client, { ...approval, approval: true, asset: ctx.plan.asset }, ctx.identity, ctx.access.wallet.getSigner), 'approve', 'grant')
        await finishApproval(ctx)
        return
      }
      if (!['ready', 'approved'].includes(state.value.phase)) return
      // Read fresh state and simulate once, immediately before requesting the signature.
      state.value.phase = 'preparing'
      state.value.preflightPassed = false
      const plan = await prepareTransaction(ctx.client, ctx.request, ctx.identity)
      ctx.identity.assert()
      ctx.plan = plan
      if (plan.approval) { state.value.phase = 'approval'; return }
      state.value.preflightPassed = true
      state.value.phase = 'signing'
      const transaction = await sendPrepared(ctx.client, plan, ctx.identity, ctx.access.wallet.getSigner)
      const receipt = await track(ctx, transaction, ctx.request.method)
      await finish(ctx, receipt)
    } catch (error) {
      if (!active(ctx)) return
      state.value.error = decodeError(error)
      state.value.phase = state.value.hash ? 'unconfirmed' : 'error'
    }
  }
  async function finish(ctx, receipt) {
    ctx.identity.assert()
    const id = ctx.request.method === 'createOrder' ? orderIdFromReceipt(receipt, ctx.client.network.pactLock.address) : ctx.orderId
    if (ctx.request.method === 'createOrder' && !id) throw appError('RPC_ERROR')
    ctx.orderId = id || ''
    state.value.orderId = ctx.orderId
    ctx.client.invalidate(id)
    await indexOwnReceipt(ctx.client.network, ctx.identity.address, receipt)
    assertActive(ctx)
    await forgetPending(ctx.client.network, ctx.identity.address, ctx.hash)
    assertActive(ctx)
    if (id) {
      // The receipt is authoritative even if a follow-up RPC read is temporarily unavailable.
      try {
        const order = await ctx.client.getOrder(id, { force: true })
        assertActive(ctx)
        await writeRecord(namespace(ctx.client.network, ctx.identity.address) + ':snapshot:' + id.toLowerCase(), order)
      } catch {}
    }
    assertActive(ctx)
    state.value.phase = 'success'
    // Navigation or a UI refresh cannot change an already confirmed transaction.
    try { await ctx.request.onSuccess?.({ id, receipt }) } catch {}
  }
  async function recheck() {
    const ctx = context()
    if (!ctx || busy.value || ctx.checking || !ctx.hash) return
    ctx.checking = true
    try {
      const identity = ctx.access.identity()
      if (!sameAddress(identity.address, ctx.identity.address) || identity.chainId !== ctx.identity.chainId) throw appError('SESSION_CHANGED')
      ctx.identity = guardedIdentity(ctx, identity)
      ctx.identity.assert()
      const receipt = await ctx.client.provider.getTransactionReceipt(ctx.hash)
      ctx.identity.assert()
      if (!receipt) return
      if (receipt.status !== 1) {
        await forgetPending(ctx.client.network, ctx.identity.address, ctx.hash)
        assertActive(ctx)
        state.value.phase = 'error'; state.value.error = 'PRECHECK_FAILED'; return
      }
      if (ctx.pendingApproval) await finishApproval(ctx)
      else await finish(ctx, receipt)
    } catch (error) { if (active(ctx)) state.value.error = decodeError(error) }
    finally { ctx.checking = false }
  }
  function close() {
    const ctx = context()
    if (ctx) { ctx.cancelled = true; ctx.controller.abort(); app._pactTransaction = undefined }
    // This stops the website flow, not an already-open wallet prompt or a broadcast transaction.
    state.value.open = false
    if (busy.value) state.value.phase = 'idle'
  }
  return { state, busy, prepare, proceed, recheck, close }
}
