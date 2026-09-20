<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import classStats from '../data/classStats.json'
import skillData from '../data/skills.json'
import itemsData from '../data/items.json'
import { CLASS_ICONS, SKILL_ICONS } from '../icons.js'
import { computeSkillDamage, ELEMENT_LABELS } from '../skillMath.js'
import { SLOT_DEFS, buildItemsBySlot, aggregateItemStats, itemSkillBonus } from '../itemStats.js'
import skillIconManifest from '../data/skillIconManifest.json'

// 캐릭터 인형(paperdoll) 배치 - 실제 인게임 장비창의 정확한 5열 배치를 그대로 재현
// (무기·방패는 세로로 긴 슬롯, 목걸이는 갑옷 옆, 반지는 벨트 양옆)
const DOLL_AREA = {
  helm: 'helm',
  weapon: 'weapon', armor: 'armor', shield: 'shield', amulet: 'amulet',
  gloves: 'gloves', belt: 'belt', boots: 'boots',
  ring1: 'ring1', ring2: 'ring2',
}
const SMALL_DOLL_SLOTS = new Set(['amulet', 'ring1', 'ring2', 'belt'])

// 실제 게임 DC6 스프라이트에서 뽑은 슬롯 실루엣 아이콘 (기존 자체제작 SVG 대체)
const equipIconModules = import.meta.glob('../assets/equipicons/*.png', { eager: true, import: 'default' })
const equipIconUrl = Object.fromEntries(Object.entries(equipIconModules).map(([p, url]) => [p.split('/').pop().replace('.png', ''), url]))
const DOLL_ICON_FILE = { weapon: 'weapon', shield: 'weapon', helm: 'helm', armor: 'armor', gloves: 'gloves', boots: 'boots', belt: 'belt', amulet: 'amulet', ring1: 'ring', ring2: 'ring' }
function equipSilhouetteUrl(slotKey) {
  return equipIconUrl[DOLL_ICON_FILE[slotKey]]
}

const iconFileModules = import.meta.glob('../assets/skillicons/*.png', { eager: true, import: 'default' })
const iconUrlByFilename = Object.fromEntries(Object.entries(iconFileModules).map(([p, url]) => [p.split('/').pop(), url]))
function realIconUrl(classKey, skillName) {
  const fname = skillIconManifest[classKey]?.[skillName]
  return fname ? iconUrlByFilename[fname] : null
}

const route = useRoute()
const router = useRouter()

const classKeys = Object.keys(classStats)
const STAT_KEYS = ['str', 'dex', 'vit', 'nrg']
const STAT_LABELS = { str: '힘', dex: '민첩', vit: '활력', nrg: '에너지' }
const TIER_LEVELS = [1, 6, 12, 18, 24, 30]
const ELEMENT_COLORS = { fire: '#c0512f', cold: '#4e8ac0', ltng: '#c7a83a', pois: '#5c8a5b', mag: '#8a6bb0', phy: '#8c8275' }

// 덴 오브 이블(+1)·라다멘트의 둥지(+1)·타락한 천사/이주얼(+2) 스킬 포인트,
// 람 에센의 책(+5) 스탯 포인트가 난이도마다 반복 지급 — 전부 깬 상태를 기본값으로 고정
const MAX_QUEST_SKILL_BONUS = (1 + 1 + 2) * 3
const MAX_QUEST_STAT_BONUS = 5 * 3

const selectedClass = ref('amazon')
const level = ref(90)

const allocatedStats = reactive({ str: 0, dex: 0, vit: 0, nrg: 0 })
const allocatedSkills = reactive({})
const equippedItems = reactive(Object.fromEntries(SLOT_DEFS.map((s) => [s.key, ''])))

const itemsBySlot = buildItemsBySlot(itemsData)
const itemById = Object.fromEntries(itemsData.map((i) => [i.id, i]))


const itemAgg = computed(() => {
  const full = Object.fromEntries(SLOT_DEFS.map((s) => [s.key, equippedItems[s.key] ? itemById[equippedItems[s.key]] : null]))
  return aggregateItemStats(full, selectedClass.value)
})

function resetAll() {
  STAT_KEYS.forEach((k) => (allocatedStats[k] = 0))
  Object.keys(allocatedSkills).forEach((k) => delete allocatedSkills[k])
}

function resetEquip() {
  SLOT_DEFS.forEach((s) => (equippedItems[s.key] = ''))
}

let skipClassReset = false
const selectedNode = ref(null) // { tabIdx, skillIdx } | null

watch(selectedClass, () => {
  if (skipClassReset) return
  resetAll()
  selectedNode.value = null
})

const classInfo = computed(() => classStats[selectedClass.value])
const classTabs = computed(() => skillData[selectedClass.value].tabs)

const clampedLevel = computed({
  get: () => level.value,
  set: (v) => {
    const n = Math.round(Number(v) || 1)
    level.value = Math.min(99, Math.max(1, n))
  },
})

const totalStatPoints = computed(() => MAX_QUEST_STAT_BONUS + 5 * (level.value - 1))
const spentStatPoints = computed(() => STAT_KEYS.reduce((sum, k) => sum + allocatedStats[k], 0))
const remainingStatPoints = computed(() => totalStatPoints.value - spentStatPoints.value)

