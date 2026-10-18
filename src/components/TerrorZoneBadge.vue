<script setup>
// 공포의 영역 한 줄 (메인) - 지금·다음 구역, 출처 링크는 d2runewizard 약관상 필수
import { onMounted } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { terrorZoneState as tz, loadTerrorZone, zoneText, TERROR_ZONE_SOURCE } from '../terrorZoneStore.js'

onMounted(() => loadTerrorZone().catch(() => {}))
useAutoRefresh(loadTerrorZone, 60000)
</script>

<template>
  <div v-if="tz.current" class="tz-badge">
    <span class="tz-label">{{ $t('공포의 영역') }}</span>
    <b class="tz-now">{{ zoneText(tz.current) }}</b>
    <span v-if="tz.next" class="tz-next">{{ $t('다음') }} {{ zoneText(tz.next) }}</span>
    <a class="tz-src" :href="TERROR_ZONE_SOURCE" target="_blank" rel="noopener">{{ $t('제공: d2runewizard') }}</a>
  </div>
</template>

<style scoped>
.tz-badge { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 10px 0; padding: 8px 12px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: 6px; font-size: 13px; }
.tz-label { color: var(--blood); font-weight: 600; }
.tz-now { color: var(--gold); }
.tz-next { color: var(--text-muted); }
.tz-src { margin-left: auto; color: var(--text-dim); font-size: 11px; }
</style>
