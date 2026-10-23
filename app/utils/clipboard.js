export async function copyText(value) {
  if (!value) throw new Error('Nothing to copy')
  if (globalThis.navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(value))
    return
  }
  if (!globalThis.document) throw new Error('Clipboard unavailable')
  const previous = document.activeElement
  const input = document.createElement('textarea')
  input.value = String(value)
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  try {
    if (!document.execCommand('copy')) throw new Error('Copy failed')
  } finally {
    input.remove()
    previous?.focus?.()
  }
}
