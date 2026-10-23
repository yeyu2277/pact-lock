<template>
  <div class="site-layout">
    <a class="skip-link" href="#main-content">{{ $t('common.skip') }}</a>
    <WalletBridge />
    <SiteHeader />
    <main id="main-content"><slot /></main>
    <SiteFooter />
    <TransactionDialog />
  </div>
</template>
