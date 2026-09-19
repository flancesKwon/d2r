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

  const positions = {}
  const nodes = []
  rows.forEach((rowSkillIdxs, rowIdx) => {
    const count = rowSkillIdxs.length
    const y = ((rowIdx + 0.5) / 6) * 100
    rowSkillIdxs.forEach((skillIdx, i) => {
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
        edges.push({ srcIdx: reqIdx, path: `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${to.y}` })
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

    <div class="side-block sim-panel sim-equip-box">
      <h3>장비 <button class="sim-reset-btn sim-equip-reset" @click="resetEquip">장비 초기화</button></h3>
      <div class="sim-equip-grid">
        <label class="sim-equip-slot" v-for="s in SLOT_DEFS" :key="s.key">
          <span>{{ s.label }}</span>
          <select v-model="equippedItems[s.key]">
            <option value="">비어있음</option>
            <option v-for="it in itemsBySlot[s.key]" :key="it.id" :value="it.id">
              {{ it.name_ko }}{{ it.category === 'runeword' ? ' (룬워드)' : '' }}
            </option>
          </select>
        </label>
      </div>
      <div class="note-box sim-note">아이템 사전 데이터(유니크·세트·룬워드) 기준으로 힘/민첩/활력/에너지·생명력·마나·저항·방어력·+스킬 옵션을 합산해요. 소켓 보석/룬, 인벤토리 참(charm)은 아직 빠져 있어요.</div>
    </div>

    <div class="sim-top-grid">
      <div class="side-block sim-panel">
        <h3>스탯 포인트 <span class="sim-remaining" :class="{ warn: remainingStatPoints < 0 }">남은 포인트 {{ remainingStatPoints }} / {{ totalStatPoints }}</span></h3>
        <div class="sim-stat-row" v-for="s in displayStats" :key="s.key">
          <span class="sim-stat-label">{{ s.label }}</span>
          <button class="sim-pm sim-pm-gem" @click="decreaseStat(s.key)" :disabled="allocatedStats[s.key] <= 0"><span>−</span></button>
          <span class="sim-stat-value">{{ s.total }}<small>(기본 {{ s.base }} + 투자 {{ s.added }}<template v-if="s.gear"> + 장비 {{ s.gear }}</template>)</small></span>
          <button class="sim-pm sim-pm-gem" @click="increaseStat(s.key)" :disabled="remainingStatPoints <= 0"><span>+</span></button>
        </div>
      </div>

      <div class="side-block sim-panel">
        <h3>예상 능력치</h3>
        <div class="sim-derived-row"><span>생명력</span><b>{{ derivedStats.life }}</b></div>
        <div class="sim-derived-row"><span>마나</span><b>{{ derivedStats.mana }}</b></div>
        <div class="sim-derived-row"><span>스태미나</span><b>{{ derivedStats.stamina }}</b></div>
        <div class="sim-derived-row"><span>방어력 (장비)</span><b>{{ derivedStats.armor }}</b></div>
        <div class="sim-derived-row" v-if="derivedStats.weaponDamage"><span>무기 물리 데미지</span><b>{{ derivedStats.weaponDamage.min }}~{{ derivedStats.weaponDamage.max }}</b></div>
        <div class="sim-derived-row">
          <span>저항 (화/냉/전/독)</span>
          <b>{{ derivedStats.resist.fire }}% / {{ derivedStats.resist.cold }}% / {{ derivedStats.resist.ltng }}% / {{ derivedStats.resist.pois }}%</b>
        </div>
        <div class="note-box sim-note">스탯 성장 공식은 커뮤니티 자료 기준 근사치예요. 저항은 75% 상한 적용, 방어력은 장비 고정치×(1+%증가)만 반영했어요.</div>
      </div>
    </div>

    <div class="sim-skill-section">
      <div class="sim-skill-head">
        <h3>스킬 포인트 <span class="sim-remaining" :class="{ warn: remainingSkillPoints < 0 }">남은 포인트 {{ remainingSkillPoints }} / {{ totalSkillPoints }}</span></h3>
      </div>
      <div class="sim-tree-columns">
        <div class="sim-tree-col-panel" v-for="(tab, tabIdx) in classTabs" :key="tab.name">
          <div class="sim-tree-col-head">{{ tab.name }} <small>{{ tabSpent[tabIdx] }} 포인트 사용</small></div>
          <div class="sim-tree-frame">
            <div class="sim-tree-canvas">
              <svg class="sim-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  v-for="(e, i) in treeLayouts[tabIdx].edges" :key="i"
                  :d="e.path"
                  class="sim-tree-edge"
                  :class="{ lit: skillPoint(tabIdx, e.srcIdx) > 0 }"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              <div
                v-for="n in treeLayouts[tabIdx].nodes" :key="n.skillIdx"
                class="sim-tree-node-ring"
                :style="{ left: n.x + '%', top: n.y + '%', '--node-color': nodeColor(n.skill) || 'var(--gold)', '--pct': (skillPoint(tabIdx, n.skillIdx) / 20) * 100 }"
                :class="{ invested: skillPoint(tabIdx, n.skillIdx) > 0, maxed: skillPoint(tabIdx, n.skillIdx) >= 20 }"
              >
                <button
                  class="sim-tree-node"
                  :class="{
                    invested: skillPoint(tabIdx, n.skillIdx) > 0,
                    locked: skillPoint(tabIdx, n.skillIdx) === 0 && !canIncreaseSkill(tabIdx, n.skillIdx),
                    selected: selectedNode && selectedNode.tabIdx === tabIdx && selectedNode.skillIdx === n.skillIdx,
                  }"
                  :title="n.skill.name"
                  @click="onNodeClick(tabIdx, n.skillIdx)"
                >
                  <img v-if="realIconUrl(selectedClass, n.skill.name)" class="sim-node-icon-img" :src="realIconUrl(selectedClass, n.skill.name)" :alt="n.skill.name" draggable="false" />
                  <svg v-else class="sim-node-icon" viewBox="0 0 24 24" v-html="SKILL_ICONS[n.icon]"></svg>
                </button>
                <span class="sim-node-badge" v-if="skillPoint(tabIdx, n.skillIdx) > 0">{{ skillPoint(tabIdx, n.skillIdx) }}</span>
              </div>
              <button class="sim-tree-reset" title="이 계열 초기화" @click="resetTab(tabIdx)">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="sim-tree-detail-wrap">
        <div class="sim-node-detail" v-if="selectedSkill">
          <div class="sim-node-detail-head">
            <div class="sim-node-detail-title">
              <span class="sim-skill-name">{{ selectedSkill.name }}</span>
              <span class="sim-skill-tier">
                요구 레벨 {{ selectedSkill.reqLevel }}
                <template v-if="selectedSkill.reqSkills && selectedSkill.reqSkills.length"> · 선행: {{ selectedSkill.reqSkills.join(', ') }}</template>
              </span>
            </div>
            <div class="sim-node-detail-pm">
              <button class="sim-pm" @click="decreaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)" :disabled="!canDecreaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)">−</button>
              <span class="sim-skill-value">{{ skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) }}</span>
              <button class="sim-pm" @click="increaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)" :disabled="!canIncreaseSkill(selectedNode.tabIdx, selectedNode.skillIdx)">+</button>
            </div>
          </div>
          <div class="sim-skill-detail" v-if="skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) > 0 && (selectedSkill.dmg || synergySources(selectedSkill).length)">
            <div class="sim-dmg-line" v-if="effectiveSkillLevel(selectedNode.tabIdx, selectedNode.skillIdx) !== skillPoint(selectedNode.tabIdx, selectedNode.skillIdx)">
              유효 스킬 레벨 {{ effectiveSkillLevel(selectedNode.tabIdx, selectedNode.skillIdx) }} <small>(하드포인트 {{ skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) }} + 장비 {{ effectiveSkillLevel(selectedNode.tabIdx, selectedNode.skillIdx) - skillPoint(selectedNode.tabIdx, selectedNode.skillIdx) }})</small>
            </div>
            <div class="sim-dmg-line" v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx)?.ele">
              {{ ELEMENT_LABELS[skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.type] }} 데미지 {{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.min }}~{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.max }}
              <span class="sim-syn-pct" v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.percent">(시너지 +{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).ele.percent }}%)</span>
            </div>
            <div class="sim-dmg-line" v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx)?.phy">
              물리 데미지 {{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.min }}~{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.max }} <small>(무기 데미지 제외, 스킬 자체 수치)</small>
              <span class="sim-syn-pct" v-if="skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.percent">(시너지 +{{ skillDamage(selectedNode.tabIdx, selectedNode.skillIdx).phy.percent }}%)</span>
            </div>
            <div class="sim-syn-line" v-if="synergySources(selectedSkill).length">
              시너지 제공: <span v-for="(s, i) in synergySources(selectedSkill)" :key="s.skill">{{ i > 0 ? ', ' : '' }}{{ s.skill }}(+{{ s.percent }}%/lv)</span>
            </div>
          </div>
        </div>
        <div class="sim-node-detail sim-node-detail-empty" v-else>스킬 아이콘을 클릭해서 포인트를 찍고 정보를 확인하세요</div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.sim-wrap{max-width:960px;}
