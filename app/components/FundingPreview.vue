<script setup>
import { formatAmount } from '~/utils/format.js'
defineProps({ values: Object, token: Object, role: [String, Number], loading: Boolean, disabled: Boolean })
defineEmits(['submit'])
const { t } = useI18n()
</script>
<template>
  <aside class="funding-preview">
    <h2>{{ t('create.preview') }}</h2>
    <dl>
      <div><dt>{{ t('create.identity') }}</dt><dd>{{ t(Number(role) === 0 ? 'common.payer' : 'common.payee') }}</dd></div>
      <div><dt>{{ t('create.myFunding') }}</dt><dd class="funding-main">{{ formatAmount(values?.mine, token?.decimals) }} {{ token?.symbol }}</dd></div>
      <div><dt>{{ t('create.otherFunding') }}</dt><dd>{{ formatAmount(values?.other, token?.decimals) }} {{ token?.symbol }}</dd></div>
      <div><dt>{{ t('create.total') }}</dt><dd>{{ formatAmount(values?.total, token?.decimals) }} {{ token?.symbol }}</dd></div>
    </dl>
    <div class="payout-preview">
      <h3>{{ t('create.payout') }}</h3>
      <dl><div><dt>{{ t('create.myPayout') }} ({{ t(Number(role) === 0 ? 'common.payer' : 'common.payee') }})</dt><dd>{{ formatAmount(values?.myPayout, token?.decimals) }} {{ token?.symbol }}</dd></div>
      <div><dt>{{ t('create.otherPayout') }}</dt><dd>{{ formatAmount(values?.otherPayout, token?.decimals) }} {{ token?.symbol }}</dd></div></dl>
    </div>
    <img class="funding-helper" src="/images/pact/confirmation-helper.png" alt="" width="150" height="150" loading="lazy">
    <UButton size="xl" class="create-submit" :loading="loading" :disabled="disabled" trailing-icon="i-pact-arrow-right" @click="$emit('submit')">{{ t('create.submit') }}</UButton>
    <p class="preflight-caption">{{ t('create.preflight') }}</p><p class="gas-caption"><SiteIcon name="info" />{{ t('common.gas') }}</p>
  </aside>
</template>
