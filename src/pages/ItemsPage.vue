<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import itemsData from '../data/items.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { itemMatchesQuery } from '../itemSearch.js'
import { ICONS } from '../icons.js'
import { runePips, buildRuneLookup, runewordRuneAffixes, runewordBaseTypesKo } from '../itemStats.js'

const items = itemsData
const icons = ITEM_ICONS
const route = useRoute()
const runeLookup = buildRuneLookup(itemsData)

// 룬워드는 실제 게임에서도 전용 아이콘이 없고(꽂힌 베이스 아이템 모양을 그대로 씀),
// 소켓에 박힌 룬이 화면에 줄지어 보임 - 그 느낌을 살리려고 대표 베이스의 실제 그림
// (icon_key, 예: 수수께끼 = 아칸 플레이트) 위에 룬 아이콘을 소켓 개수만큼 겹쳐서 보여줌
function iconUrl(item) {
  return item.icon_key && icons[item.icon_key] || null
}
// 룬워드 화면에 보여줄 전체 옵션 = 룬워드 고유 옵션(affixes, 최대 7개) + 박힌 룬들 자체 효과.
// 실제 게임 내부에서도 항상 이렇게 합쳐져서 나옴
function runewordFullAffixes(item) {
  return [...item.affixes, ...runewordRuneAffixes(item, runeLookup)]
}
// min~max 범위로 굴러가는(주사위 판정) 옵션인지 - 고정값 옵션과 구분해서 색으로 표시하려고 씀
// 원소·물리 추가 피해(예: 화염 피해 15-35 추가)는 min~max가 굴림 범위가 아니라 고정된 피해 범위
const FIXED_RANGE_PROPS = new Set(['dmg-fire', 'dmg-ltng', 'dmg-cold', 'dmg-mag', 'dmg-elem', 'dmg-norm', 'dmg-pois'])
function isVariable(a) {
  if (FIXED_RANGE_PROPS.has(a.prop)) return false
  return a.min !== undefined && a.max !== undefined && a.min !== '' && a.max !== '' && String(a.min) !== String(a.max)
}
function runeIconUrl(runeName) {
  const url = icons['invr' + runeName.toLowerCase() + '__rune']
  return url || null
}

const activeCat = ref('all')
const activeGroup = ref(null)
const activeSub = ref(null)
// ?q=이름 으로 들어오면(룬워드 찾기 등) 그 검색어로 시작
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')
const selected = ref(null)
// 상단 통합 검색에서 아이템을 고르면 ?q=이름&id=아이템 으로 들어옴 -> 그 아이템 상세를 바로 열기
// (이미 사전 페이지에 있을 때도 주소만 바뀌니 watch 로 따라감)
// 상단 메뉴의 유니크·세트·룬워드 등(?cat=)도 이미 사전 페이지에 있을 때 주소만 바뀌어서, 탭도 주소를 따라가게 함
// (예전엔 처음 들어올 때만 읽어서 유니크 -> 세트로 메뉴를 옮겨도 탭이 안 바뀌었음)
const URL_CATS = ['unique', 'set', 'runeword', 'gem']
function applyRouteQuery(q) {
  if (typeof q.q === 'string') searchQuery.value = q.q
  selected.value = (q.id && items.find((it) => it.id === q.id)) || null
  const cat = URL_CATS.includes(q.cat) ? q.cat : 'all'
  if (cat !== activeCat.value && !q.id) setCat(cat)
}
const showQualityInfo = ref(false)

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
applyRouteQuery(route.query)
watch(() => route.query, applyRouteQuery)

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
  // 공식 이름·영문·별칭(조던, 에니그마 등)·베이스 이름, 띄어쓰기 무시
  if (searchQuery.value.trim()) list = list.filter((it) => itemMatchesQuery(it, searchQuery.value, [it.subtitle]))
  return list
})
</script>

