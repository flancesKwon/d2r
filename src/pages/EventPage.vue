<script setup>
// 이벤트 안내·내 응모권·당첨 발표 (/event/:id)
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchEvent, fetchEventPosts, computeEntries, phaseOf, fmtCountdown, fmtEventTime, MIN_RUNE_LEVEL } from '../eventStore.js'
import { authState, signIn } from '../profileStore.js'
import { useNow } from '../useNow.js'

const route = useRoute()
const now = useNow(1000)
const ev = ref(null)
const error = ref('')
const loading = ref(true)
const myPosts = ref([])

async function load() {
  loading.value = true
  error.value = ''
  try {
    ev.value = await fetchEvent(route.params.id)
    if (!ev.value) error.value = '없는 이벤트'
  } catch (e) {
    error.value = '이벤트 불러오기 실패'
  } finally {
    loading.value = false
  }
}
watch(() => route.params.id, load, { immediate: true })

const phase = computed(() => phaseOf(ev.value, now.value))
// 내 응모권 (예상) - 진행 중엔 1분마다 다시 셈
async function loadMine() {
  if (!ev.value || !authState.user || phase.value === 'upcoming') { myPosts.value = []; return }
  try { myPosts.value = await fetchEventPosts(ev.value, authState.user.id) } catch { myPosts.value = [] }
}
watch([ev, () => authState.user?.id], loadMine)
let lastMineAt = 0
watch(now, (t) => { if (phase.value === 'live' && t - lastMineAt > 60000) { lastMineAt = t; loadMine() } })

const mine = computed(() => (ev.value ? computeEntries(myPosts.value, ev.value)[0] : null))
const left = computed(() => (ev.value ? new Date(phase.value === 'upcoming' ? ev.value.startsAt : ev.value.endsAt).getTime() - now.value : 0))
const myWin = computed(() => ev.value?.result?.winners?.find((w) => w.user_id === authState.user?.id))
const totalTickets = computed(() => (ev.value?.result?.entries || []).reduce((s, e) => s + (e.tickets || 0), 0))
</script>

<template>
  <div class="items-page event-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">디아허브 이벤트</div>
        <h1>{{ ev?.title || '이벤트' }}</h1>
      </div>
    </div>

    <div class="grid-wrap event-wrap">
      <p v-if="loading" class="ev-dim">불러오는 중…</p>
      <p v-else-if="error" class="ev-dim">{{ error }}</p>
      <template v-else-if="ev">
        <section class="ev-card ev-status" :class="phase">
          <span class="ev-badge">{{ { live: '진행 중', upcoming: '시작 전', ended: '종료 · 추첨 대기', announced: '당첨자 발표' }[phase] }}</span>
          <div class="ev-period">{{ fmtEventTime(ev.startsAt) }} ~ {{ fmtEventTime(ev.endsAt) }}</div>
          <div class="ev-count" v-if="phase === 'live' || phase === 'upcoming'">
            {{ phase === 'live' ? '종료까지' : '시작까지' }} <b>{{ fmtCountdown(left) }}</b>
          </div>
          <router-link v-if="phase === 'live'" to="/trade/new" class="ev-cta">판매글 등록하고 응모하기</router-link>
        </section>

        <section class="ev-card" v-if="ev.result">
          <h2>당첨자</h2>
          <p class="ev-mywin" v-if="myWin">🎉 {{ myWin.label }} 당첨! ({{ myWin.item }}) - 지급 안내는 쪽지로 드려요</p>
          <ol class="ev-winners">
            <li v-for="w in ev.result.winners" :key="w.rank + w.user_id">
              <span class="ev-rank">{{ w.label }}</span>
              <b>{{ w.nickname }}</b>
              <span class="ev-dim">{{ w.item }} · 응모권 {{ w.tickets }}장</span>
            </li>
          </ol>
          <details class="ev-entries">
            <summary>응모자 전체 {{ ev.result.entries.length }}명 · 응모권 {{ totalTickets }}장</summary>
            <ul>
              <li v-for="e in ev.result.entries" :key="e.user_id"><span>{{ e.nickname }}</span><span class="ev-dim">{{ e.tickets }}장</span></li>
            </ul>
          </details>
        </section>

        <section class="ev-card">
          <h2>상품</h2>
          <ul class="ev-prizes">
            <li v-for="p in ev.prizes" :key="p.rank"><span class="ev-rank">{{ p.label }}</span> {{ p.item }}</li>
          </ul>
        </section>

        <section class="ev-card">
          <h2>참여 방법</h2>
          <ul class="ev-rules">
            <li>이벤트 시간 안에 <b>거래게시판에 판매글을 올리면</b> 판매글 1개당 응모권 1장, <b>1인 최대 {{ ev.ticketCap }}장</b></li>
            <li>응모권이 많을수록 당첨 확률이 올라가요 (한 사람은 상품 하나만 당첨)</li>
            <li>응모권이 안 되는 글: 골드, 코 룬(요구 레벨 {{ MIN_RUNE_LEVEL }}) 미만 룬, 최상급이 아닌 보석, 같은 아이템 중복 등록, 추첨 전에 삭제한 글</li>
            <li>거래가 거의 없는 잡템·허위 매물은 운영진 검토 후 제외될 수 있어요</li>
            <li>이벤트가 끝나면 운영진이 추첨하고, 당첨자는 이 페이지와 알림으로 발표해요</li>
          </ul>
          <p class="ev-extra" v-if="ev.rules">{{ ev.rules }}</p>
        </section>

        <section class="ev-card" v-if="phase !== 'upcoming'">
          <h2>내 응모권</h2>
          <p v-if="!authState.user" class="ev-dim">로그인하면 내 응모권을 볼 수 있어요 <button type="button" class="ev-login" @click="signIn()">로그인</button></p>
          <template v-else>
            <p class="ev-mine"><b>{{ mine?.tickets || 0 }}</b> / {{ ev.ticketCap }}장 <span class="ev-dim">(예상 - 추첨 때 운영진 검토로 바뀔 수 있음)</span></p>
            <ul class="ev-myposts" v-if="mine">
              <li v-for="x in mine.posts" :key="x.post.id" :class="{ no: !x.ok }">
                <router-link :to="`/trade/${x.post.id}`">{{ x.post.itemName }}</router-link>
                <span class="ev-dim">{{ x.ok ? '응모권 인정' : x.reason }}</span>
              </li>
            </ul>
            <p v-else class="ev-dim">이벤트 시간에 올린 판매글이 없어요</p>
          </template>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.event-wrap{max-width:820px; display:flex; flex-direction:column; gap:14px;}
