import { ethers } from 'ethers'

export default defineNuxtPlugin(() => ({
  // Browser-only ethers utilities; Reown manages wallet connections separately.
  provide: { ethers },
}))
