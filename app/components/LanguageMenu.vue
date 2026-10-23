<script setup>
const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const { trigger, content } = useDropdownFocus()
function selectLocale(code) {
  if (code === locale.value) return
  const path = switchLocalePath(code)
  if (path) return navigateTo(path)
}
const current = computed(() => locales.value.find(item => item.code === locale.value))
const items = computed(() => locales.value.map(item => ({
  label: item.name || item.code,
  type: 'checkbox', checked: item.code === locale.value,
  onSelect: () => selectLocale(item.code),
})))
</script>
<template>
  <UDropdownMenu :items="items" :modal="false" :content="{ align: 'end', ...content }" :ui="{ content: 'language-options min-w-48 max-h-80 overflow-y-auto' }">
    <UButton ref="trigger" color="neutral" variant="ghost" class="language-trigger" icon="i-pact-globe" trailing-icon="i-pact-caret-down" :aria-label="t('app.language')">
      <span>{{ current?.name || locale }}</span>
    </UButton>
  </UDropdownMenu>
</template>
