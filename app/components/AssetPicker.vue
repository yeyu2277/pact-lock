<script setup>
const props = defineProps({ modelValue: Object, access: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const feedback = useAppFeedback()
const open = ref(false), search = ref(''), address = ref(''), verifying = ref(false)
const pendingAddress = ref(''), selectionSource = ref('')
let selectionRun = 0
const presets = computed(() => (props.access.network.value?.tokens || []).filter(token => (token.name + token.symbol + token.address).toLowerCase().includes(search.value.toLowerCase())))
const isSelecting = tokenAddress => verifying.value && pendingAddress.value === tokenAddress.toLowerCase()
function resetSelection() {
  selectionRun++; verifying.value = false; pendingAddress.value = ''; selectionSource.value = ''
}
watch(() => props.access.key.value, resetSelection, { flush: 'sync' })
onScopeDispose(resetSelection)
async function choose(tokenAddress, source = 'preset') {
  if (verifying.value) return
  const run = ++selectionRun
  pendingAddress.value = tokenAddress.toLowerCase(); selectionSource.value = source
  verifying.value = true
  try {
    props.access.guard()
    const key = props.access.key.value
    const token = await props.access.client().token(tokenAddress)
    if (run !== selectionRun || key !== props.access.key.value) return
    emit('update:modelValue', token); open.value = false
  } catch (error) { if (run === selectionRun) feedback.notify(error) }
  finally { if (run === selectionRun) resetSelection() }
}
</script>
<template>
  <UPopover v-model:open="open" :content="{ align: 'start', collisionPadding: 16 }" :ui="{ content: 'z-50' }">
    <UButton color="neutral" variant="outline" trailing-icon="i-pact-caret-down" class="asset-trigger" :loading="verifying">
      <img v-if="modelValue?.icon" :src="modelValue.icon" width="28" height="28" alt=""><SiteIcon v-else name="coins" />
      <span>{{ modelValue?.symbol || '—' }} · {{ t(modelValue?.native ? 'common.native' : 'common.custom') }}</span>
    </UButton>
    <template #content>
      <div class="asset-popover">
        <div v-if="verifying" class="asset-verification-status" role="status" aria-live="polite"><SiteIcon name="spinner-gap" class="animate-spin" /><span>{{ t('create.verifyingToken') }}</span></div>
        <h3>{{ t('create.selectAsset') }}</h3>
        <UInput v-model="search" icon="i-pact-magnifying-glass" :placeholder="t('create.assetSearch')" :aria-label="t('create.assetSearch')" :disabled="verifying" class="w-full" />
        <button class="token-option" :class="{ 'is-verifying': isSelecting('0x0000000000000000000000000000000000000000') }" :disabled="verifying" :aria-busy="isSelecting('0x0000000000000000000000000000000000000000')" @click="choose('0x0000000000000000000000000000000000000000')">
          <img :src="access.network.value?.icon" width="30" height="30" alt="">
          <span>{{ access.network.value?.nativeSymbol }}<small>{{ t('common.native') }}</small></span><SiteIcon v-if="isSelecting('0x0000000000000000000000000000000000000000')" name="spinner-gap" class="animate-spin" /><SiteIcon v-else-if="modelValue?.native" name="check" />
        </button>
        <button v-for="token in presets" :key="token.address" class="token-option" :class="{ 'is-verifying': isSelecting(token.address) }" :disabled="verifying" :aria-busy="isSelecting(token.address)" @click="choose(token.address)">
          <img v-if="token.icon" :src="token.icon" width="30" height="30" alt=""><SiteIcon v-else name="coins" />
          <span>{{ token.symbol }}<small>{{ token.name }}</small><code class="token-contract-address" :aria-label="t('create.tokenAddress') + ': ' + token.address">{{ token.address }}</code></span>
          <SiteIcon v-if="isSelecting(token.address)" name="spinner-gap" class="animate-spin" />
        </button>
        <p v-if="!presets.length" class="muted asset-no-presets">{{ t('create.noPresets') }}</p>
        <div class="custom-token">
          <label for="custom-token-address">{{ t('common.custom') }}</label>
          <div class="custom-token-input">
            <UInput id="custom-token-address" v-model="address" :placeholder="t('create.tokenAddress')" spellcheck="false" autocomplete="off" :disabled="verifying" class="w-full" />
            <UButton color="neutral" variant="outline" :loading="verifying && selectionSource === 'custom'" :disabled="verifying || !address.trim()" @click="choose(address.trim(), 'custom')">{{ t('create.verify') }}</UButton>
          </div>
          <p class="muted">{{ t('create.verifyHint') }}</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
