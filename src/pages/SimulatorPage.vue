<script setup>
import { ref, reactive, computed, watch } from 'vue'
import classStats from '../data/classStats.json'
import skillData from '../data/skills.json'
import { CLASS_ICONS } from '../icons.js'

const TIER_LEVEL_REQ = [1, 6, 12, 18, 24, 30]
const classKeys = Object.keys(classStats)
const STAT_KEYS = ['str', 'dex', 'vit', 'nrg']
const STAT_LABELS = { str: '힘', dex: '민첩', vit: '활력', nrg: '에너지' }

const selectedClass = ref('amazon')
const level = ref(1)
const bonusSkillPoints = ref(0)
const bonusStatPoints = ref(0)
const activeTab = ref(0)

const allocatedStats = reactive({ str: 0, dex: 0, vit: 0, nrg: 0 })
const allocatedSkills = reactive({})

function resetAll() {
  STAT_KEYS.forEach((k) => (allocatedStats[k] = 0))
  Object.keys(allocatedSkills).forEach((k) => delete allocatedSkills[k])
}

watch(selectedClass, () => {
  resetAll()
  activeTab.value = 0
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

const totalStatPoints = computed(() => Math.max(0, Number(bonusStatPoints.value) || 0) + 5 * (level.value - 1))
const spentStatPoints = computed(() => STAT_KEYS.reduce((sum, k) => sum + allocatedStats[k], 0))
const remainingStatPoints = computed(() => totalStatPoints.value - spentStatPoints.value)

const totalSkillPoints = computed(() => Math.max(0, Number(bonusSkillPoints.value) || 0) + (level.value - 1))
const spentSkillPoints = computed(() => Object.values(allocatedSkills).reduce((sum, v) => sum + v, 0))
const remainingSkillPoints = computed(() => totalSkillPoints.value - spentSkillPoints.value)

function skillKey(tabIdx, skillIdx) {
  return `${selectedClass.value}-${tabIdx}-${skillIdx}`
}

function skillPoint(tabIdx, skillIdx) {
  return allocatedSkills[skillKey(tabIdx, skillIdx)] || 0
}

function tierPointSum(tabIdx, tier) {
  const tab = classTabs.value[tabIdx]
  return tab.skills.reduce((sum, s, i) => (s.tier === tier ? sum + skillPoint(tabIdx, i) : sum), 0)
}

function canIncreaseSkill(tabIdx, skillIdx) {
  const skill = classTabs.value[tabIdx].skills[skillIdx]
  const current = skillPoint(tabIdx, skillIdx)
  if (remainingSkillPoints.value <= 0) return false
  if (current >= 20) return false
  if (level.value < TIER_LEVEL_REQ[skill.tier - 1]) return false
  if (skill.tier > 1 && tierPointSum(tabIdx, skill.tier - 1) < 1) return false
  return true
}

function canDecreaseSkill(tabIdx, skillIdx) {
  const skill = classTabs.value[tabIdx].skills[skillIdx]
  const current = skillPoint(tabIdx, skillIdx)
  if (current <= 0) return false
  if (current === 1) {
    const tierTotalAfter = tierPointSum(tabIdx, skill.tier) - 1
    if (tierTotalAfter === 0) {
      for (let t = skill.tier + 1; t <= 6; t++) {
        if (tierPointSum(tabIdx, t) > 0) return false
      }
    }
  }
  return true
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
  return STAT_KEYS.map((k) => ({ key: k, label: STAT_LABELS[k], base: b[k], added: allocatedStats[k], total: b[k] + allocatedStats[k] }))
})

const derivedStats = computed(() => {
  const c = classInfo.value
  const lvl = level.value
  return {
    life: Math.round(c.life + c.lifePerLevel * (lvl - 1) + c.lifePerVit * allocatedStats.vit),
    mana: Math.round(c.mana + c.manaPerLevel * (lvl - 1) + c.manaPerNrg * allocatedStats.nrg),
    stamina: Math.round(c.stamina + c.staminaPerLevel * (lvl - 1) + c.staminaPerVit * allocatedStats.vit),
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
      <p>레벨에 맞춰 스탯과 스킬 포인트를 미리 찍어보고 빌드를 계획해보세요. (팬 제작 참고용 수치, 실제 게임과 약간 다를 수 있어요)</p>
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
      <label class="sim-field">
        <span>추가 스탯 포인트 (퀘스트 보너스 등)</span>
        <input type="number" min="0" v-model.number="bonusStatPoints" />
      </label>
      <label class="sim-field">
        <span>추가 스킬 포인트 (퀘스트 보너스 등)</span>
        <input type="number" min="0" v-model.number="bonusSkillPoints" />
      </label>
      <button class="sim-reset-btn" @click="resetAll">초기화</button>
    </div>

    <div class="sim-top-grid">
      <div class="side-block sim-panel">
        <h3>스탯 포인트 <span class="sim-remaining" :class="{ warn: remainingStatPoints < 0 }">남은 포인트 {{ remainingStatPoints }} / {{ totalStatPoints }}</span></h3>
        <div class="sim-stat-row" v-for="s in displayStats" :key="s.key">
          <span class="sim-stat-label">{{ s.label }}</span>
          <button class="sim-pm" @click="decreaseStat(s.key)" :disabled="allocatedStats[s.key] <= 0">−</button>
          <span class="sim-stat-value">{{ s.total }}<small>(기본 {{ s.base }} + {{ s.added }})</small></span>
          <button class="sim-pm" @click="increaseStat(s.key)" :disabled="remainingStatPoints <= 0">+</button>
        </div>
      </div>

      <div class="side-block sim-panel">
        <h3>예상 능력치</h3>
        <div class="sim-derived-row"><span>생명력</span><b>{{ derivedStats.life }}</b></div>
        <div class="sim-derived-row"><span>마나</span><b>{{ derivedStats.mana }}</b></div>
        <div class="sim-derived-row"><span>스태미나</span><b>{{ derivedStats.stamina }}</b></div>
        <div class="note-box sim-note">기본 스탯 · 활력/에너지 투자분 기준 근사치예요. 장비 옵션은 반영되지 않아요.</div>
      </div>
    </div>

    <div class="sim-skill-section">
      <div class="sim-skill-head">
        <h3>스킬 포인트 <span class="sim-remaining" :class="{ warn: remainingSkillPoints < 0 }">남은 포인트 {{ remainingSkillPoints }} / {{ totalSkillPoints }}</span></h3>
      </div>
      <div class="cat-tabs sub-tabs sim-tree-tabs">
        <button v-for="(tab, i) in classTabs" :key="tab.name" :class="{ active: activeTab === i }" @click="activeTab = i">
          {{ tab.name }} <small>({{ tabSpent[i] }})</small>
        </button>
      </div>
      <div class="sim-tree-grid">
        <div v-for="(tab, tabIdx) in classTabs" :key="tab.name" class="sim-tree-col" v-show="activeTab === tabIdx">
          <div class="sim-skill-line" v-for="(skill, skillIdx) in tab.skills" :key="skill.name">
            <div class="sim-skill-info">
              <span class="sim-skill-name">{{ skill.name }}</span>
              <span class="sim-skill-tier">요구 레벨 {{ TIER_LEVEL_REQ[skill.tier - 1] }}</span>
            </div>
            <button class="sim-pm" @click="decreaseSkill(tabIdx, skillIdx)" :disabled="!canDecreaseSkill(tabIdx, skillIdx)">−</button>
            <span class="sim-skill-value">{{ skillPoint(tabIdx, skillIdx) }}</span>
            <button class="sim-pm" @click="increaseSkill(tabIdx, skillIdx)" :disabled="!canIncreaseSkill(tabIdx, skillIdx)">+</button>
          </div>
        </div>
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

.sim-derived-row{display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid var(--border-soft); font-size:13.5px; color:var(--text-muted);}
.sim-derived-row:first-of-type{border-top:none;}
.sim-derived-row b{color:var(--gold); font-size:15px;}
.sim-note{margin-top:12px; margin-bottom:0;}

.sim-skill-head h3{font-size:15px; display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px; margin-bottom:14px;}
.sim-tree-tabs{margin-bottom:16px;}
.sim-tree-tabs small{color:var(--text-dim);}
.sim-tree-col{display:flex; flex-direction:column; gap:1px;}
.sim-skill-line{display:flex; align-items:center; gap:10px; padding:10px 14px; border:1px solid var(--border-soft); border-top:none;}
.sim-skill-line:first-child{border-top:1px solid var(--border-soft);}
.sim-skill-info{flex:1; display:flex; flex-direction:column; gap:2px; min-width:0;}
.sim-skill-name{font-size:13.5px; color:var(--text);}
.sim-skill-tier{font-size:10.5px; color:var(--text-dim);}
.sim-skill-value{width:22px; text-align:center; font-size:14px; color:var(--gold); font-weight:700; flex:none;}

@media (max-width:800px){
  .sim-top-grid{grid-template-columns:1fr;}
}
@media (max-width:560px){
  .sim-controls{flex-direction:column; align-items:stretch;}
  .sim-field input{width:100%;}
}
</style>
