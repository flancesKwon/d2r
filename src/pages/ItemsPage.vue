<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import itemsData from '../data/items.json'
import materialInfo from '../data/materialInfo.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { itemMatchesQuery, optionTerms, itemOptionLines, matchOptionLines } from '../itemSearch.js'
import { ICONS } from '../icons.js'
import { runePips, buildRuneLookup, runewordRuneAffixes, runewordBaseTypes } from '../itemStats.js'
import { EXTRA_MATERIALS } from '../tradeStore.js'
import ItemDetailModal from '../components/ItemDetailModal.vue'
import { t, locale, itemName, affixText } from '../i18n.js'

// 재료(열쇠·장기·정수·징표·세계석 파편)는 거래 쪽 목록(tradeStore)에 있는 걸 사전에도 같이 보여줌 - 얻는 곳·쓰임은 materialInfo.json
const materials = EXTRA_MATERIALS.map((m) => {
  if (!materialInfo[m.id]) throw new Error(`materialInfo.json 에 ${m.id} 없음`)
  return { ...m, ...materialInfo[m.id], category: 'material' }
})
const items = [...itemsData, ...materials]
const icons = ITEM_ICONS
const route = useRoute()
const router = useRouter()

const runeLookup = buildRuneLookup(itemsData)

// 룬워드는 실제 게임에서도 전용 아이콘이 없고(꽂힌 베이스 아이템 모양을 그대로 씀),
// 소켓에 박힌 룬이 화면에 줄지어 보임 - 그 느낌을 살리려고 대표 베이스의 실제 그림
// (icon_key, 예: 수수께끼 = 아칸 플레이트) 위에 룬 아이콘을 소켓 개수만큼 겹쳐서 보여줌
function iconUrl(item) {
  return item.icon_key && icons[item.icon_key] || null
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
// 검색 기준: 이름 / 옵션 (?by=option 으로도 들어옴)
const searchBy = ref(route.query.by === 'option' ? 'option' : 'name')
// 상단 통합 검색에서 아이템을 고르면 ?q=이름&id=아이템 으로 들어옴 -> 그 아이템 상세를 바로 열기
// (이미 사전 페이지에 있을 때도 주소만 바뀌니 watch 로 따라감)
// 상단 메뉴의 유니크·세트·룬워드 등(?cat=)도 이미 사전 페이지에 있을 때 주소만 바뀌어서, 탭도 주소를 따라가게 함
// (예전엔 처음 들어올 때만 읽어서 유니크 -> 세트로 메뉴를 옮겨도 탭이 안 바뀌었음)
const URL_CATS = ['unique', 'set', 'runeword', 'gem', 'material']
// 아이템 하나는 /items/아이템id (예전 주소 ?id= 도 그대로 됨)
function applyRouteQuery() {
  const q = route.query
  const id = route.params.id || q.id
  if (typeof q.q === 'string') searchQuery.value = q.q
  if (q.by === 'option' || q.by === 'name') searchBy.value = q.by
  selected.value = (id && items.find((it) => it.id === id)) || null
  // 없는 아이템 주소(/items/u200)는 전체 목록이 아니라 404 로
  if (route.params.id && !selected.value) {
    router.replace({ name: 'not-found', params: { pathMatch: route.path.split('/').filter(Boolean) }, query: route.query })
    return
  }
  const cat = URL_CATS.includes(q.cat) ? q.cat : 'all'
  if (cat !== activeCat.value && !id) setCat(cat)
}
// 카드를 열고 닫을 때 주소도 바꿈 (그 아이템 주소를 그대로 공유할 수 있게)
function openItem(it) {
  const { id, ...rest } = route.query
  router.replace({ path: `/items/${it.id}`, query: rest })
}
function closeItem() {
  const { id, ...rest } = route.query
  if (route.params.id || id) router.replace({ path: '/items', query: rest })
  else selected.value = null
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
applyRouteQuery()
watch(() => [route.query, route.params.id], applyRouteQuery)
// 열린 아이템 이름을 창 제목으로 (검색엔진·탭 제목)
watch([selected, locale], ([it]) => (document.title = it
  ? (locale.value === 'ko' ? `${it.name_ko} (${it.name_en})` : it.name_en || it.name_ko) + ' — ' + t('디아허브')
  : `${t('아이템 사전')} — ${t('디아허브')}`), { immediate: true, flush: 'post' })

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
  if (searchQuery.value.trim()) {
    if (searchBy.value === 'option') {
      list = list.filter((it) => optionHits.value.has(it.id))
    } else {
      list = list.filter((it) => itemMatchesQuery(it, searchQuery.value, [it.subtitle]))
    }
  }
  return list
})
// 옵션 검색: 아이템마다 맞은 옵션 줄 (카드에 보여줌). 룬워드는 박힌 룬 효과까지 합친 옵션으로
const optionHits = computed(() => {
  const hits = new Map()
  if (searchBy.value !== 'option') return hits
  const terms = optionTerms(searchQuery.value, locale.value)
  if (!terms.length) return hits
  for (const it of items) {
    const extra = it.category === 'runeword' ? runewordRuneAffixes(it, runeLookup) : []
    // 영어 화면은 영어 옵션 줄에서 찾음
    const lines = itemOptionLines(it, extra)
    const m = matchOptionLines(locale.value === 'ko' ? lines : lines.map(affixText), terms)
    if (m) hits.set(it.id, m)
  }
  return hits
})
</script>

