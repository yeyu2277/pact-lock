<script setup>
import { ZeroAddress, MaxUint256 } from 'ethers'
import { parseAmount, sameAddress, validAddress, formatAmount } from '~/utils/format.js'
const { defaultNetwork: fallbackNetwork } = usePactConfig()

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const access = useDapp()
const feedback = useAppFeedback()
const tx = useTransaction()
const token = ref(null), balance = ref(null)
const form = reactive({ role: '0', mode: 'public', counterparty: '', payment: '', payerDeposit: '', payeeDeposit: '', agreed: false })
const submitted = ref(false), localError = ref('')
const currentNetwork = computed(() => access.network.value || fallbackNetwork)
function nativeToken() { const n = currentNetwork.value; return { address: ZeroAddress, symbol: n.nativeSymbol, decimals: n.nativeDecimals, icon: n.icon, native: true } }
watch(() => currentNetwork.value.chainId, () => { token.value = nativeToken(); balance.value = null }, { immediate: true })
const values = computed(() => {
  try {
    const decimals = token.value.decimals
    const payment = parseAmount(form.payment, decimals), payer = parseAmount(form.payerDeposit, decimals, { positive: true }), payee = parseAmount(form.payeeDeposit, decimals, { positive: true })
    if (payment + payer + payee > MaxUint256) return null
    const payerRole = Number(form.role) === 0
    return { payment, payer, payee, mine: payerRole ? payment + payer : payee, other: payerRole ? payee : payment + payer, total: payment + payer + payee, myPayout: payerRole ? payer : payment + payee, otherPayout: payerRole ? payment + payee : payer }
  } catch { return null }
})
const fieldError = key => {
  if (!submitted.value) return undefined
  try { parseAmount(form[key], token.value.decimals, { positive: key !== 'payment' }); return undefined }
  catch { return t('errors.INVALID_AMOUNT') }
}
let balanceRequest = 0
watch([access.ready, access.key, () => token.value?.address], async () => {
  const request = ++balanceRequest
  balance.value = null
  if (!import.meta.client || !access.ready.value || !token.value) return
  try {
    const value = await access.client().getBalance(token.value.address, access.wallet.address.value)
    if (request === balanceRequest) balance.value = value
  } catch {}
}, { immediate: true })
async function submit() {
  submitted.value = true; localError.value = ''
  if (!values.value || !form.agreed) { localError.value = t('create.required'); return }
  let designated = ZeroAddress
  if (form.mode === 'designated') {
    designated = validAddress(form.counterparty.trim())
    if (!designated || sameAddress(designated, ZeroAddress) || sameAddress(designated, access.wallet.address.value) || sameAddress(designated, access.network.value.pactLock.address)) {
      localError.value = t('errors.InvalidCounterparty'); return
    }
  }
  const amounts = values.value, chainId = access.chainId.value, sourcePath = route.fullPath
  try {
    await tx.prepare(access, {
      method: 'createOrder', asset: token.value.address, funding: amounts.mine,
      args: [Number(form.role), designated, token.value.address, amounts.payment, amounts.payer, amounts.payee],
      onSuccess: async ({ id }) => { if (route.fullPath === sourcePath) await navigateTo(localePath('/orders/' + chainId + '/' + id)) },
    })
  } catch (error) { feedback.notify(error) }
}
usePactSeo('create')
</script>
<template>
  <div class="page-shell create-page">
    <WalletGate>
      <div class="create-layout">
        <div class="create-main">
          <div class="page-heading"><h1>{{ t('create.title') }}</h1><p>{{ t('create.description') }}</p></div>
          <form id="create-order-form" @submit.prevent="submit">
            <section class="form-section"><div class="form-section-title"><span>1</span><h2>{{ t('create.role') }}</h2></div><div class="form-section-body"><div class="choice-row">
              <label :class="{ selected: form.role === '0' }"><input v-model="form.role" type="radio" value="0">{{ t('common.payer') }}</label>
              <label :class="{ selected: form.role === '1' }"><input v-model="form.role" type="radio" value="1">{{ t('common.payee') }}</label>
            </div><p class="field-hint">{{ t(form.role === '0' ? 'create.payerHint' : 'create.payeeHint') }}</p></div></section>
            <section class="form-section"><div class="form-section-title"><span>2</span><h2>{{ t('create.mode') }}</h2></div><div class="form-section-body"><div class="choice-row">
              <label :class="{ selected: form.mode === 'public' }"><input v-model="form.mode" type="radio" value="public">{{ t('create.public') }}</label>
              <label :class="{ selected: form.mode === 'designated' }"><input v-model="form.mode" type="radio" value="designated">{{ t('create.designated') }}</label>
            </div><p class="field-hint">{{ t(form.mode === 'public' ? 'create.publicHint' : 'create.designatedHint') }}</p>
            <UFormField v-if="form.mode === 'designated'" :label="t('create.counterparty')" class="designated-input"><UInput v-model="form.counterparty" :placeholder="t('create.counterpartyPlaceholder')" class="w-full" spellcheck="false" autocomplete="off" /></UFormField></div></section>
            <section class="form-section"><div class="form-section-title"><span>3</span><h2>{{ t('create.asset') }}</h2></div><div class="form-section-body"><AssetPicker v-model="token" :access="access" /><p class="field-hint">{{ t('create.assetHelp') }}</p>
              <p v-if="!token?.native" class="token-warning">{{ t('create.untrusted') }}</p><p v-if="balance !== null" class="field-hint">{{ t('common.balance') }}: {{ formatAmount(balance, token.decimals) }} {{ token.symbol }}</p>
            </div></section>
            <section class="form-section"><div class="form-section-title"><span>4</span><h2>{{ t('create.amounts') }}</h2></div><div class="form-section-body"><div class="amount-fields">
              <UFormField v-for="key in ['payment', 'payerDeposit', 'payeeDeposit']" :key="key" :label="t('create.' + key)" :error="fieldError(key)">
                <UInput v-model="form[key]" inputmode="decimal" :placeholder="key === 'payment' ? '100' : '20'" class="w-full" :aria-label="t('create.' + key)"><template #trailing><span class="input-symbol">{{ token?.symbol }}</span></template></UInput>
              </UFormField></div><p class="field-hint">{{ t('create.amountHint') }}</p></div></section>
            <section class="form-section agreement-section"><div class="form-section-title"><span>5</span><h2>{{ t('create.acknowledgement') }}</h2></div><div class="form-section-body"><UCheckbox v-model="form.agreed" :label="t('create.agreement')" :ui="{ root: 'items-center' }" /></div></section>
            <p v-if="localError" class="form-error" role="alert">{{ localError }}</p>
          </form>
        </div>
        <FundingPreview :values="values" :token="token" :role="form.role" :loading="tx.busy.value" @submit="submit" />
      </div>
    </WalletGate>
  </div>
</template>
