<script setup>
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import SuspendedBanner from './components/SuspendedBanner.vue'
</script>

<template>
  <SiteHeader />
  <SuspendedBanner />
  <router-view />
  <SiteFooter />
</template>