<template>
  <div class="items-page">

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
            :value="searchQuery" @input="searchQuery = $event.target.value"
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
        <span class="card-icon" :class="[it.category]" v-if="it.category === 'runeword' && iconUrl(it)">
          <span class="rw-icon">
            <img class="rw-base" :src="iconUrl(it)" alt="" />
            <span class="rw-runes">
              <img v-for="(r, n) in runePips(it.extra.rune_sequence)" :key="n" class="rw-rune" :src="runeIconUrl(r)" :alt="r" loading="lazy" />
            </span>
          </span>
        </span>
        <span class="card-icon" :class="[it.category]" v-else>
          <img
            v-if="it.icon_key && icons[it.icon_key]"
            :src="icons[it.icon_key]"
            alt=""
            loading="lazy"
          />
          <svg v-else viewBox="0 0 24 24" v-html="ICONS[it.icon_type_key] || ICONS.unknown"></svg>
        </span>
        <div class="card-name">{{ it.name_ko }}</div>
        <div class="card-sub">{{ it.category === 'runeword' ? runewordBaseTypesKo(it.subtitle) : it.subtitle || '' }}</div>
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
              :src="icons[selected.icon_key]"
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
            :class="{ unresolved: !a.text, variable: isVariable(a) }"
          >
            <span class="a-text">{{ a.text || '추가 효과 있음 (텍스트 준비 중)' }}</span>
            <span class="a-raw" v-if="!a.text">{{ a.prop || a.raw || '' }}</span>
          </div>
        </div>
        <template v-if="selected.extra && selected.extra.random_groups">
          <div class="d-section-title">제작 시 무작위 옵션</div>
          <p class="note-box" style="margin-bottom:10px">
            큐브로 만들 때 아래 {{ selected.extra.random_groups.length }}개 그룹에서 <b>그룹마다 하나씩</b> 붙고, 수치는 범위 안에서 무작위로 정해져요.
          </p>
          <div class="random-group-list">
            <div class="random-group" v-for="(g, gi) in selected.extra.random_groups" :key="gi">
              <span class="random-group-no">{{ gi + 1 }}</span>
              <div class="random-group-options">
                <template v-for="(o, oi) in g" :key="oi">
                  <span class="random-group-or" v-if="oi > 0">또는</span>
                  <span class="random-group-option">{{ o.text }}</span>
                </template>
              </div>
            </div>
          </div>
        </template>
        <template v-if="selected.extra && selected.extra.icon_variants">
          <div class="d-section-title">아이템 그림</div>
          <p class="note-box" style="margin-bottom:10px">게임에서는 아래 3가지 그림 중 하나로 무작위로 나와요. 옵션과는 상관없어요.</p>
          <div class="icon-variant-row">
            <div class="icon-variant" v-for="v in selected.extra.icon_variants" :key="v.key">
              <img v-if="icons[v.key]" :src="icons[v.key]" alt="" />
              <span>{{ v.label }}</span>
            </div>
          </div>
        </template>
        <div class="note-box warn" v-for="(n, ni) in (selected.extra && selected.extra.notes) || []" :key="'note' + ni">{{ n }}</div>
        <template v-if="selected.category === 'set' && selected.extra">
          <div class="note-box gold">소속 세트: <b>{{ selected.extra.set_name_ko }}</b></div>
          <template v-if="selected.extra.set_item_bonus && selected.extra.set_item_bonus.length">
            <div class="d-section-title">세트 아이템 착용 수 보너스</div>
            <div class="affix-list set-bonus-list">
              <template v-for="g in selected.extra.set_item_bonus" :key="'ib' + g.count">
                <div class="affix-line set-bonus" v-for="(a, i) in g.affixes" :key="i">
                  <span class="a-text">{{ a.text }}</span><span class="set-bonus-count">{{ g.count }}개 착용</span>
                </div>
              </template>
            </div>
          </template>
          <template v-if="selected.extra.set_partial_bonus && selected.extra.set_partial_bonus.length">
            <div class="d-section-title">세트 부분 착용 보너스</div>
            <div class="affix-list set-bonus-list">
              <template v-for="g in selected.extra.set_partial_bonus" :key="'pb' + g.count">
                <div class="affix-line set-bonus" v-for="(a, i) in g.affixes" :key="i">
                  <span class="a-text">{{ a.text }}</span><span class="set-bonus-count">{{ g.count }}개 착용</span>
                </div>
              </template>
            </div>
          </template>
          <template v-if="selected.extra.set_full_bonus && selected.extra.set_full_bonus.length">
            <div class="d-section-title">세트 전체 착용 보너스</div>
            <div class="affix-list">
              <div
                v-for="(a, i) in selected.extra.set_full_bonus"
                :key="i"
                class="affix-line"
                :class="{ unresolved: !a.text, variable: isVariable(a) }"
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
          <span class="icon-box" :class="selected.category" v-if="iconUrl(selected)">
            <span class="rw-icon">
              <img class="rw-base" :src="iconUrl(selected)" alt="" />
              <span class="rw-runes">
                <img v-for="(r, n) in runePips(selected.extra.rune_sequence)" :key="n" class="rw-rune" :src="runeIconUrl(r)" :alt="r" />
              </span>
            </span>
          </span>
          <span class="icon-box" :class="selected.category" v-else>
            <img
              v-if="selected.icon_key && icons[selected.icon_key]"
              :src="icons[selected.icon_key]"
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
        <div class="note-box">
          장착 가능 베이스: <b>{{ runewordBaseTypesKo(selected.subtitle) || '—' }}</b>
          <span v-if="selected.extra.socket_count"> · 소켓 {{ selected.extra.socket_count }}개 필요</span>
        </div>
        <div class="d-section-title">옵션</div>
        <p class="note-box" style="margin-bottom:10px">룬워드 고유 옵션에 박힌 룬들 자체 효과까지 합친 실제 최종 옵션이에요.</p>
        <div class="affix-list">
          <div v-if="runewordFullAffixes(selected).length === 0" class="affix-line unresolved">
            <span class="a-text">옵션 데이터가 없어요</span>
          </div>
          <div
            v-for="(a, i) in runewordFullAffixes(selected)"
            :key="i"
            class="affix-line"
            :class="{ unresolved: !a.text, variable: isVariable(a) }"
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
              :src="icons[selected.icon_key]"
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
            <div v-for="(a, i) in selected.extra[slot[1]]" :key="i" class="affix-line" :class="{ variable: isVariable(a) }">
              <span class="a-text">{{ a.text }}</span>
            </div>
          </div>
        </div>
      </template>
      <router-link class="d-history-link" :to="{ path: '/trade/history', query: { item: selected.id } }">이 아이템 거래내역 보기 →</router-link>
    </div>
  </div>
  </div>
</template>
