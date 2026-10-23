<script setup>
defineProps({ name: { type: String, required: true } })
</script>
<template><UIcon :name="'i-pact-' + name" class="site-icon" aria-hidden="true" /></template>