const totalSkillPoints = computed(() => MAX_QUEST_SKILL_BONUS + (level.value - 1))
const spentSkillPoints = computed(() => Object.values(allocatedSkills).reduce((sum, v) => sum + v, 0))
const remainingSkillPoints = computed(() => totalSkillPoints.value - spentSkillPoints.value)

function skillKey(tabIdx, skillIdx) {
  return `${selectedClass.value}-${tabIdx}-${skillIdx}`
}

function skillPoint(tabIdx, skillIdx) {
  return allocatedSkills[skillKey(tabIdx, skillIdx)] || 0
}

// 스킬 이름 -> {tabIdx, skillIdx} 조회용 (같은 클래스 내 다른 스킬 선행/시너지 참조에 사용)
const skillLocationByName = computed(() => {
  const map = {}
  classTabs.value.forEach((tab, tabIdx) => {
    tab.skills.forEach((s, skillIdx) => {
      map[s.name] = { tabIdx, skillIdx }
    })
  })
  return map
})

// ---- 빌드 공유 링크 ----
const shareUrl = ref('')
const shareCopied = ref(false)

function encodeShareCode(payload) {
  const json = JSON.stringify(payload)
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeShareCode(code) {
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    return JSON.parse(decodeURIComponent(escape(atob(b64))))
  } catch (e) {
    return null
  }
}

function buildSharePayload() {
  const sk = {}
  classTabs.value.forEach((tab, tabIdx) => {
    tab.skills.forEach((skill, skillIdx) => {
      const p = skillPoint(tabIdx, skillIdx)
      if (p > 0) sk[skill.name] = p
    })
  })
  return {
    c: selectedClass.value,
    l: level.value,
    st: { ...allocatedStats },
    sk,
    eq: { ...equippedItems },
  }
}

async function applyShareState(data) {
  if (!data || !classStats[data.c] || !skillData[data.c]) return
  skipClassReset = true
  selectedClass.value = data.c
  await nextTick()
  skipClassReset = false

  level.value = Math.min(99, Math.max(1, Number(data.l) || 90))
  STAT_KEYS.forEach((k) => (allocatedStats[k] = Number(data.st?.[k]) || 0))
  Object.keys(allocatedSkills).forEach((k) => delete allocatedSkills[k])
  if (data.sk) {
    Object.entries(data.sk).forEach(([name, pts]) => {
      const loc = skillLocationByName.value[name]
      if (loc) allocatedSkills[skillKey(loc.tabIdx, loc.skillIdx)] = Number(pts) || 0
    })
  }
  SLOT_DEFS.forEach((s) => (equippedItems[s.key] = (data.eq && data.eq[s.key]) || ''))
}

async function shareLink() {
  const code = encodeShareCode(buildSharePayload())
  router.replace({ path: '/simulator', query: { b: code } }).catch(() => {})
  shareUrl.value = `${window.location.origin}${window.location.pathname}#/simulator?b=${code}`
  shareCopied.value = false
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    shareCopied.value = true
  } catch (e) {
    // 클립보드 권한이 없으면 링크를 화면에 그대로 보여줘서 수동 복사하게 함
  }
}

onMounted(() => {
  if (typeof route.query.b === 'string') {
    applyShareState(decodeShareCode(route.query.b))
  }
})

function skillPointByName(name) {
  const loc = skillLocationByName.value[name]
  return loc ? skillPoint(loc.tabIdx, loc.skillIdx) : 0
}

// 이 스킬을 선행 스킬로 요구하는 다른 스킬 중 포인트가 찍혀 있는 게 있는지
function hasDependents(name) {
  return classTabs.value.some((tab) =>
    tab.skills.some((s) => s.reqSkills && s.reqSkills.includes(name) && skillPointByName(s.name) > 0)
  )
}

function canIncreaseSkill(tabIdx, skillIdx) {
  const skill = classTabs.value[tabIdx].skills[skillIdx]
  const current = skillPoint(tabIdx, skillIdx)
  if (remainingSkillPoints.value <= 0) return false
  if (current >= 20) return false
  if (level.value < skill.reqLevel) return false
  if (skill.reqSkills && skill.reqSkills.some((name) => skillPointByName(name) < 1)) return false
  return true
}

function canDecreaseSkill(tabIdx, skillIdx) {
  const skill = classTabs.value[tabIdx].skills[skillIdx]
  const current = skillPoint(tabIdx, skillIdx)
  if (current <= 0) return false
  if (current === 1 && hasDependents(skill.name)) return false
  return true
}

function effectiveSkillLevel(tabIdx, skillIdx) {
  const skill = classTabs.value[tabIdx].skills[skillIdx]
  const hard = skillPoint(tabIdx, skillIdx)
  if (hard <= 0) return 0
  const bonus = itemSkillBonus(itemAgg.value, skill.name, classTabs.value[tabIdx].name)
  return hard + bonus
}

function skillDamage(tabIdx, skillIdx) {
  const skill = classTabs.value[tabIdx].skills[skillIdx]
  const hard = skillPoint(tabIdx, skillIdx)
  if (!hard || !skill.dmg) return null
  return computeSkillDamage(skill, effectiveSkillLevel(tabIdx, skillIdx), skillPointByName)
}

