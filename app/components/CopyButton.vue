<script setup>
import { copyText } from '~/utils/clipboard.js'
defineProps({ value: { type: String, required: true } })
const { t } = useI18n()
const feedback = useAppFeedback()
const copied = ref(false)
let timeout
async function copy(value) {
  try {
    await copyText(value)
    copied.value = true
    clearTimeout(timeout)
    timeout = setTimeout(() => { copied.value = false }, 1500)
  } catch { feedback.notify({ code: 'COPY_FAILED' }) }
}
onBeforeUnmount(() => clearTimeout(timeout))
</script>
<template>
  <UButton :icon="copied ? 'i-pact-check' : 'i-pact-copy'" :aria-label="copied ? t('common.copied') : t('common.copy')" :title="copied ? t('common.copied') : t('common.copy')" color="neutral" variant="ghost" size="sm" class="copy-button" :class="{ copied }" @click.stop="copy(value)" />
</template>
