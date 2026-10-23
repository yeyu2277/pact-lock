export function useDropdownFocus() {
  const trigger = ref(null)
  let interactedOutside = false
  return {
    trigger,
    content: {
      onInteractOutside: () => { interactedOutside = true },
      onCloseAutoFocus(event) {
        event.preventDefault()
        if (!interactedOutside) trigger.value?.$el?.focus({ preventScroll: true })
        interactedOutside = false
      },
    },
  }
}
