<script setup>
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import SuspendedBanner from './components/SuspendedBanner.vue'
import LoginModal from './components/LoginModal.vue'
import AppDialog from './components/AppDialog.vue'
import UserProfileCard from './components/UserProfileCard.vue'
</script>

<template>
  <SiteHeader />
  <SuspendedBanner />
  <router-view />
  <SiteFooter />
  <LoginModal />
  <AppDialog />
  <UserProfileCard />
</template>
