import { resolvePactConfig } from '~/config/runtime.js'

export function usePactConfig() {
  const app = useNuxtApp()
  return app._pactRuntimeConfig ||= resolvePactConfig(useRuntimeConfig().public)
}
