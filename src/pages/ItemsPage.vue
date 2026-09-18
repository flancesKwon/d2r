<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import itemsData from '../data/items.json'
import iconsData from '../data/icons.json'
import { ICONS } from '../icons.js'

const items = itemsData
const icons = iconsData
const route = useRoute()

const activeCat = ref('all')
const activeGroup = ref(null)
const activeSub = ref(null)
const searchQuery = ref('')
const selected = ref(null)
const showQualityInfo = ref(false)

const urlCat = route.query.cat
if (urlCat && ['unique', 'set', 'runeword', 'gem'].includes(urlCat)) {
  activeCat.value = urlCat
}

function setCat(cat) {
  activeCat.value = cat
  activeGroup.value = null
  activeSub.value = null
}
function setGroup(g) {
  activeGroup.value = g
  activeSub.value = null
}

const groupOptions = computed(() => {
  if (activeCat.value !== 'unique' && activeCat.value !== 'set') return []
  const pool = items.filter((it) => it.category === activeCat.value)
  return [...new Set(pool.map((it) => it.type_group))]
})
const subOptions = computed(() => {
  if (!activeGroup.value) return []
  const pool = items.filter(
    (it) => it.category === activeCat.value && it.type_group === activeGroup.value
  )
  return [...new Set(pool.map((it) => it.type_sub))]
})

const filteredItems = computed(() => {
  let list = items
  if (activeCat.value !== 'all') list = list.filter((it) => it.category === activeCat.value)
  if (activeGroup.value) list = list.filter((it) => it.type_group === activeGroup.value)
  if (activeSub.value) list = list.filter((it) => it.type_sub === activeSub.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (it) =>
        it.name_ko.toLowerCase().includes(q) ||
        it.name_en.toLowerCase().includes(q) ||
        (it.subtitle || '').toLowerCase().includes(q) ||
        (it.aliases || []).some((a) => a.toLowerCase().includes(q))
    )
  }
  return list
})

function runePips(seq) {
  return (seq || '').match(/[A-Z][a-z]+/g) || []
}
</script>

