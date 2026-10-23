<script setup>
defineProps({ compact: Boolean })
const localePath = useLocalePath()
</script>
<template>
  <NuxtLink :to="localePath('/')" class="brand" aria-label="Pact Lock">
    <SiteIcon name="brand-lock" class="brand-symbol" />
    <span v-if="!compact">Pact Lock</span>
  </NuxtLink>
</template>
