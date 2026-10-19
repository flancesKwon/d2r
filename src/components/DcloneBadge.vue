<script setup>
// 우버 디아(디아블로 클론) 진행 한 줄 (메인) - 유저 제보 데이터라 출처·제보라는 표시와 링크를 같이 보여줌 (d2runewizard 약관상 출처 필수)
import { computed, onMounted } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { t } from '../i18n.js'
import { dcloneState, loadDclone, dcloneChips, DCLONE_SOURCE, DCLONE_MAX } from '../dcloneStore.js'

onMounted(() => loadDclone().catch(() => {}))
useAutoRefresh(loadDclone, 60000)

const chips = computed(() => (dcloneState.loaded ? dcloneChips() : []))
// 제보가 오래된 칸은 흐리게 - 며칠 전 값인지 같이 보여줌
const days = (ts) => Math.floor((Date.now() - new Date(ts)) / 86400000)
const when = (ts) => (days(ts) < 1 ? t('오늘') : t('{n}일 전', { n: days(ts) }))
</script>

<template>
  <div v-if="chips.length" class="dc-badge">
    <span class="dc-label">{{ $t('우버 디아') }}</span>
    <span v-for="c in chips" :key="c.label" class="dc-chip">
      {{ $t(c.label) }} <b>{{ c.row.progress }}/{{ DCLONE_MAX }}</b>
      <small>{{ when(c.row.reported_at) }}</small>
    </span>
    <a class="dc-src" :href="DCLONE_SOURCE" target="_blank" rel="noopener">{{ $t('유저 제보 · 제공: d2runewizard') }}</a>
  </div>
</template>

<style scoped>
.dc-badge { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin: 10px 0; padding: 8px 12px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: 6px; font-size: 13px; }
.dc-label { color: var(--blood); font-weight: 600; }
.dc-chip { color: var(--text-muted); }
.dc-chip b { color: var(--gold); }
.dc-chip small { margin-left: 3px; color: var(--text-dim); font-size: 11px; }
.dc-src { margin-left: auto; color: var(--text-dim); font-size: 11px; }
</style>