function synergySources(skill) {
  const list = [...(skill.synergyPhy || []), ...(skill.synergyEle || [])]
  const seen = new Set()
  return list.filter((s) => (seen.has(s.skill) ? false : seen.add(s.skill)))
}

function tierRowOf(skill) {
  const idx = TIER_LEVELS.indexOf(skill.reqLevel)
  return idx === -1 ? 0 : idx
}

function nodeColor(skill) {
  return ELEMENT_COLORS[skill.dmg?.ele?.type] || ELEMENT_COLORS[skill.dmg?.phy ? 'phy' : ''] || null
}

// 스킬을 속성/역할별로 분류해 아이콘을 고름 (원작 아이콘이 아닌 자체 제작 심볼)
function skillIconKey(skill, tabName) {
  if (skill.dmg?.ele?.type) return skill.dmg.ele.type
  if (skill.dmg?.phy) return 'phy'
  if (tabName.includes('오라')) return 'aura'
  if (tabName.includes('함성')) return 'warcry'
  if (tabName.includes('저주')) return 'curse'
  if (tabName.includes('소환') || tabName.includes('악마')) return 'summon'
  if (tabName.includes('마스터리') || tabName.includes('숙련')) return 'mastery'
  if (tabName.includes('변신')) return 'shapeshift'
  return 'passive'
}

// 탭별로 스킬을 티어(요구 레벨)에 따라 행에 배치하고, 선행 스킬 관계를 잇는 꺾은선(엘보) 좌표를 계산
function layoutForTab(tabIdx) {
  const tab = classTabs.value[tabIdx]
  if (!tab) return { nodes: [], edges: [] }
  const rows = [[], [], [], [], [], []]
  tab.skills.forEach((skill, skillIdx) => rows[tierRowOf(skill)].push(skillIdx))

  // 각 스킬이 선행 스킬로부터 물려받는 "체인 위치"를 계산 - 실제 게임처럼 한번 시작된 세로줄을
  // 부모-자식 관계를 따라 최대한 유지하기 위함 (매 행마다 독립적으로 다시 배치하면 가로선이 난잡해짐)
  const chainKey = {}
  let nextChain = 0

  const positions = {}
  const nodes = []
  rows.forEach((rowSkillIdxs, rowIdx) => {
    const count = rowSkillIdxs.length
    const y = ((rowIdx + 0.5) / 6) * 100

    rowSkillIdxs.forEach((skillIdx) => {
      const skill = tab.skills[skillIdx]
      const reqIdxs = (skill.reqSkills || [])
        .map((n) => tab.skills.findIndex((s) => s.name === n))
        .filter((i) => i !== -1 && chainKey[i] !== undefined)
      chainKey[skillIdx] = reqIdxs.length
        ? reqIdxs.reduce((sum, i) => sum + chainKey[i], 0) / reqIdxs.length
        : nextChain++
    })

    // 물려받은 체인 위치 순서로 정렬한 뒤 컬럼을 배정해서, 선행 스킬과 같은 세로줄을 최대한 유지
    const sorted = [...rowSkillIdxs].sort((a, b) => chainKey[a] - chainKey[b])
    sorted.forEach((skillIdx, i) => {
      let col
      if (count === 1) col = 1
      else if (count === 2) col = i === 0 ? 0 : 2
      else col = (i / (count - 1)) * 2
      const x = ((col + 0.5) / 3) * 100
      positions[skillIdx] = { x, y }
      nodes.push({ skillIdx, x, y, skill: tab.skills[skillIdx], icon: skillIconKey(tab.skills[skillIdx], tab.name) })
    })
  })

  const edges = []
  tab.skills.forEach((skill, skillIdx) => {
    ;(skill.reqSkills || []).forEach((reqName) => {
      const reqIdx = tab.skills.findIndex((s) => s.name === reqName)
      const from = positions[reqIdx]
      const to = positions[skillIdx]
      if (reqIdx !== -1 && from && to) {
        const midY = (from.y + to.y) / 2
        const arrowGap = 5.6 // 노드 타일 반지름만큼 화살촉이 타일에 가리지 않도록 앞에서 멈춤
        const endY = to.y - arrowGap
        edges.push({ srcIdx: reqIdx, path: `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${endY}` })
      }
    })
  })

  return { nodes, edges }
}

const treeLayouts = computed(() => classTabs.value.map((_, tabIdx) => layoutForTab(tabIdx)))

function resetTab(tabIdx) {
  const tab = classTabs.value[tabIdx]
  tab.skills.forEach((_, skillIdx) => delete allocatedSkills[skillKey(tabIdx, skillIdx)])
  if (selectedNode.value && selectedNode.value.tabIdx === tabIdx) selectedNode.value = null
}

const selectedSkill = computed(() => {
  if (!selectedNode.value) return null
  const { tabIdx, skillIdx } = selectedNode.value
  return classTabs.value[tabIdx]?.skills[skillIdx] || null
})

function onNodeClick(tabIdx, skillIdx) {
  selectedNode.value = { tabIdx, skillIdx }
  increaseSkill(tabIdx, skillIdx)
}

function increaseSkill(tabIdx, skillIdx) {
  if (!canIncreaseSkill(tabIdx, skillIdx)) return
  const key = skillKey(tabIdx, skillIdx)
  allocatedSkills[key] = (allocatedSkills[key] || 0) + 1
}

