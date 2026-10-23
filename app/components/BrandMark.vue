<script setup>
import { site } from '~/config/site.js'

defineProps({ compact: Boolean })
const localePath = useLocalePath()
</script>
<template>
  <NuxtLink :to="localePath('/')" class="brand" aria-label="Pact Lock">
    <img :src="site.logo" class="brand-symbol" alt="" width="875" height="1055">
    <span v-if="!compact">Pact Lock</span>
  </NuxtLink>
</template>
