<script setup>
const props = defineProps({ phase: String, prepared: Boolean })
const { t } = useI18n()
const step = computed(() => ['pending', 'unconfirmed', 'success'].includes(props.phase) ? 2 : props.phase === 'signing' || props.phase === 'error' && props.prepared ? 1 : 0)
const items = computed(() => ['preflight', 'signature', 'confirmation'].map((name, index) => ({ title: t('tx.steps.' + name), index })))
</script>
<template>
  <UStepper :model-value="step" :items="items" disabled size="sm" class="transaction-progress" :ui="{ trigger: '!opacity-100 pointer-events-none', title: 'text-xs font-normal', wrapper: 'text-center' }">
    <template #indicator="{ item }"><SiteIcon v-if="item.index < step || phase === 'success'" name="check" /></template>
  </UStepper>
</template>