function decreaseSkill(tabIdx, skillIdx) {
  if (!canDecreaseSkill(tabIdx, skillIdx)) return
  const key = skillKey(tabIdx, skillIdx)
  const next = (allocatedSkills[key] || 0) - 1
  if (next <= 0) delete allocatedSkills[key]
  else allocatedSkills[key] = next
}

function increaseStat(key) {
  if (remainingStatPoints.value <= 0) return
  allocatedStats[key]++
}

function decreaseStat(key) {
  if (allocatedStats[key] <= 0) return
  allocatedStats[key]--
}

const displayStats = computed(() => {
  const b = classInfo.value.base
  const g = itemAgg.value
  return STAT_KEYS.map((k) => ({
    key: k,
    label: STAT_LABELS[k],
    base: b[k],
    added: allocatedStats[k],
    gear: g[k],
    total: b[k] + allocatedStats[k] + g[k],
  }))
})

const derivedStats = computed(() => {
  const c = classInfo.value
  const g = itemAgg.value
  const lvl = level.value
  const ac = Math.round((g.acFlat || 0) * (1 + (g.acPercent || 0) / 100))
  return {
    life: Math.round(c.life + c.lifePerLevel * (lvl - 1) + c.lifePerVit * allocatedStats.vit + g.life),
    mana: Math.round(c.mana + c.manaPerLevel * (lvl - 1) + c.manaPerNrg * allocatedStats.nrg + g.mana),
    stamina: Math.round(c.stamina + c.staminaPerLevel * (lvl - 1) + c.staminaPerVit * allocatedStats.vit),
    armor: ac,
    resist: {
      fire: Math.min(75, Math.round(g.resist.fire)),
      cold: Math.min(75, Math.round(g.resist.cold)),
      ltng: Math.min(75, Math.round(g.resist.ltng)),
      pois: Math.min(75, Math.round(g.resist.pois)),
    },
    weaponDamage: g.weaponDamage ? { min: Math.round(g.weaponDamage.min), max: Math.round(g.weaponDamage.max) } : null,
  }
})

const tabSpent = computed(() => classTabs.value.map((tab, tabIdx) => tab.skills.reduce((sum, s, i) => sum + skillPoint(tabIdx, i), 0)))
</script>

