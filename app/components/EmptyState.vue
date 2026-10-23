<script setup>
defineProps({ title: String, description: String, image: { type: String, default: 'empty-search' } })
</script>
<template><div class="empty-state"><img :src="'/images/pact/' + image + '.png'" alt="" width="220" height="190" loading="lazy"><h3>{{ title }}</h3><p>{{ description }}</p><slot /></div></template>
