<script setup>
import { formatAmount } from '~/utils/format.js'
const { t } = useI18n()
const localePath = useLocalePath()
const icons = ['file-text', 'user-circle', 'play', 'check', 'arrows-clockwise', 'wallet']
const faq = computed(() => Array.from({ length: 5 }, (_, i) => ({ label: t('guide.questions.' + i + '.q'), content: t('guide.questions.' + i + '.a') })))
usePactSeo('guide')
</script>
<template>
  <div class="page-shell guide-page">
    <div class="guide-layout">
      <div class="guide-main">
        <div class="page-heading"><h1>{{ t('guide.title') }}</h1><p>{{ t('guide.description') }}</p></div>
        <ol class="guide-timeline">
          <li v-for="(icon, index) in icons" :key="icon"><span class="guide-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="guide-step-icon"><SiteIcon :name="icon" /></span><div><h2>{{ t('flow.steps.' + index + '.title') }}</h2><p class="guide-long-copy">{{ t('flow.steps.' + index + '.description') }}</p><p class="guide-short-copy">{{ t('guide.shortSteps.' + index) }}</p></div></li>
        </ol>
        <section class="guide-faq"><h2>{{ t('guide.faq') }}</h2><UAccordion :items="faq" /></section>
      </div>
      <aside class="guide-sidebar">
        <section class="boundary-panel"><h2><SiteIcon name="warning-circle" />{{ t('guide.boundaryTitle') }}</h2><ul><li v-for="i in 4" :key="i"><SiteIcon :name="['x', 'lock', 'warning-circle', 'file-text'][i - 1]" />{{ t('guide.boundaries.' + (i - 1)) }}</li></ul></section>
        <section class="example-panel"><h2><SiteIcon name="coins" />{{ t('guide.example') }}<small>{{ t('guide.exampleLabel') }}</small></h2><dl><div v-for="(key, i) in ['payment', 'payerDeposit', 'payeeDeposit', 'payerPayout', 'payeePayout']" :key="key" :class="{ 'example-payout': i === 3 }"><dt>{{ t('guide.' + key) }}</dt><dd>{{ [100, 20, 20, 20, 120][i] }} POL</dd></div></dl></section>
        <img class="guide-mascots" src="/images/pact/hero-promise.png" alt="" width="520" height="390" loading="lazy">
        <UButton :to="localePath('/orders/new')" variant="link" trailing-icon="i-pact-arrow-right">{{ t('nav.create') }}</UButton>
      </aside>
    </div>
  </div>
</template>