<template>
  <div class="items-page simulator-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>스킬·스탯 시뮬레이터</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">빌드 계획 도구</div>
      <h1>스킬·스탯 시뮬레이터</h1>
      <p>레벨·스탯·스킬 포인트에 장비까지 껴서 데미지·생명력·저항 같은 캐릭터 상세 정보를 미리 확인해보세요. 스킬 데미지·시너지는 실제 게임 데이터 기준이에요 (오라/마스터리 효과, 근접 스킬의 무기-스킬 결합 계산은 아직 단순화된 상태예요).</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs sim-class-tabs">
        <button v-for="c in classKeys" :key="c" :class="{ active: selectedClass === c }" @click="selectedClass = c">
          <span class="sim-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[c]"></svg></span>
          {{ classStats[c].name }}
        </button>
      </div>
    </div>
  </div>

  <div class="grid-wrap sim-wrap">
    <div class="sim-controls">
      <label class="sim-field">
        <span>캐릭터 레벨</span>
        <input type="number" min="1" max="99" v-model="clampedLevel" />
      </label>
      <button class="sim-reset-btn" @click="resetAll">빌드 초기화</button>
      <button class="sim-reset-btn sim-share-btn" @click="shareLink">빌드 공유 링크 만들기</button>
    </div>

    <div class="sim-share-box" v-if="shareUrl">
      <input class="sim-share-input" type="text" :value="shareUrl" readonly @focus="$event.target.select()" />
      <span class="sim-share-status">{{ shareCopied ? '링크가 복사됐어요' : '복사가 안 되면 위 링크를 직접 선택해서 복사해주세요' }}</span>
    </div>

    <div class="note-box sim-quest-note">퀘스트 보상은 전부 클리어한 상태를 기본값으로 계산해요 (스킬 포인트 +{{ MAX_QUEST_SKILL_BONUS }}, 스탯 포인트 +{{ MAX_QUEST_STAT_BONUS }} 포함).</div>

    <div class="sim-sheet">
      <section class="sim-zone sim-zone-equip">
        <header class="sim-zone-head">
          <h2>장비</h2>
          <button class="sim-link-btn" @click="resetEquip">초기화</button>
        </header>

        <div class="sim-doll">
          <label
            class="sim-slot" v-for="s in SLOT_DEFS" :key="s.key"
            :style="{ gridArea: DOLL_AREA[s.key] }" :title="s.label"
            :class="{ small: SMALL_DOLL_SLOTS.has(s.key) }"
          >
            <div class="sim-slot-tile" :class="{ filled: equippedItems[s.key] }">
              <img
                class="sim-slot-art" :class="{ mirror: s.key === 'shield' }"
                :src="equipSilhouetteUrl(s.key)" :alt="s.label" draggable="false"
              />
            </div>
            <select class="sim-slot-select" v-model="equippedItems[s.key]">
              <option value="">비어있음</option>
              <option v-for="it in itemsBySlot[s.key]" :key="it.id" :value="it.id">
                {{ it.name_ko }}{{ it.category === 'runeword' ? ' (룬워드)' : '' }}
              </option>
            </select>
          </label>
        </div>

        <div class="sim-inv-grid" aria-hidden="true">
          <div class="sim-inv-cell" v-for="i in 40" :key="i"></div>
        </div>

        <p class="sim-zone-note">유니크·세트·룬워드 데이터 기준으로 스탯·저항·방어력·+스킬을 합산해요. 소켓·인벤토리 참은 아직 없어요.</p>
      </section>

      <div class="sim-zone-divider"></div>

      <section class="sim-zone sim-zone-tree">
        <header class="sim-zone-head">
          <h2>스킬 포인트</h2>
          <span class="sim-zone-meta" :class="{ warn: remainingSkillPoints < 0 }">{{ remainingSkillPoints }} / {{ totalSkillPoints }} 남음</span>
        </header>

        <div class="sim-tree-row">
          <div class="sim-tab" v-for="(tab, tabIdx) in classTabs" :key="tab.name">
            <div class="sim-tab-head">
              <span>{{ tab.name }}</span>
              <small>{{ tabSpent[tabIdx] }} 포인트 사용</small>
            </div>
            <div class="sim-tab-body">
              <svg class="sim-tab-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <marker id="tree-arrow" markerWidth="5" markerHeight="4.6" refX="4" refY="2.3" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L5,2.3 L0,4.6 Z" fill="#66645c" />
                  </marker>
                  <marker id="tree-arrow-lit" markerWidth="5" markerHeight="4.6" refX="4" refY="2.3" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L5,2.3 L0,4.6 Z" fill="var(--gold-dim)" />
                  </marker>
                </defs>
                <path
                  v-for="(e, i) in treeLayouts[tabIdx].edges" :key="i"
                  :d="e.path"
                  class="sim-tab-edge"
                  :class="{ lit: skillPoint(tabIdx, e.srcIdx) > 0 }"
                  :marker-end="skillPoint(tabIdx, e.srcIdx) > 0 ? 'url(#tree-arrow-lit)' : 'url(#tree-arrow)'"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              <div
                v-for="n in treeLayouts[tabIdx].nodes" :key="n.skillIdx"
                class="sim-node-slot"
                :style="{ left: n.x + '%', top: n.y + '%' }"
                :class="{ invested: skillPoint(tabIdx, n.skillIdx) > 0, maxed: skillPoint(tabIdx, n.skillIdx) >= 20 }"
              >
                <button
                  class="sim-node"
                  :class="{
                    invested: skillPoint(tabIdx, n.skillIdx) > 0,
                    locked: skillPoint(tabIdx, n.skillIdx) === 0 && !canIncreaseSkill(tabIdx, n.skillIdx),
                    selected: selectedNode && selectedNode.tabIdx === tabIdx && selectedNode.skillIdx === n.skillIdx,
                  }"
                  :title="n.skill.name"
                  @click="onNodeClick(tabIdx, n.skillIdx)"
                >
                  <img v-if="realIconUrl(selectedClass, n.skill.name)" class="sim-node-art" :src="realIconUrl(selectedClass, n.skill.name)" :alt="n.skill.name" draggable="false" />
                  <svg v-else class="sim-node-art-fallback" viewBox="0 0 24 24" v-html="SKILL_ICONS[n.icon]"></svg>
                </button>
                <span class="sim-node-badge" v-if="skillPoint(tabIdx, n.skillIdx) > 0">{{ skillPoint(tabIdx, n.skillIdx) }}</span>
              </div>
              <button class="sim-tab-reset" title="이 계열 초기화" @click="resetTab(tabIdx)">✕</button>
            </div>
          </div>
        </div>

        <div class="sim-detail" v-if="selectedSkill">
          <div class="sim-detail-head">
            <div class="sim-detail-title">
              <strong>{{ selectedSkill.name }}</strong>
              <span>
                요구 레벨 {{ selectedSkill.reqLevel }}
                <template v-if="selectedSkill.reqSkills && selectedSkill.reqSkills.length"> · 선행: {{ selectedSkill.reqSkills.join(', ') }}</template>
              </span>
            </div>
            <div class="sim-detail-pm">
              <button class="sim-pm" @click="decreaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)" :disabled="!canDecreaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)">−</button>
              <b>{{ skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) }}</b>
              <button class="sim-pm" @click="increaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)" :disabled="!canIncreaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)">+</button>
            </div>
          </div>
          <div class="sim-detail-body" v-if="skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) > 0 && (selectedSkill.dmg || synergySources(selectedSkill).length)">
            <p v-if="effectiveSkillLevel(selectedNode.tabIdx, selectedNode.skillIdx) !== skillPoint(selectedNode.tabIdx, selectedNode.skillIdx)">
              유효 스킬 레벨 {{ effectiveSkillLevel(selectedNode.tabIdx, selectedNode.skillIdx) }} <small>(하드 {{ skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) }} + 장비 {{ effectiveSkillLevel(selectedNode.tabIdx, selectedNode.skillIdx) - skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) }})</small>
            </p>
            <p v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx)?.ele">
              {{ ELEMENT_LABELS[skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.type] }} 데미지 {{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.min }}~{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.max }}
              <span class="sim-detail-pct" v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.percent">(시너지 +{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.percent }}%)</span>
            </p>
            <p v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx)?.phy">
              물리 데미지 {{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.min }}~{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.max }} <small>(무기 데미지 제외)</small>
              <span class="sim-detail-pct" v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.percent">(시너지 +{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.percent }}%)</span>
            </p>
            <p class="sim-detail-syn" v-if="synergySources(selectedSkill).length">
              시너지 제공: <span v-for="(s, i) in synergySources(selectedSkill)" :key="s.skill">{{ i > 0 ? ', ' : '' }}{{ s.skill }}(+{{ s.percent }}%/lv)</span>
            </p>
          </div>
        </div>
        <div class="sim-detail sim-detail-empty" v-else>스킬 아이콘을 클릭해서 포인트를 찍어보세요</div>
      </section>

      <div class="sim-zone-divider"></div>

      <section class="sim-zone sim-zone-stats">
        <header class="sim-zone-head">
          <h2>스탯</h2>
          <span class="sim-zone-meta" :class="{ warn: remainingStatPoints < 0 }">{{ remainingStatPoints }} / {{ totalStatPoints }} 남음</span>
        </header>
        <div class="sim-stat-row" v-for="s in displayStats" :key="s.key">
          <span class="sim-stat-label">{{ s.label }}</span>
          <div class="sim-stepper">
            <button class="sim-step-btn" @click="decreaseStat(s.key)" :disabled="allocatedStats[s.key] <= 0">‹</button>
            <span class="sim-step-value">{{ s.total }}</span>
            <button class="sim-step-btn" @click="increaseStat(s.key)" :disabled="remainingStatPoints <= 0">›</button>
          </div>
          <span class="sim-stat-detail">기본 {{ s.base }}+투자 {{ s.added }}<template v-if="s.gear">+장비 {{ s.gear }}</template></span>
        </div>

        <header class="sim-zone-head sim-zone-head-sub">
          <h2>예상 능력치</h2>
        </header>
        <div class="sim-derived-row"><span>생명력</span><b>{{ derivedStats.life }}</b></div>
        <div class="sim-derived-row"><span>마나</span><b>{{ derivedStats.mana }}</b></div>
        <div class="sim-derived-row"><span>스태미나</span><b>{{ derivedStats.stamina }}</b></div>
        <div class="sim-derived-row"><span>방어력</span><b>{{ derivedStats.armor }}</b></div>
        <div class="sim-derived-row" v-if="derivedStats.weaponDamage"><span>무기 데미지</span><b>{{ derivedStats.weaponDamage.min }}~{{ derivedStats.weaponDamage.max }}</b></div>
        <div class="sim-derived-row">
          <span>저항 화/냉/전/독</span>
          <b>{{ derivedStats.resist.fire }}/{{ derivedStats.resist.cold }}/{{ derivedStats.resist.ltng }}/{{ derivedStats.resist.pois }}%</b>
        </div>
        <p class="sim-zone-note">스탯 성장은 커뮤니티 자료 기준 근사치, 저항 75% 상한 적용.</p>
      </section>
    </div>
  </div>
  </div>
