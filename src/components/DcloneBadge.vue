<script setup>
// 우버 디아(디아블로 클론) 진행 (메인) - 지역(서버)마다 한 줄. 유저 제보 데이터라 출처·제보라는 표시와 링크를 같이 보여줌 (d2runewizard 약관상 출처 필수)
import { computed, onMounted } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { t } from '../i18n.js'
import { dcloneState, loadDclone, dcloneRegions, DCLONE_SOURCE, DCLONE_MAX } from '../dcloneStore.js'

onMounted(() => loadDclone().catch(() => {}))
useAutoRefresh(loadDclone, 60000)

const regions = computed(() => (dcloneState.loaded ? dcloneRegions() : []))
// 제보가 오래된 칸은 며칠 전 값인지 같이 보여줌
const days = (ts) => Math.floor((Date.now() - new Date(ts)) / 86400000)
const when = (ts) => (days(ts) < 1 ? t('오늘') : t('{n}일 전', { n: days(ts) }))
</script>

<template>
  <div v-if="regions.length" class="dc-badge">
    <div class="dc-head">
      <span class="dc-label">{{ $t('우버 디아') }}</span>
      <a class="dc-src" :href="DCLONE_SOURCE" target="_blank" rel="noopener">{{ $t('유저 제보 · 제공: d2runewizard') }}</a>
    </div>
    <div v-for="r in regions" :key="r.label" class="dc-row">
      <b class="dc-region">{{ $t(r.label) }}</b>
      <span v-for="c in r.chips" :key="c.label" class="dc-chip">
        {{ $t(c.label) }} <b>{{ c.row.progress }}/{{ DCLONE_MAX }}</b>
        <small>{{ when(c.row.reported_at) }}</small>
      </span>
    </div>
  </div>
</template>

<style scoped>
.dc-badge { margin: 10px 0; padding: 8px 12px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: 6px; font-size: 13px; }
.dc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.dc-label { color: var(--blood); font-weight: 600; }
.dc-src { color: var(--text-dim); font-size: 11px; }
.dc-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 12px; padding: 2px 0; }
.dc-region { min-width: 44px; color: var(--text); font-weight: 600; }
.dc-chip { color: var(--text-muted); }
.dc-chip b { color: var(--gold); }
.dc-chip small { margin-left: 3px; color: var(--text-dim); font-size: 11px; }
@media (max-width: 600px) { .dc-region { flex-basis: 100%; } }
</style>
