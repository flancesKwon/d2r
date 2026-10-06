<script setup>
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import SuspendedBanner from './components/SuspendedBanner.vue'
import LoginModal from './components/LoginModal.vue'
import AppDialog from './components/AppDialog.vue'
import UserProfileCard from './components/UserProfileCard.vue'
import TradeGuideModal from './components/TradeGuideModal.vue'
import MobileTabBar from './components/MobileTabBar.vue'
</script>

<template>
  <SiteHeader />
  <SuspendedBanner />
  <!-- 판매글 등록은 "계속 등록"(?again=) 때 화면을 새로 만들어 입력칸을 비움 -->
  <router-view v-slot="{ Component, route }">
    <component :is="Component" :key="route.name === 'trade-new' ? route.fullPath : undefined" />
  </router-view>
  <SiteFooter />
  <MobileTabBar />
  <LoginModal />
  <AppDialog />
  <UserProfileCard />
  <TradeGuideModal />
</template>