</template>

<style scoped>
.sim-wrap{max-width:1680px;}

.sim-class-tabs button{display:flex; align-items:center; gap:7px;}
.sim-class-icon{width:16px; height:16px; display:inline-flex; flex:none;}
.sim-class-icon svg{width:100%; height:100%; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}

.sim-controls{display:flex; flex-wrap:wrap; align-items:end; gap:16px; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border-soft);}
.sim-field{display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-muted);}
.sim-field input{
  width:120px; background:var(--panel); border:1px solid var(--border); border-radius:4px; color:var(--text);
  padding:9px 12px; font-size:14px; font-family:inherit;
}
.sim-field input:focus{outline:none; border-color:var(--gold-dim);}
.sim-reset-btn{border:1px solid var(--border); border-radius:4px; color:var(--text-muted); padding:9px 16px; font-size:12.5px; height:38px;}
.sim-reset-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.sim-share-btn{border-color:var(--gold-dim); color:var(--gold);}
.sim-share-btn:hover{background:var(--panel);}

.sim-share-box{display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:-8px 0 24px;}
.sim-share-input{
  flex:1; min-width:220px; background:var(--panel); border:1px solid var(--border); border-radius:4px; color:var(--text);
  padding:9px 12px; font-size:12.5px; font-family:inherit;
}
.sim-share-input:focus{outline:none; border-color:var(--gold-dim);}
.sim-share-status{font-size:11.5px; color:var(--text-dim);}

.sim-quest-note{margin-bottom:20px;}

/* ---- 하나의 시트 위에 장비·스킬·스탯을 함께 배치 (실제 게임 돌기둥 텍스처가 전체를 지나감) ---- */
.sim-sheet{
  position:relative; isolation:isolate;
  display:grid; grid-template-columns:320px 1px 1fr 1px 280px; gap:24px;
  border:1px solid var(--gold-dim); padding:24px;
}
.sim-sheet::before{
  /* 원본 menupanel.png은 위아래에 금색 가로줄 장식이 있어서 세로로 반복 타일링하면
     띠처럼 도드라져 보임 → 그 부분을 잘라낸 순수 돌 질감만 반복 사용 */
  content:''; position:absolute; inset:0; z-index:-1;
  background-image:url('../assets/uitextures/menupanel_tile.png');
  background-size:240px 120px; background-repeat:repeat;
  filter:grayscale(0.5) brightness(0.5) contrast(1.05);
}
.sim-zone{min-width:0;}
.sim-zone-equip{display:flex; flex-direction:column;}
.sim-zone-divider{background:linear-gradient(180deg, transparent, var(--gold-dim) 15%, var(--gold-dim) 85%, transparent); opacity:0.35;}

