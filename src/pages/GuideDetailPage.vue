<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { guidesState, loadGuides, getGuide, canEditGuides, deleteGuide } from '../guideStore.js'
import { CLASS_ICONS } from '../icons.js'
import itemsData from '../data/items.json'
import { ITEM_ICONS } from '../itemIcons.js'

// 추천 장비 문장 안의 아이템 이름(유니크·세트·룬워드)을 아이템 사전 링크로 - 긴 이름부터 찾아서 겹침 방지
const LINKABLE = itemsData.filter((it) => ['unique', 'set', 'runeword'].includes(it.category) && it.name_ko.length >= 2)
  .sort((a, b) => b.name_ko.length - a.name_ko.length)
function linkSegments(text) {
  const out = []
  let rest = text
  while (rest) {
    let best = null
    for (const it of LINKABLE) {
      const i = rest.indexOf(it.name_ko)
      if (i >= 0 && (best === null || i < best.i)) best = { i, it }
    }
    if (!best) { out.push({ text: rest }); break }
    if (best.i) out.push({ text: rest.slice(0, best.i) })
    out.push({ text: best.it.name_ko, item: best.it })
    rest = rest.slice(best.i + best.it.name_ko.length)
  }
  return out
}
const iconUrl = (it) => (it.icon_key && ITEM_ICONS[it.icon_key] || null)

const route = useRoute()
const router = useRouter()
loadGuides()
const guide = computed(() => getGuide(route.params.id))
async function removeGuide() {
  if (!confirm(`"${guide.value.title}" 가이드를 지울까요? 되돌릴 수 없어요.`)) return
  try {
    await deleteGuide(guide.value)
    router.replace('/guides')
  } catch (e) {
    alert(e.message || '지우지 못했어요')
  }
}
// 목차 - 해시 라우터라 #앵커 링크 대신 버튼으로 스크롤
const SECTIONS = [
  { id: 'sec-stat', label: '스탯 우선순위' },
  { id: 'sec-skill', label: '스킬 트리 순서' },
  { id: 'sec-gear', label: '추천 장비' },
  { id: 'sec-level', label: '레벨링 노트' },
  { id: 'sec-pros', label: '장점·단점' },
]
function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' })
}
const related = computed(() =>
  guide.value ? guidesState.list.filter((g) => g.classKey === guide.value.classKey && g.id !== guide.value.id) : []
)
</script>

<template>
  <div class="items-page guide-detail-page" v-if="guide">

  <div class="grid-wrap guide-detail-wrap">
    <div class="d-eyebrow">
      <span class="guide-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[guide.classKey]"></svg></span>
      {{ guide.className }} · {{ guide.tier }}
    </div>
    <h1 class="d-name guide-detail-title">{{ guide.title }}</h1>
    <div class="guide-detail-date">
      {{ guide.date }}<span class="guide-draft" v-if="guide.published === false">비공개</span>
      <template v-if="canEditGuides">
        <router-link class="guide-edit-link" :to="`/guides/${guide.id}/edit`">수정</router-link>
        <button type="button" class="guide-edit-link danger" @click="removeGuide">삭제</button>
      </template>
    </div>
    <p class="guide-detail-summary">{{ guide.summary }}</p>

    <div class="guide-detail-grid">
      <main class="post-card">
        <div class="d-section-title" id="sec-stat">스탯 우선순위</div>
        <div class="note-box">{{ guide.statPriority }}</div>

        <div class="d-section-title" id="sec-skill">스킬 트리 순서</div>
        <div class="affix-list">
          <div class="affix-line skill-order-line" v-for="(s, i) in guide.skillOrder" :key="i">
            <span class="skill-order-level">Lv {{ s.level }}</span>
            <span class="a-text">{{ s.skill }}</span>
          </div>
        </div>

        <div class="d-section-title" id="sec-gear">추천 장비</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(item, i) in guide.keyItems" :key="i">
            <span class="a-text">
              <template v-for="(seg, k) in linkSegments(item)" :key="k">
                <router-link v-if="seg.item" class="item-link" :class="seg.item.category" :to="{ path: '/items', query: { q: seg.item.name_ko, id: seg.item.id } }">
                  <img v-if="iconUrl(seg.item)" :src="iconUrl(seg.item)" alt="" />{{ seg.text }}
                </router-link>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>
          </div>
        </div>

        <div class="d-section-title" id="sec-level">레벨링 노트</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(n, i) in guide.levelingNotes" :key="i">
            <span class="a-text">{{ n }}</span>
          </div>
        </div>

        <div class="strength-grid" id="sec-pros">
          <div class="strength-box good">
            <h4>장점</h4>
            <ul><li v-for="(s, i) in guide.strengths" :key="i">{{ s }}</li></ul>
          </div>
          <div class="strength-box bad">
            <h4>단점</h4>
            <ul><li v-for="(w, i) in guide.weaknesses" :key="i">{{ w }}</li></ul>
          </div>
        </div>
      </main>

      <aside class="guide-aside">
        <nav class="side-block guide-toc" aria-label="가이드 목차">
          <div class="guide-toc-title">목차</div>
          <button type="button" v-for="s in SECTIONS" :key="s.id" @click="scrollToSection(s.id)">{{ s.label }}</button>
        </nav>
        <div class="side-block guide-tools">
          <div class="guide-toc-title">이 빌드에 쓰는 도구</div>
          <router-link to="/simulator">스킬·스탯 시뮬레이터로 찍어보기</router-link>
          <router-link to="/breakpoints">브레이크포인트 확인하기</router-link>
          <router-link to="/runewords">가진 룬으로 룬워드 찾기</router-link>
        </div>
        <div class="side-block tool-box">
          <h3>이 빌드의 아이템이 궁금하다면</h3>
          <p>가이드에 언급된 아이템 옵션을 아이템 사전에서 찾아보세요</p>
          <router-link to="/items">아이템 검색하기</router-link>
        </div>
        <div class="side-block board-box" v-if="related.length">
          <h3>{{ guide.className }} 다른 가이드</h3>
          <ul>
            <li v-for="r in related" :key="r.id">
              <router-link :to="`/guides/${r.id}`">{{ r.title }}</router-link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state">가이드를 찾을 수 없어요. <router-link to="/guides">가이드 목록으로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤은 그대로 두고 본문을 하나의 둥근 카드로,
   사이드바 박스·소목록도 각지지 않게 다듬음 */
