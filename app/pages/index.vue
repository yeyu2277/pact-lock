<script setup>
import { readCreatedOrderCount } from '~/contracts/client.js'
const { networkById, defaultChainId } = usePactConfig()
const { t } = useI18n()
const localePath = useLocalePath()
const wallet = useWalletSession()
const count = ref(null), countError = ref(false), loading = ref(false)
const countNetwork = computed(() => networkById(wallet.connected.value ? wallet.chainId.value : defaultChainId))
const sources = ['hero-promise', 'hero-promise', 'flow-activation', 'confirmation-helper', 'confirmation-helper', 'claim-celebration']
const illustrationSizes = {
  'hero-promise': { width: 1448, height: 1086 },
  'flow-activation': { width: 1448, height: 1086 },
  'confirmation-helper': { width: 1254, height: 1254 },
  'claim-celebration': { width: 1448, height: 1086 },
}
const walkthrough = ref(null)
const activeStage = ref(0)
const motionReady = ref(false)
let stopWalkthrough = () => {}
let request = 0
async function loadCount(force = false) {
  const id = ++request
  count.value = null; countError.value = false
  if (!import.meta.client) return
  loading.value = true
  try {
    const value = await readCreatedOrderCount(countNetwork.value, { force })
    if (id === request) count.value = value
  } catch { if (id === request) countError.value = true }
  finally { if (id === request) loading.value = false }
}
watch(countNetwork, () => loadCount(), { immediate: true })
function scrollToStage(index) { document.getElementById('flow-' + index)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }) }
function scrollToTop() { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }
usePactSeo('home')
onMounted(() => {
  const sections = [...walkthrough.value.querySelectorAll('.flow-section')]
  let frame = 0
  function updateStage() {
    frame = 0
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0
    const focusLine = headerBottom + (window.innerHeight - headerBottom) / 2
    const index = sections.findIndex(section => section.getBoundingClientRect().bottom > focusLine)
    activeStage.value = index < 0 ? sections.length - 1 : index
  }
  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(updateStage)
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-revealed')
      observer.unobserve(entry.target)
    }
  }, { threshold: 0.1 })
  walkthrough.value.querySelectorAll('.flow-copy, .flow-art').forEach(element => observer.observe(element))
  motionReady.value = true
  window.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate)
  updateStage()
  stopWalkthrough = () => {
    observer.disconnect()
    window.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
    cancelAnimationFrame(frame)
  }
})
onBeforeUnmount(() => { request++; stopWalkthrough() })
</script>
<template>
  <div class="home-page">
    <section class="hero-section">
      <div class="hero-main">
        <div class="hero-copy">
          <p class="eyebrow">{{ t('home.eyebrow') }}</p>
          <h1 class="hero-title"><span>{{ t('home.headline1') }}</span><span>{{ t('home.headline2') }}</span></h1>
          <p class="hero-description">{{ t('home.description') }}</p>
          <div class="hero-actions">
            <UButton :to="localePath('/orders/new')" size="xl" trailing-icon="i-pact-arrow-right">{{ t('nav.create') }}</UButton>
            <UButton :to="localePath('/orders')" size="xl" color="neutral" variant="outline" icon="i-pact-magnifying-glass">{{ t('nav.orders') }}</UButton>
          </div>
          <div class="hero-stat" :aria-busy="loading">
            <strong>{{ count === null ? (countError ? '-' : '…') : BigInt(count).toLocaleString() }}</strong>
            <div><span>{{ t('home.count') }}</span><small>{{ countNetwork?.name || 'Polygon Amoy' }} <template v-if="countNetwork?.testnet ?? true">{{ t('common.testnet') }}</template></small></div>
            <UButton v-if="countError" color="neutral" variant="ghost" icon="i-pact-arrows-clockwise" :aria-label="t('home.countError')" @click="loadCount(true)" />
          </div>
        </div>
        <div class="hero-art">
          <div class="hero-art-frame">
          <span class="hero-speech">{{ t('home.meme') }}</span>
          <picture class="hero-scene">
            <source media="(min-width: 761px)" srcset="/images/pact/hero-promise-panorama.webp" width="1672" height="941">
            <img src="/images/pact/hero-promise-scene.webp" alt="" width="1448" height="1086" fetchpriority="high" decoding="async">
          </picture>
          <span class="hero-role hero-role-payer">{{ t('home.payer') }}</span><span class="hero-role hero-role-payee">{{ t('home.payee') }}</span>
          <p class="hero-boundary"><span>{{ t('home.boundary') }}</span></p>
          </div>
        </div>
      </div>
      <button class="hero-teaser" @click="scrollToStage(0)">
        <span class="teaser-count"><strong>01</strong> / 06<span class="teaser-bars"><i v-for="i in 6" :key="i" :class="{ active: i === 1 }" /></span></span>
        <span class="teaser-copy"><strong>{{ t('flow.steps.0.title') }}</strong><small>{{ t('home.stepIntro') }}</small></span>
        <span class="teaser-scroll"><SiteIcon name="arrow-down" /><small>{{ t('home.scroll') }}</small></span>
      </button>
    </section>
    <div ref="walkthrough" class="flow-walkthrough" :class="{ 'motion-ready': motionReady }">
    <div class="flow-stages">
    <section v-for="(source, index) in sources" :id="'flow-' + index" :key="index" class="flow-section">
      <div class="flow-inner">
        <div class="flow-copy">
          <p class="eyebrow">{{ String(index + 1).padStart(2, '0') }} / 06 · {{ t('flow.steps.' + index + '.title') }}</p>
          <h2><span v-for="(line, lineIndex) in t('flow.steps.' + index + '.headline').split('\n')" :key="lineIndex" class="flow-headline-line" :style="{ '--line-index': lineIndex }">{{ line }}</span></h2>
          <p class="flow-description">{{ t('flow.steps.' + index + '.description') }}</p>
          <div v-if="index === 2" class="activation-branches">
            <div><SiteIcon name="users" /><span>{{ t('flow.public') }}</span><SiteIcon name="arrow-right" /><span>{{ t('flow.creatorConfirm') }}</span><SiteIcon name="check-circle" /></div>
            <div><SiteIcon name="user-plus" /><span>{{ t('flow.designated') }}</span><SiteIcon name="arrow-right" /><span>{{ t('flow.accepted') }}</span><SiteIcon name="check-circle" /></div>
          </div>
          <p class="flow-note"><SiteIcon name="info" />{{ t('flow.steps.' + index + '.note') }}</p>
          <NuxtLink v-if="index === 5" class="accent-link" :to="localePath('/guide')">{{ t('home.fullGuide') }}<SiteIcon name="arrow-right" /></NuxtLink>
        </div>
        <div class="flow-art"><span class="flow-speech">{{ t('flow.steps.' + index + '.meme') }}</span><img :src="'/images/pact/' + source + '.png'" alt="" :width="illustrationSizes[source].width" :height="illustrationSizes[source].height" loading="lazy" decoding="async"></div>
      </div>
    </section>
    </div>
    <nav class="flow-navigation" :aria-label="t('nav.guide')">
      <UButton class="flow-nav-action" color="neutral" variant="ghost" icon="i-pact-arrow-left" :aria-label="t('common.previous')" :disabled="activeStage === 0" @click="scrollToStage(activeStage - 1)"><span class="flow-nav-label">{{ t('common.previous') }}</span></UButton>
      <div class="flow-dots"><button v-for="i in sources.length" :key="i" :class="{ active: i === activeStage + 1 }" :aria-label="t('flow.steps.' + (i - 1) + '.title')" :aria-current="i === activeStage + 1 ? 'step' : undefined" @click="scrollToStage(i - 1)">{{ String(i).padStart(2, '0') }}</button></div>
      <UButton v-if="activeStage < sources.length - 1" class="flow-nav-action" color="neutral" variant="ghost" trailing-icon="i-pact-arrow-right" :aria-label="t('common.next')" @click="scrollToStage(activeStage + 1)"><span class="flow-nav-label">{{ t('common.next') }}</span></UButton>
      <UButton v-else class="flow-nav-action" color="neutral" variant="ghost" icon="i-pact-arrow-down" :ui="{ leadingIcon: 'rotate-180' }" :aria-label="t('nav.backToTop')" @click="scrollToTop"><span class="flow-nav-label">{{ t('nav.backToTop') }}</span></UButton>
    </nav>
    </div>
  </div>
</template>