.sim-zone-head{
  display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  padding-bottom:10px; margin-bottom:16px; border-bottom:2px solid var(--gold-dim);
}
.sim-zone-head h2{font-size:15px; font-family:'Noto Serif KR', serif; font-weight:700; color:var(--gold); margin:0;}
.sim-zone-head-sub{margin-top:24px;}
.sim-zone-meta{font-size:11.5px; color:var(--text-dim); white-space:nowrap;}
.sim-zone-meta.warn{color:var(--blood);}
.sim-link-btn{font-size:11.5px; color:var(--text-muted); border:none; background:none; text-decoration:underline; cursor:pointer; padding:0;}
.sim-link-btn:hover{color:var(--gold);}
.sim-zone-note{margin-top:14px; font-size:11px; color:var(--text-dim); line-height:1.5;}

@media (max-width:1150px){
  .sim-sheet{grid-template-columns:1fr;}
  .sim-zone-divider{display:none;}
}

/* ---- 장비 인형 ---- */
/* 3단 시트가 1150px 아래에서 세로로 쌓이면 이 구역이 전체 폭을 그대로 물려받아
   슬롯이 거대해지고 사이 여백만 늘어나므로, 인형 자체는 항상 컴팩트한 폭으로 고정 */
.sim-doll{
  display:grid; gap:10px; grid-template-columns:1.05fr 0.6fr 1.05fr 0.6fr 1.05fr; grid-template-rows:repeat(3, 1fr);
  max-width:340px; margin:0 auto; aspect-ratio:5/3.3;
  grid-template-areas:
    "weapon .      helm   amulet shield"
    "weapon .      armor  .      shield"
    "gloves ring1  belt   ring2  boots";
}
.sim-slot{position:relative; display:block;}
.sim-slot.small{padding:16% 8%;}
.sim-slot-tile{
  /* 실제 장비창은 스킬트리 노드와 달리 청동 테두리/리벳이 없고, 돌 패널에 그대로
     깎아넣은 듯한 무채색 인셋 프레임임 */
  position:relative; width:100%; height:100%; border-radius:2px; border:1px solid #5a5751;
  background:linear-gradient(160deg, #2a2823, #100f0d 60%, #060605);
  box-shadow:inset 0 2px 5px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,255,255,0.06);
  display:flex; align-items:center; justify-content:center;
  transition:border-color .15s, box-shadow .15s;
}
.sim-slot-tile.filled{border-color:var(--gold); box-shadow:inset 0 2px 5px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 10px -2px var(--gold-dim);}
.sim-slot-art{width:74%; height:74%; object-fit:contain; pointer-events:none; filter:brightness(1.7); opacity:0.5; transition:filter .15s, opacity .15s;}
.sim-slot-art.mirror{transform:scaleX(-1);}
.sim-slot-tile.filled .sim-slot-art{filter:brightness(2.3) sepia(0.3) saturate(1.4); opacity:1;}
.sim-slot-select{position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; padding:0; margin:0;}

.sim-inv-grid{
  flex:1; min-height:120px; max-width:340px; width:100%; margin:16px auto 0;
  display:grid; grid-template-columns:repeat(10, 1fr); grid-auto-rows:1fr; gap:3px;
  border:1px solid var(--border-soft); padding:8px; background:rgba(0,0,0,0.3);
}
.sim-inv-cell{border:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.3);}