.ev-card{border:1px solid var(--border); background:var(--panel); border-radius:14px; padding:18px 20px;}
.ev-card h2{font-size:15px; color:var(--gold); margin:0 0 10px;}
.ev-status{display:flex; align-items:center; gap:10px 18px; flex-wrap:wrap;}
.ev-status.live{border-color:var(--gold-dim); background:linear-gradient(90deg, rgba(199,179,119,.12), rgba(199,179,119,.02));}
.ev-badge{font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; background:var(--gold); color:#1a1408;}
.ev-status:not(.live) .ev-badge{background:var(--panel-2); color:var(--text-muted); border:1px solid var(--border);}
.ev-period{color:var(--text-muted); font-size:13px;}
.ev-count{font-size:13px; color:var(--text-muted); font-variant-numeric:tabular-nums;}
.ev-count b{font-size:20px; color:var(--gold); margin-left:4px;}
.ev-cta{margin-left:auto; font-size:13px; font-weight:700; color:#1a1408; background:var(--gold); padding:9px 16px; border-radius:10px; text-decoration:none;}
.ev-dim{color:var(--text-dim); font-size:12.5px;}
.ev-prizes, .ev-rules, .ev-winners, .ev-myposts{margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:8px; font-size:13.5px;}
.ev-rules li{padding-left:14px; position:relative; color:var(--text-muted); line-height:1.6;}
.ev-rules li::before{content:'·'; position:absolute; left:2px; color:var(--gold);}
.ev-rules b{color:var(--text);}
.ev-rank{display:inline-block; min-width:44px; font-size:12px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; text-align:center; padding:1px 8px; margin-right:6px;}
.ev-winners li{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.ev-mywin{color:var(--gold); font-weight:700; margin:0 0 10px;}
.ev-entries{margin-top:12px; font-size:13px; color:var(--text-muted);}
.ev-entries summary{cursor:pointer;}
.ev-entries ul{list-style:none; padding:8px 0 0; margin:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:4px 16px;}
.ev-entries li{display:flex; justify-content:space-between;}
.ev-extra{margin:10px 0 0; font-size:13px; color:var(--text-muted); white-space:pre-line;}
.ev-mine{font-size:14px; margin:0 0 10px;}
.ev-mine b{font-size:22px; color:var(--gold);}
.ev-myposts li{display:flex; justify-content:space-between; gap:10px;}
.ev-myposts li.no a{color:var(--text-dim); text-decoration:line-through;}
.ev-login{margin-left:8px; font-size:12px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; padding:3px 10px; background:transparent;}
@media (max-width:640px){ .ev-cta{margin-left:0;} }
</style>