<template>
  <div class="items-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>아이템 사전</b></div>
  </header>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === 'all' }" @click="setCat('all')">전체</button>
        <button :class="{ active: activeCat === 'unique' }" @click="setCat('unique')">유니크</button>
        <button :class="{ active: activeCat === 'set' }" @click="setCat('set')">세트</button>
        <button :class="{ active: activeCat === 'runeword' }" @click="setCat('runeword')">룬워드</button>
        <button :class="{ active: activeCat === 'gem' }" @click="setCat('gem')">보석·룬</button>
      </div>

      <div class="cat-tabs sub-tabs" v-if="groupOptions.length">
        <button :class="{ active: activeGroup === null }" @click="setGroup(null)">전체</button>
        <button
          v-for="g in groupOptions"
          :key="g"
          :class="{ active: activeGroup === g }"
          @click="setGroup(g)"
        >
          {{ g }}
        </button>
      </div>
      <div class="cat-tabs sub-tabs" v-if="activeGroup && subOptions.length">
        <button :class="{ active: activeSub === null }" @click="activeSub = null">전체</button>
        <button
          v-for="s in subOptions"
          :key="s"
          :class="{ active: activeSub === s }"
          @click="activeSub = s"
        >
          {{ s }}
        </button>
      </div>

      <div class="search-row">
        <div class="search-input-wrap">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="이름 검색 — 예) 갉아먹는 자"
            aria-label="아이템 검색"
          />
        </div>
        <span class="result-count">{{ filteredItems.length }}개</span>
        <button class="quality-toggle" @click="showQualityInfo = !showQualityInfo">품질 수식어 정보</button>
      </div>
    </div>
  </div>

  <div class="quality-info" v-if="showQualityInfo">
    <div class="quality-info-inner">
      <div class="quality-row">
        <b>조악한 · 파손된 · 균열이 간 · 저질 (4종 동일 효과)</b>
        <span>방어구 방어력 75%로 감소 · 무기 데미지 75%로 감소(내림) · 내구도 약 33%로 감소</span>
      </div>
      <div class="quality-row">
        <b>우수한 (Superior)</b>
        <span>무기: 인핸스드 데미지 +5~15% (또는 최대데미지 +1) · 방어구: 인핸스드 방어력 +15% · 공격력/내구도 추가 보너스 가능</span>
      </div>
      <div class="quality-note">※ 개별 아이템 데이터가 아니라 일반템 전체에 적용되는 공통 규칙이에요. 정확한 원본 수치 파일(automagic.txt)은 아직 확보 전이라, 커뮤니티에 공개된 공식 수치를 교차 검증해서 표시했어요.</div>
    </div>
  </div>

  <div class="grid-wrap">
    <div class="item-grid">
      <button
        v-for="it in filteredItems"
        :key="it.id"
        class="item-card"
        :class="it.category"
        @click="selected = it"
      >
        <span class="card-icon" :class="[it.category]">
          <img
            v-if="it.icon_key && icons[it.icon_key]"
            :src="'data:image/png;base64,' + icons[it.icon_key]"
            alt=""
          />
          <svg v-else viewBox="0 0 24 24" v-html="ICONS[it.icon_type_key] || ICONS.unknown"></svg>
        </span>
        <div class="card-name">{{ it.name_ko }}</div>
        <div class="card-sub">{{ it.subtitle || '' }}</div>
        <div class="card-level" v-if="it.level">Lv {{ it.level }}</div>
      </button>
      <div class="empty-state" v-if="filteredItems.length === 0">검색 결과가 없어요</div>
    </div>
  </div>

  <div class="modal-overlay" v-if="selected" @click.self="selected = null">
    <div class="modal-panel">
      <button class="modal-close" @click="selected = null">✕</button>

      <template v-if="selected.category === 'unique' || selected.category === 'set'">
        <div class="d-eyebrow">{{ selected.category_label }} · {{ selected.subtitle || '' }}</div>
        <div class="d-head">
          <span class="icon-box" :class="selected.category">
            <img
              v-if="selected.icon_key && icons[selected.icon_key]"
              :src="'data:image/png;base64,' + icons[selected.icon_key]"
              alt=""
            />
            <svg v-else viewBox="0 0 24 24" v-html="ICONS[selected.icon_type_key] || ICONS.unknown"></svg>
          </span>
          <div>
            <h1 class="d-name">{{ selected.name_ko }}</h1>
            <div class="d-base">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="d-meta-row">
          <div class="d-meta-item">
            <div class="label">필요 레벨</div>
            <div class="value">{{ selected.level_req || '—' }}</div>
          </div>
          <div class="d-meta-item">
            <div class="label">아이템 레벨</div>
            <div class="value">{{ selected.level || '—' }}</div>
          </div>
          <div class="d-meta-item" v-if="selected.base_stats && selected.base_stats.category === 'weapon'">
            <div class="label">기본 피해</div>
            <div class="value">
              {{ (selected.base_stats.mindam ?? selected.base_stats['2handmindam']) ?? '—' }}~{{
                (selected.base_stats.maxdam ?? selected.base_stats['2handmaxdam']) ?? '—'
              }}
            </div>
          </div>
          <div class="d-meta-item" v-if="selected.base_stats && selected.base_stats.category === 'armor'">
            <div class="label">기본 방어력</div>
            <div class="value">{{ selected.base_stats.minac ?? '—' }}~{{ selected.base_stats.maxac ?? '—' }}</div>
          </div>
          <div class="d-meta-item" v-if="selected.base_stats && selected.base_stats.reqstr">
            <div class="label">필요 힘</div>
            <div class="value">{{ selected.base_stats.reqstr }}</div>
          </div>
        </div>
        <div class="note-box warn" v-if="selected.spawnable === false">
          이 아이템은 현재 게임 내에서 드랍되지 않는 것으로 표기되어 있어요.
        </div>
        <div class="d-section-title">옵션</div>
        <div class="affix-list">
          <div v-if="selected.affixes.length === 0" class="affix-line unresolved">
            <span class="a-text">옵션 데이터가 없는 아이템이에요</span>
          </div>
          <div
            v-for="(a, i) in selected.affixes"
            :key="i"
            class="affix-line"
            :class="{ unresolved: !a.text }"
          >
            <span class="a-text">{{ a.text || '추가 효과 있음 (텍스트 준비 중)' }}</span>
            <span class="a-raw" v-if="!a.text">{{ a.prop || a.raw || '' }}</span>
          </div>
        </div>
        <template v-if="selected.category === 'set' && selected.extra">
          <div class="note-box gold">소속 세트: <b>{{ selected.extra.set_name_ko }}</b></div>
          <template v-if="selected.extra.set_full_bonus && selected.extra.set_full_bonus.length">
            <div class="d-section-title">세트 전체 착용 보너스</div>
            <div class="affix-list">
              <div
                v-for="(a, i) in selected.extra.set_full_bonus"
                :key="i"
                class="affix-line"
                :class="{ unresolved: !a.text }"
              >
                <span class="a-text">{{ a.text || '추가 효과 있음 (텍스트 준비 중)' }}</span>
              </div>
            </div>
          </template>
        </template>
      </template>

      <template v-else-if="selected.category === 'runeword'">
        <div class="d-eyebrow">룬워드 · 소켓 {{ selected.extra.socket_count }}개</div>
        <div class="d-head">
          <span class="icon-box" :class="selected.category">
            <img
              v-if="selected.icon_key && icons[selected.icon_key]"
              :src="'data:image/png;base64,' + icons[selected.icon_key]"
              alt=""
            />
            <svg v-else viewBox="0 0 24 24" v-html="ICONS.runeword"></svg>
          </span>
          <div>
            <h1 class="d-name">{{ selected.name_ko }}</h1>
            <div class="d-base">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="rune-pips">
          <div class="rune-pip" v-for="(r, i) in runePips(selected.extra.rune_sequence)" :key="i">
            {{ r }}
          </div>
        </div>
        <div class="note-box">장착 가능 베이스: <b>{{ selected.subtitle || '—' }}</b></div>
        <div class="d-section-title">옵션</div>
        <div class="affix-list">
          <div v-if="selected.affixes.length === 0" class="affix-line unresolved">
            <span class="a-text">옵션 데이터가 없어요</span>
          </div>
          <div
            v-for="(a, i) in selected.affixes"
            :key="i"
            class="affix-line"
            :class="{ unresolved: !a.text }"
          >
            <span class="a-text">{{ a.text || '추가 효과 있음 (텍스트 준비 중)' }}</span>
            <span class="a-raw" v-if="!a.text">{{ a.prop || a.raw || '' }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="selected.category === 'gem'">
        <div class="d-eyebrow">보석 · 룬</div>
        <div class="d-head">
          <span class="icon-box" :class="selected.category">
            <img
              v-if="selected.icon_key && icons[selected.icon_key]"
              :src="'data:image/png;base64,' + icons[selected.icon_key]"
              alt=""
            />
            <svg v-else viewBox="0 0 24 24" v-html="ICONS[selected.icon_type_key] || ICONS.unknown"></svg>
          </span>
          <div>
            <h1 class="d-name">{{ selected.name_ko }}</h1>
            <div class="d-base">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="d-section-title">장착 부위별 효과</div>
        <div class="slot-grid">
          <div
            class="slot-box"
            v-for="slot in [['무기', 'in_weapon'], ['투구', 'in_helm'], ['방패', 'in_shield']]"
            :key="slot[1]"
          >
            <h4>{{ slot[0] }}</h4>
            <div
              v-if="selected.extra[slot[1]].length === 0"
              class="a-text"
              style="color: var(--text-dim); font-size: 12px"
            >
              효과 없음
            </div>
            <div v-for="(a, i) in selected.extra[slot[1]]" :key="i" class="affix-line">
              <span class="a-text">{{ a.text }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
  </div>
</template>