/* ---- 스킬 트리 ---- */
.sim-tree-row{display:grid; grid-template-columns:repeat(3, 1fr); gap:0; border:1px solid var(--border-soft); border-radius:4px; overflow:hidden;}
.sim-tab{display:flex; flex-direction:column; min-width:0; border-left:1px solid var(--border-soft);}
.sim-tab:first-child{border-left:none;}
.sim-tab-head{
  display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center;
  font-size:12.5px; font-weight:700; color:var(--text);
  padding:8px 6px; background:rgba(0,0,0,0.35); border-bottom:1px solid var(--border-soft);
}
.sim-tab-head small{color:var(--text-dim); font-weight:400; font-size:10.5px;}
.sim-tab-body{position:relative; height:440px; padding:0 8px;}
.sim-tab-svg{position:absolute; inset:0; width:100%; height:100%; overflow:visible;}
.sim-tab-edge{fill:none; stroke:#5a584f; stroke-width:4px; stroke-linecap:butt; stroke-linejoin:miter; opacity:0.85; transition:stroke .15s;}
.sim-tab-edge.lit{stroke:var(--gold-dim); opacity:1;}

.sim-node-slot{position:absolute; width:42px; height:42px; transform:translate(-50%,-50%);}
.sim-node{
  width:100%; height:100%; border-radius:2px; border:2px solid #6b4a2e;
  background:linear-gradient(160deg, #4d453a, #221e19 55%, #171410);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 3px rgba(0,0,0,0.6);
  display:flex; align-items:center; justify-content:center; padding:2px;
  transition:border-color .15s, box-shadow .15s, transform .1s, filter .15s;
}
.sim-node:hover{transform:scale(1.1); border-color:var(--gold-dim);}
/* 멕스롤/실제 게임은 선행 스킬 미충족 여부와 무관하게 0포인트 상태의 아이콘을
   전부 똑같은 밝기로 보여줌 (투자 여부만 금테두리로 구분) — 잠긴 스킬만 회색
   처리하면 밝고 어두운 타일이 뒤섞여 지저분해 보이므로 커서만 바꾸고 톤은 유지 */
.sim-node.locked{cursor:default;}
.sim-node.invested{border-color:var(--gold); box-shadow:inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 3px rgba(0,0,0,0.6), 0 0 8px -1px var(--gold-dim);}
.sim-node-slot.maxed .sim-node{border-color:var(--gold); box-shadow:inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 3px rgba(0,0,0,0.6), 0 0 12px 0 var(--gold);}
.sim-node.selected{outline:2px solid var(--gold); outline-offset:2px;}
/* 실제 화면(멕스롤/인게임)은 스킬 아이콘이 채색이 아니라 은색/흰색 선화에 가까움 */
.sim-node-art{width:100%; height:100%; object-fit:contain; pointer-events:none; border-radius:1px; filter:grayscale(0.75) contrast(1.35) brightness(1.3);}
.sim-node-art-fallback{width:65%; height:65%; stroke:currentColor; fill:none; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; pointer-events:none; color:#a8a296;}
.sim-node-badge{
  position:absolute; right:-5px; bottom:-5px; min-width:16px; height:14px; padding:0 3px; border-radius:3px;
  background:#0b0a08; color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; border:1px solid #6b5d47;
}
.sim-tab-reset{
  position:absolute; left:-4px; bottom:-4px; width:20px; height:20px; border-radius:50%;
  background:#0b0a08; border:1px solid #4a3f30; color:var(--text-dim); font-size:11px; line-height:1; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
}
.sim-tab-reset:hover{color:var(--blood); border-color:var(--blood);}

.sim-detail{margin-top:18px; padding:14px 16px; border:1px solid var(--border-soft); border-radius:6px; background:rgba(0,0,0,0.25); min-height:60px;}
.sim-detail-empty{display:flex; align-items:center; justify-content:center; color:var(--text-dim); font-size:12.5px;}
.sim-detail-head{display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap;}
.sim-detail-title{display:flex; flex-direction:column; gap:4px;}
.sim-detail-title strong{font-size:14.5px; color:var(--text); font-family:'Noto Serif KR', serif;}
.sim-detail-title span{font-size:11px; color:var(--text-dim);}
.sim-detail-pm{display:flex; align-items:center; gap:10px; flex:none;}
.sim-detail-pm b{width:22px; text-align:center; font-size:14px; color:var(--gold);}
.sim-detail-body{margin-top:12px; padding-top:12px; border-top:1px dashed var(--border-soft); font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;}
.sim-detail-body small{color:var(--text-dim); font-size:10.5px;}
.sim-detail-pct{color:var(--gold-dim); margin-left:4px;}
.sim-detail-syn{color:var(--text-dim); font-size:11.5px;}

.sim-pm{
  width:26px; height:26px; border:1px solid var(--border); border-radius:4px; color:var(--text-muted); font-size:14px; flex:none;
  display:flex; align-items:center; justify-content:center;
}
.sim-pm:hover:not(:disabled){border-color:var(--gold-dim); color:var(--gold);}
.sim-pm:disabled{opacity:0.35; cursor:default;}

/* ---- 스탯 ---- */
.sim-stat-row{display:flex; align-items:center; flex-wrap:wrap; gap:10px 12px; padding:8px 0; border-top:1px solid var(--border-soft);}
.sim-stat-row:first-of-type{border-top:none;}
.sim-stat-label{width:40px; font-size:13px; color:var(--text-muted); flex:none;}
.sim-stat-detail{font-size:10.5px; color:var(--text-dim); flex:1 1 100%; margin-left:52px;}

.sim-stepper{
  display:flex; align-items:center; flex:none; border-radius:999px; overflow:hidden;
  border:1px solid var(--border); background:#0c0b09;
}
.sim-step-btn{
  width:24px; height:24px; border:none; background:transparent; color:var(--text-dim);
  font-size:15px; line-height:1; display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.sim-step-btn:hover:not(:disabled){color:var(--gold);}
.sim-step-btn:disabled{opacity:0.3; cursor:default;}
.sim-step-value{min-width:26px; text-align:center; font-size:13.5px; font-weight:700; color:var(--text);}

.sim-derived-row{display:flex; justify-content:space-between; padding:7px 0; border-top:1px solid var(--border-soft); font-size:13px; color:var(--text-muted);}
.sim-derived-row:first-of-type{border-top:none;}
.sim-derived-row b{color:var(--gold); font-size:14px;}

@media (max-width:900px){
  .sim-tree-row{grid-template-columns:1fr;}
  .sim-tab-body{height:340px;}
}
@media (max-width:560px){
  .sim-node-slot{width:36px; height:36px;}
  .sim-controls{flex-direction:column; align-items:stretch;}
  .sim-field input{width:100%;}
}
</style>