.guide-detail-wrap{max-width:1180px;}
.guide-class-icon{
  display:inline-flex; width:20px; height:20px; border:1px solid var(--border); background:var(--panel-2);
  align-items:center; justify-content:center; vertical-align:-5px; margin-right:6px; border-radius:6px;
}
.guide-class-icon svg{width:11px; height:11px; stroke:var(--gold-dim); fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}
.guide-detail-title{font-size:28px; margin:10px 0 8px;}
.guide-detail-date{font-size:11.5px; color:var(--text-dim); margin-bottom:16px; display:flex; align-items:center; gap:8px;}
.guide-draft{font-size:10.5px; color:var(--text-dim); border:1px dashed var(--border); padding:1px 7px; border-radius:999px;}
.guide-edit-link{font-size:12px; color:var(--text-muted); border:1px solid var(--border-soft); padding:3px 10px; border-radius:999px;}
.guide-edit-link:hover{color:var(--gold); border-color:var(--gold-dim);}
.guide-edit-link.danger:hover{color:#e0775f; border-color:#e0775f;}
.guide-detail-summary{font-size:14px; color:var(--text-muted); margin-bottom:26px; line-height:1.65; max-width:640px;}

.guide-detail-grid{display:grid; grid-template-columns:1fr 300px; gap:28px; align-items:start;}
.post-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:18px; padding:32px 36px;}
.note-box{border-radius:12px;}
.affix-list{border-radius:14px; overflow:hidden;}
.skill-order-line{display:flex; gap:12px;}
.item-link{display:inline-flex; align-items:center; gap:4px; color:var(--gold); border-bottom:1px dashed var(--gold-dim);}
.item-link.set{color:var(--green); border-bottom-color:var(--green);}
.item-link img{width:18px; height:18px; object-fit:contain; image-rendering:pixelated;}
.item-link:hover{color:var(--focus);}
.skill-order-level{color:var(--gold-dim); font-weight:700; font-size:12px; flex:none; width:70px;}

.strength-grid{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:8px;}
.strength-box{border:1px solid var(--border-soft); background:var(--panel-2); padding:16px 18px; border-radius:14px;}
.strength-box h4{font-size:12.5px; margin-bottom:8px; font-family:'Noto Serif KR', serif;}
.strength-box.good h4{color:var(--green);}
.strength-box.bad h4{color:var(--blood);}
.strength-box li{font-size:12.5px; color:var(--text-muted); padding:3px 0; line-height:1.5;}

.side-block{border-radius:14px; background:var(--panel); overflow:hidden;}
.guide-aside{position:sticky; top:76px; display:flex; flex-direction:column;}
.guide-toc, .guide-tools{border:1px solid var(--border-soft); padding:14px 16px; display:flex; flex-direction:column; gap:2px; margin-bottom:14px;}
.guide-toc-title{font-size:12px; color:var(--gold-dim); font-weight:600; margin-bottom:6px;}
.guide-toc button{text-align:left; font-size:13px; color:var(--text-muted); padding:6px 10px; border-radius:8px; border-left:2px solid var(--border-soft);}
.guide-toc button:hover{color:var(--gold); background:var(--panel-2); border-left-color:var(--gold-dim);}
.guide-tools a{font-size:12.5px; color:var(--text-muted); padding:5px 0;}
.guide-tools a:hover{color:var(--gold);}
.tool-box a{border-radius:8px;}

@media (max-width:800px){
  .guide-detail-grid{grid-template-columns:1fr;}
  .guide-aside{position:static;}
  .strength-grid{grid-template-columns:1fr;}
}
</style>