<template>
  <div class="items-page">

  <!-- 아이템을 고르면 아래 상세의 아이템 이름이 h1 - 목록만 볼 때는 페이지 제목이 h1 -->
  <h1 class="sr-only" v-if="!selected">{{ $t('아이템 사전') }}</h1>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === 'all' }" @click="setCat('all')">{{ $t('전체') }}</button>
        <button :class="{ active: activeCat === 'unique' }" @click="setCat('unique')">{{ $t('유니크') }}</button>
        <button :class="{ active: activeCat === 'set' }" @click="setCat('set')">{{ $t('세트') }}</button>
        <button :class="{ active: activeCat === 'runeword' }" @click="setCat('runeword')">{{ $t('룬워드') }}</button>
        <button :class="{ active: activeCat === 'gem' }" @click="setCat('gem')">{{ $t('보석·룬') }}</button>
        <button :class="{ active: activeCat === 'material' }" @click="setCat('material')">{{ $t('재료') }}</button>
      </div>

      <div class="cat-tabs sub-tabs" v-if="groupOptions.length">
        <button :class="{ active: activeGroup === null }" @click="setGroup(null)">{{ $t('전체') }}</button>
        <button
          v-for="g in groupOptions"
          :key="g"
          :class="{ active: activeGroup === g }"
          @click="setGroup(g)"
        >
          {{ $t(g) }}
        </button>
      </div>
      <div class="cat-tabs sub-tabs" v-if="activeGroup && subOptions.length">
        <button :class="{ active: activeSub === null }" @click="activeSub = null">{{ $t('전체') }}</button>
        <button
          v-for="s in subOptions"
          :key="s"
          :class="{ active: activeSub === s }"
          @click="activeSub = s"
        >
          {{ $t(s) }}
        </button>
      </div>

      <div class="search-row">
        <div class="search-by" role="group" :aria-label="$t('검색 기준')">
          <button type="button" :class="{ active: searchBy === 'name' }" @click="searchBy = 'name'">{{ $t('이름') }}</button>
          <button type="button" :class="{ active: searchBy === 'option' }" @click="searchBy = 'option'">{{ $t('옵션') }}</button>
        </div>
        <div class="search-input-wrap">
          <input
            type="text"
            :value="searchQuery" @input="searchQuery = $event.target.value"
            :placeholder="searchBy === 'option' ? $t('옵션 검색 — 예) 패캐, 올스 (쉼표로 여러 개)') : $t('이름 검색 — 예) 갉아먹는 자')"
            :aria-label="$t('아이템 검색')"
          />
        </div>
        <span class="result-count">{{ filteredItems.length }}{{ $t('개') }}</span>
        <button class="quality-toggle" @click="showQualityInfo = !showQualityInfo">{{ $t('품질 수식어 정보') }}</button>
      </div>
    </div>
  </div>

  <div class="quality-info" v-if="showQualityInfo">
    <div class="quality-info-inner">
      <div class="quality-row">
        <b>{{ $t('조악한 · 파손된 · 균열이 간 · 저질 (4종 동일 효과)') }}</b>
        <span>{{ $t('방어구 방어력 75%로 감소 · 무기 데미지 75%로 감소(내림) · 내구도 약 33%로 감소') }}</span>
      </div>
      <div class="quality-row">
        <b>{{ $t('우수한 (Superior)') }}</b>
        <span>{{ $t('무기: 피해 증가 +5~15% (또는 최대 피해 +1) · 방어구: 방어력 증가 +15% · 공격력/내구도 추가 보너스 가능') }}</span>
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
        @click="openItem(it)"
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
        <div class="card-name">{{ itemName(it) }}</div>
        <div class="card-sub">{{ it.category === 'runeword' ? runewordBaseTypes(it.subtitle) : $t(it.subtitle || '') }}</div>
        <div class="card-level" v-if="it.level && it.level !== '0'">Lv {{ it.level }}</div>
        <div class="card-hits" v-if="optionHits.has(it.id)">
          <span v-for="line in optionHits.get(it.id)" :key="line">{{ affixText(line) }}</span>
        </div>
      </button>
      <div class="empty-state" v-if="filteredItems.length === 0">{{ $t('검색 결과 없음') }}</div>
    </div>
  </div>

  <ItemDetailModal v-if="selected" :item="selected" @close="closeItem" />
  </div>
</template>
