import { resolvePactConfig } from '~~/app/config/runtime.js'

export default defineNitroPlugin(() => {
  // Reject invalid deployment settings at startup, before serving any pages.
  resolvePactConfig(useRuntimeConfig().public)
})