.sim-class-tabs button{display:flex; align-items:center; gap:7px;}
.sim-class-icon{width:16px; height:16px; display:inline-flex; flex:none;}
.sim-class-icon svg{width:100%; height:100%; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}

.sim-controls{display:flex; flex-wrap:wrap; align-items:end; gap:16px; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border-soft);}
.sim-field{display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-muted);}
.sim-field input{
  width:120px; background:var(--panel); border:1px solid var(--border); color:var(--text);
  padding:9px 12px; font-size:14px; font-family:inherit;
}
.sim-field input:focus{outline:none; border-color:var(--gold-dim);}
.sim-reset-btn{border:1px solid var(--border); color:var(--text-muted); padding:9px 16px; font-size:12.5px; height:38px;}
.sim-reset-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.sim-share-btn{border-color:var(--gold-dim); color:var(--gold);}
.sim-share-btn:hover{background:var(--panel);}

.sim-share-box{display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:-8px 0 24px;}
.sim-share-input{
  flex:1; min-width:220px; background:var(--panel); border:1px solid var(--border); color:var(--text);
  padding:9px 12px; font-size:12.5px; font-family:inherit;
}
.sim-share-input:focus{outline:none; border-color:var(--gold-dim);}
.sim-share-status{font-size:11.5px; color:var(--text-dim);}

