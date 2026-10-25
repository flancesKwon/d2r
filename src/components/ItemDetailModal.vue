<script setup>
import { computed } from 'vue'
import itemsData from '../data/items.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { ICONS } from '../icons.js'
import { runePips, buildRuneLookup, runewordRuneAffixes, runewordBaseTypes } from '../itemStats.js'
import { itemDamage, formatDamage } from '../itemDamage.js'
import { itemLevelReq, itemStatReqs, searchBaseItems, baseItemLabel } from '../tradeStore.js'
import { t, locale, itemName, affixText } from '../i18n.js'

// 아이템 상세 팝업 - 아이템 사전과 룬워드 찾기에서 같이 씀. 닫기는 부모가 처리
const props = defineProps({ item: { type: Object, required: true } })
defineEmits(['close'])
const selected = computed(() => props.item)
const icons = ITEM_ICONS
const runeLookup = buildRuneLookup(itemsData)

function iconUrl(item) {
  return item.icon_key && icons[item.icon_key] || null
}
// 룬워드를 만들 수 있는 베이스 - 종류와 소켓 수가 맞는 것, 엘리트부터 (같은 등급끼리 묶음)
const runewordBases = computed(() => {
  if (selected.value?.category !== 'runeword') return []
  const groups = new Map()
  for (const b of searchBaseItems('', null, selected.value)) {
    if (!groups.has(b.tier)) groups.set(b.tier, [])
    groups.get(b.tier).push(b)
  }
  return [...groups].map(([tier, bases]) => ({ tier, bases }))
})
const baseShown = (b) => (locale.value === 'ko' ? baseItemLabel(b) : b.subtitle)

// 룬워드 화면에 보여줄 전체 옵션 = 룬워드 고유 옵션(affixes, 최대 7개) + 박힌 룬들 자체 효과.
// 실제 게임 내부에서도 항상 이렇게 합쳐져서 나옴
function runewordFullAffixes(item) {
  return shown([...item.affixes, ...runewordRuneAffixes(item, runeLookup)])
}
// 게임 툴팁에 안 나오는 줄(hidden)은 빼고 보여줌 - scripts/merge-affix-lines.js
const shown = (list) => (list || []).filter((a) => !a.hidden)
// min~max 범위로 굴러가는(주사위 판정) 옵션인지 - 고정값 옵션과 구분해서 색으로 표시하려고 씀
// 원소·물리 추가 피해(예: 화염 피해 15-35 추가)는 min~max가 굴림 범위가 아니라 고정된 피해 범위
const FIXED_RANGE_PROPS = new Set(['dmg-fire', 'dmg-ltng', 'dmg-cold', 'dmg-mag', 'dmg-elem', 'dmg-norm', 'dmg', 'dmg-pois'])

// 무기 실제 피해 (피해 증가·추가 피해 적용) - 레벨당 최대 피해 옵션이 있으면 99레벨 기준도
// 요구 힘·민첩 (착용 조건 ±% 옵션 반영)
const statReqs = computed(() => itemStatReqs(selected.value))
const damageInfo = computed(() => {
  const it = selected.value
  const d = it && itemDamage(it)
  if (!d) return null
  const d99 = d.perLevel ? itemDamage(it, { level: 99 }) : null
  const b = it.base_stats
  const rows = []
  if (d.one) rows.push({ label: d.two ? t('한손 피해') : t('피해'), value: formatDamage(d.one), at99: d99 && formatDamage(d99.one), base: `${b.mindam}~${b.maxdam}` })
  if (d.two) rows.push({ label: t('양손 피해'), value: formatDamage(d.two), at99: d99 && formatDamage(d99.two), base: `${b['2handmindam']}~${b['2handmaxdam']}` })
  return rows
})
function isVariable(a) {
  if (FIXED_RANGE_PROPS.has(a.prop)) return false
  return a.min !== undefined && a.max !== undefined && a.min !== '' && a.max !== '' && String(a.min) !== String(a.max)
}
function runeIconUrl(runeName) {
  const url = icons['invr' + runeName.toLowerCase() + '__rune']
  return url || null
}
function runeLabel(runeName) {
  const rune = runeLookup[runeName]
  return rune ? itemName(rune) : runeName
}
</script>

