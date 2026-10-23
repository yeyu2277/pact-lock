import { decodeError } from '~/contracts/errors.js'

export function useAppFeedback() {
  const { t, te } = useI18n()
  const toast = useToast()
  const app = useNuxtApp()
  const recent = app._pactFeedbackTimes ||= new Map()
  function show(options) {
    const id = 'pact-feedback:' + JSON.stringify([options.color, options.title, options.description || ''])
    const now = Date.now(), previous = recent.get(id)
    for (const [key, time] of recent) if (now - time >= 1500) recent.delete(key)
    recent.set(id, now)
    // Show the first result immediately. Suppress repeated clicks, including
    // before Nuxt UI has flushed its toast queue and across component instances.
    if (previous !== undefined && now - previous < 1500) return
    if (toast.toasts.value.some(item => item.id === id && item.open !== false)) return
    return toast.add({ ...options, id })
  }
  function message(error) {
    const key = 'errors.' + decodeError(error)
    return t(te(key) ? key : 'errors.RPC_ERROR')
  }
  function notify(error) { return show({ title: t('common.error'), description: message(error), color: 'error' }) }
  return { message, notify, success: text => show({ title: text, color: 'success' }) }
}