.sim-quest-note{margin-bottom:20px;}

.sim-equip-box{margin-bottom:20px;}
.sim-equip-box h3{display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:14px;}
.sim-equip-reset{height:auto; padding:6px 12px; font-size:11.5px;}
.sim-equip-grid{display:grid; grid-template-columns:repeat(2, 1fr); gap:10px 16px;}
.sim-equip-slot{display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--text-muted);}
.sim-equip-slot select{
  background:var(--panel); border:1px solid var(--border); color:var(--text);
  padding:8px 10px; font-size:12.5px; font-family:inherit; max-width:100%;
}
.sim-equip-slot select:focus{outline:none; border-color:var(--gold-dim);}
@media (max-width:560px){ .sim-equip-grid{grid-template-columns:1fr;} }

.sim-top-grid{display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px;}
.sim-panel{padding:18px 20px;}
.sim-panel h3{font-size:14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:6px;}
.sim-remaining{font-size:11.5px; color:var(--text-dim); font-weight:400;}
.sim-remaining.warn{color:var(--blood);}

.sim-stat-row{display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--border-soft);}
.sim-stat-row:first-of-type{border-top:none;}
.sim-stat-label{width:48px; font-size:13px; color:var(--text-muted); flex:none;}
.sim-stat-value{flex:1; font-size:14px; color:var(--text); font-weight:600;}
.sim-stat-value small{color:var(--text-dim); font-weight:400; font-size:11px; margin-left:4px;}

