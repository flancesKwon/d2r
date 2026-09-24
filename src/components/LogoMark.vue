<script setup>
defineProps({
  size: { type: [Number, String], default: 16 },
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" class="logo-hub" aria-hidden="true">
    <line x1="12" y1="12" x2="12" y2="3.2" class="logo-hub-line" />
    <line x1="12" y1="12" x2="19.7" y2="16.6" class="logo-hub-line" />
    <line x1="12" y1="12" x2="4.3" y2="16.6" class="logo-hub-line" />
    <circle cx="12" cy="3.2" r="2.2" class="logo-hub-node" />
    <circle cx="19.7" cy="16.6" r="2.2" class="logo-hub-node" />
    <circle cx="4.3" cy="16.6" r="2.2" class="logo-hub-node" />
    <circle cx="12" cy="12" r="3" class="logo-hub-center" />
  </svg>
</template>

<style scoped>
.logo-hub{flex:none; overflow:visible;}
.logo-hub-line{stroke:var(--gold-dim); stroke-width:1.5;}
.logo-hub-node{fill:var(--bg-raise); stroke:var(--gold); stroke-width:1.4;}
.logo-hub-center{fill:var(--gold);}
</style>