<template>
  <div class="modal-overlay" v-if="selected" @click.self="$emit('close')">
    <div class="modal-panel">
      <button class="modal-close" @click="$emit('close')">✕</button>

      <template v-if="selected.category === 'unique' || selected.category === 'set'">
        <div class="d-eyebrow">{{ $t(selected.category_label) }} · {{ $t(selected.subtitle || '') }}</div>
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
            <h1 class="d-name">{{ itemName(selected) }}</h1>
            <div class="d-base" v-if="locale === 'ko'">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="d-meta-row">
          <div class="d-meta-item">
            <div class="label">{{ $t('필요 레벨') }}</div>
            <div class="value">{{ selected.level_req || '—' }}</div>
          </div>
          <div class="d-meta-item">
            <div class="label">{{ $t('아이템 레벨') }}</div>
            <div class="value">{{ selected.level || '—' }}</div>
          </div>
          <div class="d-meta-item" v-for="row in damageInfo || []" :key="row.label">
            <div class="label">{{ row.label }}</div>
            <div class="value">{{ row.value }}</div>
            <div class="d-meta-sub">{{ $t('기본') }} {{ row.base }}<template v-if="row.at99"> · {{ $t('99레벨') }} {{ row.at99 }}</template></div>
          </div>
          <div class="d-meta-item" v-if="selected.base_stats && selected.base_stats.category === 'armor'">
            <div class="label">{{ $t('기본 방어력') }}</div>
            <div class="value">{{ selected.base_stats.minac ?? '—' }}~{{ selected.base_stats.maxac ?? '—' }}</div>
          </div>
          <div class="d-meta-item" v-if="statReqs.str">
            <div class="label">{{ $t('필요 힘') }}</div>
            <div class="value">{{ statReqs.str }}</div>
          </div>
          <div class="d-meta-item" v-if="statReqs.dex">
            <div class="label">{{ $t('필요 민첩') }}</div>
            <div class="value">{{ statReqs.dex }}</div>
          </div>
        </div>
        <div class="note-box warn" v-if="selected.spawnable === false">
          {{ $t('현재 게임에서 드랍되지 않는 아이템.') }}
        </div>
        <div class="d-section-title">{{ $t('옵션') }}</div>
        <div class="affix-list">
          <div v-if="shown(selected.affixes).length === 0" class="affix-line unresolved">
            <span class="a-text">{{ $t('옵션 데이터 없음') }}</span>
          </div>
          <div
            v-for="(a, i) in shown(selected.affixes)"
            :key="i"
            class="affix-line"
            :class="{ unresolved: !a.text, variable: isVariable(a) }"
          >
            <span class="a-text">{{ a.text ? affixText(a.text) : $t('추가 효과 있음 (텍스트 준비 중)') }}</span>
            <span class="a-raw" v-if="!a.text">{{ a.prop || a.raw || '' }}</span>
          </div>
        </div>
        <template v-if="selected.extra && selected.extra.random_groups">
          <div class="d-section-title">{{ $t('제작 시 무작위 옵션') }}</div>
          <p class="note-box" style="margin-bottom:10px">
            {{ $t('큐브로 만들 때 아래 {n}개 그룹에서 그룹마다 하나씩 붙음, 수치는 범위 안에서 무작위.', { n: selected.extra.random_groups.length }) }}
          </p>
          <div class="random-group-list">
            <div class="random-group" v-for="(g, gi) in selected.extra.random_groups" :key="gi">
              <span class="random-group-no">{{ gi + 1 }}</span>
              <div class="random-group-options">
                <template v-for="(o, oi) in g" :key="oi">
                  <span class="random-group-or" v-if="oi > 0">{{ $t('또는') }}</span>
                  <span class="random-group-option">{{ affixText(o.text) }}</span>
                </template>
              </div>
            </div>
          </div>
        </template>
        <template v-if="selected.extra && selected.extra.icon_variants">
          <div class="d-section-title">{{ $t('아이템 그림') }}</div>
          <p class="note-box" style="margin-bottom:10px">{{ $t('게임에서 아래 3가지 그림 중 하나로 무작위 (옵션과 무관).') }}</p>
          <div class="icon-variant-row">
            <div class="icon-variant" v-for="v in selected.extra.icon_variants" :key="v.key">
              <img v-if="icons[v.key]" :src="icons[v.key]" alt="" />
              <span>{{ $t(v.label) }}</span>
            </div>
          </div>
        </template>
        <div class="note-box warn" v-for="(n, ni) in (selected.extra && selected.extra.notes) || []" :key="'note' + ni">{{ $t(n) }}</div>
        <template v-if="selected.category === 'set' && selected.extra">
          <div class="note-box gold">{{ $t('소속 세트') }}: <b>{{ locale === 'ko' ? selected.extra.set_name_ko : selected.extra.set_name_en || selected.extra.set_name_ko }}</b></div>
          <template v-if="selected.extra.set_item_bonus && selected.extra.set_item_bonus.length">
            <div class="d-section-title">{{ $t('세트 아이템 착용 수 보너스') }}</div>
            <div class="affix-list set-bonus-list">
              <template v-for="g in selected.extra.set_item_bonus" :key="'ib' + g.count">
                <div class="affix-line set-bonus" v-for="(a, i) in shown(g.affixes)" :key="i">
                  <span class="a-text">{{ affixText(a.text) }}</span><span class="set-bonus-count">{{ $t('{n}개 착용', { n: g.count }) }}</span>
                </div>
              </template>
            </div>
          </template>
          <template v-if="selected.extra.set_partial_bonus && selected.extra.set_partial_bonus.length">
            <div class="d-section-title">{{ $t('세트 부분 착용 보너스') }}</div>
            <div class="affix-list set-bonus-list">
              <template v-for="g in selected.extra.set_partial_bonus" :key="'pb' + g.count">
                <div class="affix-line set-bonus" v-for="(a, i) in shown(g.affixes)" :key="i">
                  <span class="a-text">{{ affixText(a.text) }}</span><span class="set-bonus-count">{{ $t('{n}개 착용', { n: g.count }) }}</span>
                </div>
              </template>
            </div>
          </template>
          <template v-if="selected.extra.set_full_bonus && selected.extra.set_full_bonus.length">
            <div class="d-section-title">{{ $t('세트 전체 착용 보너스') }}</div>
            <div class="affix-list">
              <div
                v-for="(a, i) in shown(selected.extra.set_full_bonus)"
                :key="i"
                class="affix-line"
                :class="{ unresolved: !a.text, variable: isVariable(a) }"
              >
                <span class="a-text">{{ a.text ? affixText(a.text) : $t('추가 효과 있음 (텍스트 준비 중)') }}</span>
              </div>
            </div>
          </template>
        </template>
      </template>

      <template v-else-if="selected.category === 'runeword'">
        <div class="d-eyebrow">{{ $t('룬워드') }} · {{ $t('소켓 {n}개', { n: selected.extra.socket_count }) }}</div>
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
            <h1 class="d-name">{{ itemName(selected) }}</h1>
            <div class="d-base" v-if="locale === 'ko'">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="rune-pips">
          <div class="rune-pip" v-for="(r, i) in runePips(selected.extra.rune_sequence)" :key="i">
            <img v-if="runeIconUrl(r)" :src="runeIconUrl(r)" alt="" />
            {{ runeLabel(r) }}
          </div>
        </div>
        <div class="d-meta-row">
          <div class="d-meta-item">
            <div class="label">{{ $t('필요 레벨') }}</div>
            <div class="value">{{ itemLevelReq(selected) || '—' }}</div>
          </div>
        </div>
        <div class="note-box">
          {{ $t('장착 가능 베이스') }}: <b>{{ runewordBaseTypes(selected.subtitle) || '—' }}</b>
          <span v-if="selected.extra.socket_count"> · {{ $t('소켓 {n}개 필요', { n: selected.extra.socket_count }) }}</span>
        </div>
        <details class="rw-bases" v-if="runewordBases.length">
          <summary>{{ $t('만들 수 있는 베이스 {n}종 보기', { n: runewordBases.reduce((n, g) => n + g.bases.length, 0) }) }}</summary>
          <div class="rw-base-group" v-for="g in runewordBases" :key="g.tier">
            <div class="rw-base-tier">{{ $t(g.tier) }}</div>
            <router-link
              v-for="b in g.bases" :key="b.code || b.subtitle" class="rw-base-chip"
              :to="{ path: '/runewords', query: { base: baseItemLabel(b) } }"
            >{{ baseShown(b) }}</router-link>
          </div>
          <router-link class="rw-base-more" to="/runewords">{{ $t('베이스로 룬워드 찾기 →') }}</router-link>
        </details>
        <div class="d-section-title">{{ $t('옵션') }}</div>
        <div class="affix-list">
          <div v-if="runewordFullAffixes(selected).length === 0" class="affix-line unresolved">
            <span class="a-text">{{ $t('옵션 데이터 없음') }}</span>
          </div>
          <div
            v-for="(a, i) in runewordFullAffixes(selected)"
            :key="i"
            class="affix-line"
            :class="{ unresolved: !a.text, variable: isVariable(a) }"
          >
            <span class="a-text">{{ a.text ? affixText(a.text) : $t('추가 효과 있음 (텍스트 준비 중)') }}</span>
            <span class="a-raw" v-if="!a.text">{{ a.prop || a.raw || '' }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="selected.category === 'gem'">
        <div class="d-eyebrow">{{ $t('보석·룬') }}</div>
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
            <h1 class="d-name">{{ itemName(selected) }}</h1>
            <div class="d-base" v-if="locale === 'ko'">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="d-section-title">{{ $t('장착 부위별 효과') }}</div>
        <div class="slot-grid">
          <div
            class="slot-box"
            v-for="slot in [['무기', 'in_weapon'], ['투구', 'in_helm'], ['방패', 'in_shield']]"
            :key="slot[1]"
          >
            <h4>{{ $t(slot[0]) }}</h4>
            <div
              v-if="selected.extra[slot[1]].length === 0"
              class="a-text"
              style="color: var(--text-dim); font-size: 12px"
            >
              {{ $t('효과 없음') }}
            </div>
            <div v-for="(a, i) in selected.extra[slot[1]]" :key="i" class="affix-line" :class="{ variable: isVariable(a) }">
              <span class="a-text">{{ affixText(a.text) }}</span>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="selected.category === 'material'">
        <div class="d-eyebrow">{{ $t(selected.category_label) }} · {{ $t(selected.subtitle) }}</div>
        <div class="d-head">
          <span class="icon-box material">
            <img v-if="selected.icon_key && icons[selected.icon_key]" :src="icons[selected.icon_key]" alt="" />
          </span>
          <div>
            <h1 class="d-name">{{ itemName(selected) }}</h1>
            <div class="d-base" v-if="locale === 'ko'">{{ selected.name_en }}</div>
          </div>
        </div>
        <div class="d-section-title">{{ $t('얻는 곳') }}</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(line, i) in selected.source" :key="i"><span class="a-text">{{ $t(line) }}</span></div>
        </div>
        <div class="d-section-title">{{ $t('쓰임') }}</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(u, i) in selected.use" :key="i">
            <span class="a-text" v-if="u.text">{{ $t(u.text) }}</span>
            <span class="a-text" v-else>{{ u.in.map((x) => $t(x)).join(' + ') }} → <b>{{ $t(u.out) }}</b></span>
          </div>
        </div>
      </template>
      <router-link class="d-history-link" :to="{ path: '/trade/history', query: { item: selected.id } }">{{ $t('이 아이템 거래내역 보기 →') }}</router-link>
    </div>
  </div>
</template>
