export const useAccountStore = defineStore('account', {
  state: () => ({ scope: '', index: null, snapshots: {}, syncing: false, settingRange: false, refreshing: {}, phase: 'idle', error: '', volatile: false }),
  actions: {
    reset(scope) { this.$reset(); this.scope = scope },
    snapshot(order) { this.snapshots[order.id.toLowerCase()] = order },
  },
})
