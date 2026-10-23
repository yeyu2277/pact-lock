<script setup>
import { computed } from 'vue'
import { orderLifecycle } from '~/contracts/presentation.js'

const props = defineProps({ order: { type: Object, default: null } })
const { t } = useI18n()
const lifecycle = computed(() => orderLifecycle(props.order))
const cancelled = computed(() => Number(props.order?.state) === 4)
const confirmations = computed(() => Number(Boolean(props.order?.payerConfirmed)) + Number(Boolean(props.order?.payeeConfirmed)))
const shortLabel = label => label.startsWith('order.lifecycle.') ? label.replace('order.lifecycle.', 'order.lifecycleShort.') : label
</script>

<template>
  <div class="lifecycle" :class="{ cancelled }" role="list" :aria-label="t('order.progress')">
    <div v-for="(label, i) in lifecycle.items" :key="label" role="listitem" :aria-label="t(label)" :aria-current="i === lifecycle.step ? 'step' : undefined" :class="{ complete: i < lifecycle.step, current: i === lifecycle.step, 'lifecycle-intermediate': !cancelled && i > 0 && i < 4 }">
      <span class="lifecycle-dot" aria-hidden="true"><SiteIcon v-if="i < lifecycle.step" name="check" /></span>
      <span class="lifecycle-label-full">{{ t(label) }}</span>
      <span class="lifecycle-label-short" aria-hidden="true">{{ t(shortLabel(label)) }}</span>
      <small v-if="label === 'order.lifecycle.3' && Number(order?.state) === 3">{{ confirmations }} / 2</small>
    </div>
  </div>
</template>
