export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    theme: 'system',
  }),
  actions: {
    setTheme(theme) {
      if (['light', 'dark', 'system'].includes(theme)) {
        this.theme = theme
      }
    },
  },
  // Cookies are available to both SSR and the browser during hydration.
  persist: {
    pick: ['theme'],
  },
})