.sim-pm{
  width:28px; height:28px; border:1px solid var(--border); color:var(--text-muted); font-size:15px; flex:none;
  display:flex; align-items:center; justify-content:center;
}
.sim-pm:hover:not(:disabled){border-color:var(--gold-dim); color:var(--gold);}
.sim-pm:disabled{opacity:0.35; cursor:default;}

.sim-pm-gem{
  width:24px; height:24px; border:1px solid var(--gold-dim); background:linear-gradient(135deg, #3a2f1c, #1c1712);
  transform:rotate(45deg); border-radius:2px;
}
.sim-pm-gem span{transform:rotate(-45deg); color:var(--gold); font-size:13px; font-weight:700;}
.sim-pm-gem:hover:not(:disabled){box-shadow:0 0 8px -1px var(--gold-dim);}
.sim-pm-gem:disabled span{color:var(--text-dim);}

.sim-derived-row{display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid var(--border-soft); font-size:13.5px; color:var(--text-muted);}
.sim-derived-row:first-of-type{border-top:none;}
.sim-derived-row b{color:var(--gold); font-size:15px;}
.sim-note{margin-top:12px; margin-bottom:0;}

.sim-skill-head h3{font-size:15px; display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px; margin-bottom:14px;}

.sim-tree-columns{display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:4px;}
.sim-tree-col-panel{display:flex; flex-direction:column; min-width:0;}
.sim-tree-col-head{
  font-size:12.5px; color:var(--gold); margin-bottom:0; text-align:center; font-family:'Noto Serif KR', serif; font-weight:700;
  display:flex; flex-direction:column; gap:2px; justify-content:center;
  border:1px solid var(--gold-dim); border-bottom:none; background:linear-gradient(180deg, #3a342c, #24201a);
  padding:8px 6px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 4px rgba(0,0,0,0.5);
}
.sim-tree-col-head small{color:var(--text-muted); font-size:10.5px; font-family:'Noto Sans KR', sans-serif; font-weight:400;}

.sim-tree-frame{
  position:relative; border:1px solid var(--gold-dim); flex:1;
  background:
    radial-gradient(circle at 15% 10%, rgba(255,255,255,0.09), transparent 30%),
    radial-gradient(circle at 85% 20%, rgba(0,0,0,0.35), transparent 35%),
    radial-gradient(circle at 30% 80%, rgba(0,0,0,0.3), transparent 40%),
    radial-gradient(circle at 75% 65%, rgba(255,255,255,0.06), transparent 35%),
    repeating-linear-gradient(115deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 12px),
    repeating-linear-gradient(25deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 9px),
    linear-gradient(180deg, #4a443b, #2a251f);
  padding:10px; box-shadow:inset 0 0 0 1px var(--border-soft), inset 0 0 30px rgba(0,0,0,0.5);
}

.sim-tree-detail-wrap{margin-top:14px;}

.sim-tree-canvas{position:relative; width:100%; height:480px;}
.sim-tree-svg{position:absolute; inset:0; width:100%; height:100%; overflow:visible;}
.sim-tree-edge{fill:none; stroke:#6b6156; stroke-width:3px; stroke-linecap:square; stroke-linejoin:round; transition:stroke .15s; opacity:0.8;}
.sim-tree-edge.lit{stroke:var(--gold-dim); opacity:1;}

.sim-tree-node-ring{position:absolute; width:46px; height:46px; transform:translate(-50%,-50%);}

.sim-tree-node{
  width:100%; height:100%; border-radius:4px; border:2px solid #6b5d47;
  background:
    radial-gradient(circle at 30% 22%, rgba(255,255,255,0.1), transparent 35%),
    linear-gradient(160deg, #4d453a, #221e19 55%, #171410);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 3px rgba(0,0,0,0.65), 0 2px 4px rgba(0,0,0,0.5);
  color:var(--text-dim); display:flex; align-items:center; justify-content:center; padding:2px;
  transition:border-color .15s, box-shadow .15s, transform .1s, filter .15s;
}
.sim-tree-node:hover{transform:scale(1.08); border-color:var(--gold-dim);}
.sim-tree-node.locked{filter:grayscale(1) brightness(0.5); cursor:default;}
.sim-tree-node.invested{border-color:var(--gold); box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 3px rgba(0,0,0,0.65), 0 0 9px -1px var(--gold-dim);}
.sim-tree-node-ring.maxed .sim-tree-node{border-color:var(--gold); box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 3px rgba(0,0,0,0.65), 0 0 14px 0px var(--gold);}
.sim-tree-node.selected{outline:2px solid var(--gold); outline-offset:2px;}
.sim-node-icon{width:19px; height:19px; stroke:currentColor; fill:none; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; pointer-events:none; filter:drop-shadow(0 1px 1px rgba(0,0,0,0.8));}
.sim-node-icon-img{width:100%; height:100%; object-fit:cover; pointer-events:none; border-radius:2px;}
.sim-node-badge{
  position:absolute; right:-5px; bottom:-5px; min-width:17px; height:15px; padding:0 3px; border-radius:3px;
  background:#0b0a08; color:#fff; font-size:10.5px; font-weight:700; font-family:'Noto Sans KR', sans-serif;
  display:flex; align-items:center; justify-content:center; border:1px solid #6b5d47;
}

.sim-tree-reset{
  position:absolute; left:-6px; bottom:-6px; width:22px; height:22px; border-radius:50%;
  background:#0b0a08; border:1px solid #4a3f30; color:var(--text-dim); z-index:2;
  display:flex; align-items:center; justify-content:center;
}
.sim-tree-reset svg{width:13px; height:13px; stroke:currentColor; fill:none; stroke-width:1.8;}
.sim-tree-reset:hover{color:var(--blood); border-color:var(--blood);}

.sim-node-detail{
  margin-top:14px; padding:14px 16px; border:1px solid var(--border-soft); background:var(--panel); min-height:64px;
}
.sim-node-detail-empty{display:flex; align-items:center; justify-content:center; color:var(--text-dim); font-size:12.5px;}
.sim-node-detail-head{display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap;}
.sim-node-detail-title{display:flex; flex-direction:column; gap:4px;}
.sim-node-detail-pm{display:flex; align-items:center; gap:10px; flex:none;}
.sim-skill-name{font-size:14.5px; color:var(--text); font-family:'Noto Serif KR', serif; font-weight:700;}
.sim-skill-tier{font-size:11px; color:var(--text-dim);}
.sim-skill-value{width:22px; text-align:center; font-size:14px; color:var(--gold); font-weight:700; flex:none;}
.sim-skill-detail{margin-top:12px; padding-top:12px; border-top:1px dashed var(--border-soft); font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;}
.sim-dmg-line small{color:var(--text-dim); font-size:10.5px;}
.sim-syn-pct{color:var(--gold-dim); margin-left:4px;}
.sim-syn-line{color:var(--text-dim); font-size:11.5px;}

@media (max-width:900px){
  .sim-tree-columns{grid-template-columns:1fr;}
  .sim-tree-canvas{height:360px;}
}
@media (max-width:560px){
  .sim-tree-node-ring{width:38px; height:38px;}
  .sim-node-icon{width:17px; height:17px;}
}

@media (max-width:800px){
  .sim-top-grid{grid-template-columns:1fr;}
}
@media (max-width:560px){
  .sim-controls{flex-direction:column; align-items:stretch;}
  .sim-field input{width:100%;}
}
</style>
