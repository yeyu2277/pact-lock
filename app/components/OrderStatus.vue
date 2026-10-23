<script setup>
import { STATES } from '~/contracts/model.js'
const props = defineProps({ state: { type: [String, Number], default: 0 }, provisional: Boolean })
const { t } = useI18n()
const name = computed(() => STATES[Number(props.state)] || 'none')
</script>
<template><span class="order-status" :class="'status-' + name" :title="props.provisional ? t('account.provisional') : undefined">{{ t('state.' + name) }}</span></template>
