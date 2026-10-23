<script setup>
import { isOrderId, shortenOrderId } from '~/utils/format.js'
const { t } = useI18n()
const localePath = useLocalePath()
const access = useDapp()
const recent = useRecentOrders(access)
const { notify, message } = useAppFeedback()
const input = ref(''), loading = ref(false), error = ref('')
const errorId = useId()
usePactSeo('query')
async function search() {
  error.value = ''
  if (!isOrderId(input.value.trim())) { error.value = t('query.invalid'); return }
  loading.value = true
  const key = access.key.value
  try {
    access.guard()
    const order = await access.client().getOrder(input.value.trim(), { force: true })
    if (key !== access.key.value) return
    await recent.remember(order)
    await navigateTo(localePath('/orders/' + access.chainId.value + '/' + order.id))
  } catch (cause) { if (key === access.key.value) error.value = message(cause) }
  finally { loading.value = false }
}
async function paste() {
  try { input.value = await navigator.clipboard.readText() } catch (cause) { notify(cause) }
}
</script>
<template>
  <div class="page-shell query-page">
    <div class="page-heading centered"><h1>{{ t('query.title') }}</h1><p>{{ t('query.description') }}</p></div>
    <WalletGate>
      <form class="query-form" @submit.prevent="search">
        <UFormField :label="t('common.network')"><NetworkMenu /></UFormField>
        <UFormField :label="t('common.id')" class="query-input-field">
          <UInput v-model="input" :placeholder="t('query.placeholder')" :color="error ? 'error' : undefined" :highlight="!!error" :aria-invalid="!!error" :aria-describedby="error ? errorId : undefined" size="xl" class="w-full" spellcheck="false" autocomplete="off" :ui="{ trailing: 'pe-2' }">
            <template #trailing><UButton color="neutral" variant="ghost" icon="i-pact-clipboard-text" :aria-label="t('query.paste')" @click="paste" /></template>
          </UInput>
        </UFormField>
        <UButton type="submit" icon="i-pact-magnifying-glass" size="xl" :loading="loading">{{ t('common.search') }}</UButton>
        <p v-if="error" :id="errorId" class="query-error form-error" role="alert">{{ error }}</p>
        <p class="query-help">{{ t('query.help') }}</p>
      </form>
      <section class="recent-section">
        <div class="section-heading"><h2>{{ t('query.recent') }}</h2><UButton color="primary" variant="ghost" icon="i-pact-trash" :disabled="!recent.records.value.length" @click="recent.clear">{{ t('common.clear') }}</UButton></div>
        <div v-if="recent.records.value.length" class="recent-list">
          <NuxtLink v-for="record in recent.records.value" :key="record.id" :to="localePath('/orders/' + record.chainId + '/' + record.id)" class="recent-row"><span>{{ shortenOrderId(record.id) }}</span><OrderStatus :state="record.state" /><SiteIcon name="arrow-right" /></NuxtLink>
        </div>
        <EmptyState v-else :title="t('query.emptyTitle')" :description="t('query.emptyDescription')" />
      </section>
      <NuxtLink class="query-new-link" :to="localePath('/orders/new')">{{ t('query.new') }}<SiteIcon name="arrow-right" /></NuxtLink>
    </WalletGate>
  </div>
</template>
