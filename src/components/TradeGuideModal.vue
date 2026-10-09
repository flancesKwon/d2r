<script setup>
// 거래 이용 안내 - 장점 / 판매하기 / 구매하기 / 거래 진행·상태 / 자동 정리·규칙
// 실제 규칙은 DB(016~023 SQL)가 지킴 - 여기 문구는 그 규칙을 그대로 풀어 쓴 것 (규칙이 바뀌면 같이 고칠 것)
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { tradeGuideState, closeTradeGuide } from '../tradeGuide.js'

// 실제 화면 캡처 (예시 데이터로 찍음 - 실제 회원·매물 아님). 화면이 크게 바뀌면 다시 찍을 것
import imgBoard from '../assets/guide/board.jpg'
import imgSellSearch from '../assets/guide/sell-search.jpg'
import imgSellPreview from '../assets/guide/sell-preview.jpg'
import imgPriceCard from '../assets/guide/price-card.jpg'
import imgOffer from '../assets/guide/offer.jpg'
import imgRequests from '../assets/guide/requests.jpg'
import imgDeal from '../assets/guide/deal.jpg'

// 이미지를 누르면 크게
const zoom = ref(null)

const TABS = [
  { key: 'why', label: '장점' },
  { key: 'sell', label: '판매하기' },
  { key: 'buy', label: '구매하기' },
  { key: 'flow', label: '거래 진행·상태' },
  { key: 'rules', label: '자동 정리·규칙' },
]
const route = useRoute()
watch(() => route.fullPath, closeTradeGuide)
const onKey = (e) => { if (e.key !== 'Escape') return; if (zoom.value) zoom.value = null; else closeTradeGuide() }
watch(() => tradeGuideState.tab, () => (zoom.value = null))
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
const tabIndex = () => TABS.findIndex((t) => t.key === tradeGuideState.tab)
const go = (d) => { const i = tabIndex() + d; if (TABS[i]) tradeGuideState.tab = TABS[i].key }
</script>

<template>
  <div class="modal-overlay tg-overlay" v-if="tradeGuideState.open" @click.self="closeTradeGuide">
    <div class="tg" role="dialog" :aria-label="$t('거래 이용 안내')">
      <div class="tg-head">
        <div>
          <div class="tg-eyebrow">{{ $t('디아허브 거래게시판') }}</div>
          <div class="tg-title">{{ $t('거래 이용 안내') }}</div>
        </div>
        <button type="button" class="tg-close" :aria-label="$t('닫기')" @click="closeTradeGuide">✕</button>
      </div>
      <div class="tg-tabs" role="tablist">
        <button
          v-for="(t, i) in TABS" :key="t.key" type="button" role="tab" :aria-selected="tradeGuideState.tab === t.key"
          :class="{ on: tradeGuideState.tab === t.key }" @click="tradeGuideState.tab = t.key"
        ><span class="tg-num">{{ i + 1 }}</span>{{ $t(t.label) }}</button>
      </div>

      <div class="tg-body">
        <!-- 1. 장점 -->
        <template v-if="tradeGuideState.tab === 'why'">
          <p class="tg-lead">{{ $t('디아블로 2 레저렉션 유저끼리 아이템을 사고파는 곳 (아시아·미주·유럽 서버). 등록부터 거래완료·리뷰까지 사이트 안에서 이어집니다.') }}</p>
          <div class="tg-grid">
            <div class="tg-card"><b>{{ $t('게임 그대로의 아이템 카드') }}</b><span>{{ $t('옵션을 고르면 게임 툴팁 모양으로 바로 보이고 이미지로 저장도 가능') }}</span></div>
            <div class="tg-card"><b>{{ $t('나올 수 없는 수치는 등록 불가') }}</b><span>{{ $t('옵션 수치를 게임 범위로 검사 - 잘못 적힌 매물이 없음') }}</span></div>
            <div class="tg-card"><b>{{ $t('옵션으로 찾기') }}</b><span>{{ $t('"블리자드 3", "저항 20~40" 처럼 키워드·수치 범위로 매물 검색') }}</span></div>
            <div class="tg-card"><b>{{ $t('가격 제안이 공개') }}</b><span>{{ $t('다른 사람의 구매·제안 내역이 보여서 대략적인 시세를 바로 파악 (연락처는 비공개)') }}</span></div>
            <div class="tg-card"><b>{{ $t('거래방 + 양쪽 확인') }}</b><span>{{ $t('수락하면 1:1 거래방, 판매자·구매자 둘 다 확인해야 거래완료') }}</span></div>
            <div class="tg-card"><b>{{ $t('리뷰·평점과 실제 거래가') }}</b><span>{{ $t('거래가 끝나면 서로 리뷰, 실제로 거래된 가격이 거래내역에 남음') }}</span></div>
            <div class="tg-card"><b>{{ $t('실시간 알림·접속 표시') }}</b><span>{{ $t('신청·수락·메시지가 바로 알림으로, 접속 중인 회원은 초록 점') }}</span></div>
            <div class="tg-card"><b>{{ $t('멈춘 거래 자동 정리') }}</b><span>{{ $t('연락이 끊긴 거래는 자동으로 정리돼 매물이 묶이지 않음') }}</span></div>
          </div>
          <figure class="tg-shot">
            <img :src="imgBoard" :alt="$t('거래게시판 - 옵션 키워드로 매물 검색')" loading="lazy" @click="zoom = imgBoard" />
            <figcaption>{{ $t('거래게시판 - "저항 15 이상"처럼 옵션 조건으로 찾기') }}</figcaption>
          </figure>
        </template>

        <!-- 2. 판매하기 -->
        <template v-else-if="tradeGuideState.tab === 'sell'">
          <ol class="tg-steps">
            <li><b>{{ $t('판매글 등록') }}</b> {{ $t('누르기') }} <span>{{ $t('로그인 필요 (구글·디스코드)') }}</span></li>
            <li><b>{{ $t('아이템 검색') }}</b> <span>{{ $t('이름·별칭으로 (예: 샤코, 이스트 룬, 무한, 골드). 사전에 없는 매직·레어는 베이스를 골라 등록') }}</span></li>
            <li><b>{{ $t('옵션 수치 입력') }}</b> <span>{{ $t('실제 아이템에 뜬 값 그대로. 유니크·세트는 방어력·데미지도 입력 가능, 미확인 아이템은 수치 없이') }}</span></li>
            <li><b>{{ $t('가격 정하기') }}</b> <span>{{ $t('받을 룬·보석·재료 선택. 또는') }} <em>{{ $t('흥정 가능') }}</em>{{ $t('(가격 제안도 받음) /') }} <em>{{ $t('제안만 받기') }}</em>{{ $t('(판매가 없이 제안만)') }}</span></li>
            <li><b>{{ $t('등록') }}</b> <span>{{ $t('판매 기간 7일 동안 거래게시판에 노출') }}</span></li>
          </ol>
          <div class="tg-shots">
            <figure class="tg-shot">
              <img :src="imgSellSearch" :alt="$t('아이템 검색')" loading="lazy" @click="zoom = imgSellSearch" />
              <figcaption>{{ $t('② 별칭으로 검색 - "샤코"') }}</figcaption>
            </figure>
            <figure class="tg-shot">
              <img :src="imgSellPreview" :alt="$t('아이템 미리보기')" loading="lazy" @click="zoom = imgSellPreview" />
              <figcaption>{{ $t('③ 수치를 넣으면 게임 툴팁 모양 미리보기') }}</figcaption>
            </figure>
          </div>
          <div class="tg-note">
            <b>{{ $t('알아두기') }}</b>
            <ul>
              <li>{{ $t('여러 개(룬 5개 등)·골드·묶음은') }} <b>{{ $t('한 번에 통째로') }}</b> {{ $t('판매 - 나눠 팔려면 글을 따로') }}</li>
              <li>{{ $t('골드는 한 글에 최대 1,500만') }}</li>
              <li>{{ $t('구매신청이 들어오기 전까지') }} <b>{{ $t('수정') }}</b> {{ $t('가능 (옵션 수치·판매가·수량·설명, 아이템 자체는 변경 불가)') }}</li>
              <li>{{ $t('7일이 지나면 목록에서 내려감 -') }} <b>{{ $t('재등록') }}</b>{{ $t('(판매가만 고쳐서 다시 7일)') }}</li>
            </ul>
          </div>
        </template>

        <!-- 3. 구매하기 -->
        <template v-else-if="tradeGuideState.tab === 'buy'">
          <div class="tg-grid three">
            <div class="tg-card"><b>{{ $t('구매하기') }}</b><span>{{ $t('판매가 그대로 구매 신청') }}</span></div>
            <div class="tg-card"><b>{{ $t('가격 제안') }}</b><span>{{ $t('흥정 가능·제안만 받기 글에 룬·보석·재료로 가격 제안') }}</span></div>
            <div class="tg-card"><b>{{ $t('문의하기 (쪽지)') }}</b><span>{{ $t('거래 시간·옵션 확인 같은 질문은 쪽지로 - 판매글이 링크로 함께 붙음') }}</span></div>
          </div>
          <div class="tg-shots">
            <figure class="tg-shot">
              <img :src="imgPriceCard" :alt="$t('판매글 가격 카드')" loading="lazy" @click="zoom = imgPriceCard" />
              <figcaption>{{ $t('판매글의 가격 카드 - 제안만 받기 글은 "가격 제안하기"') }}</figcaption>
            </figure>
            <figure class="tg-shot">
              <img :src="imgOffer" :alt="$t('가격 제안')" loading="lazy" @click="zoom = imgOffer" />
              <figcaption>{{ $t('제안할 룬·보석·재료와 개수 고르기') }}</figcaption>
            </figure>
          </div>
          <div class="tg-note">
            <b>{{ $t('알아두기') }}</b>
            <ul>
              <li>{{ $t('한 글에 대기 중인 신청은 한 사람당 하나 - 바꾸려면 취소 후 다시') }}</li>
              <li>{{ $t('신청·제안 내역은 누구나 볼 수 있음 (연락처는 판매자·본인만)') }}</li>
              <li>{{ $t('이미 다른 사람과 거래중인 글에 신청하면') }} <b>{{ $t('보류') }}</b> {{ $t('→ 그 거래가 불발되면 대기로 돌아옴') }}</li>
            </ul>
          </div>
        </template>

        <!-- 4. 거래 진행·상태 -->
        <template v-else-if="tradeGuideState.tab === 'flow'">
          <div class="tg-flow">
            <div class="tg-node sell">{{ $t('판매중') }}</div>
            <div class="tg-arrow">{{ $t('판매자가 신청 하나 수락 →') }}</div>
            <div class="tg-node deal">{{ $t('거래중') }}</div>
            <div class="tg-branch">
              <div><span class="tg-arrow">{{ $t('둘 다 거래완료 →') }}</span> <span class="tg-node done">{{ $t('거래완료') }}</span> <small>{{ $t('리뷰 작성') }}</small></div>
              <div><span class="tg-arrow">{{ $t('거래불발 →') }}</span> <span class="tg-node sell">{{ $t('판매중') }}</span> <small>{{ $t('다시 판매 (7일 새로)') }}</small></div>
            </div>
          </div>
          <div class="tg-cols">
            <div>
              <div class="tg-sub">{{ $t('판매글 상태') }}</div>
              <dl class="tg-dl">
                <dt><span class="tg-chip sell">{{ $t('판매중') }}</span></dt><dd>{{ $t('신청을 받는 중') }}</dd>
                <dt><span class="tg-chip deal">{{ $t('거래중') }}</span></dt><dd>{{ $t('신청 하나를 수락해 거래방에서 진행 중') }}</dd>
                <dt><span class="tg-chip done">{{ $t('거래완료') }}</span></dt><dd>{{ $t('거래 끝 - 거래내역에 남고 삭제 불가') }}</dd>
              </dl>
            </div>
            <div>
              <div class="tg-sub">{{ $t('구매신청 상태') }}</div>
              <dl class="tg-dl">
                <dt><span class="tg-chip">{{ $t('대기중') }}</span></dt><dd>{{ $t('판매자의 수락·거절을 기다림') }}</dd>
                <dt><span class="tg-chip held">{{ $t('보류') }}</span></dt><dd>{{ $t('다른 사람과 거래중 - 불발되면 대기로') }}</dd>
                <dt><span class="tg-chip deal">{{ $t('수락됨') }}</span></dt><dd>{{ $t('거래방이 열림') }}</dd>
                <dt><span class="tg-chip bad">{{ $t('거절·취소') }}</span></dt><dd>{{ $t('판매자 거절 / 내가 취소 (다시 신청 가능)') }}</dd>
              </dl>
            </div>
          </div>
          <figure class="tg-shot">
            <img :src="imgRequests" :alt="$t('구매신청 내역')" loading="lazy" @click="zoom = imgRequests" />
            <figcaption>{{ $t('신청 내역 - 한 명 수락되면 나머지는 "보류", 거절·취소도 그대로 보임') }}</figcaption>
          </figure>
          <figure class="tg-shot">
            <img :src="imgDeal" :alt="$t('거래방')" loading="lazy" @click="zoom = imgDeal" />
            <figcaption>{{ $t('거래방 - 거래가·진행 단계, 대화로 조율하고 둘 다 거래완료') }}</figcaption>
          </figure>
          <div class="tg-note">
            <b>{{ $t('거래방에서') }}</b>
            <ul>
              <li>{{ $t('접속 시간·배틀태그 등을 맞추고 게임에서 거래') }}</li>
              <li><b>{{ $t('거래완료') }}</b>{{ $t('는 판매자·구매자') }} <b>{{ $t('둘 다') }}</b> {{ $t('눌러야 처리 (판매자가 혼자 상태를 바꿀 수 없음)') }}</li>
              <li><b>{{ $t('거래불발') }}</b>{{ $t('은 한 사람만 눌러도 바로 처리') }}</li>
              <li>{{ $t('거래완료 후 서로 리뷰(★1~5) - 프로필에 평점으로 표시') }}</li>
            </ul>
          </div>
        </template>

        <!-- 5. 자동 정리·규칙 -->
        <template v-else>
          <div class="tg-grid">
            <div class="tg-card"><b>{{ $t('판매 기간 7일') }}</b><span>{{ $t('지나면 목록에서 내려감 - 재등록하면 다시 7일') }}</span></div>
            <div class="tg-card"><b>{{ $t('대화 없는 거래방') }}</b><span>{{ $t('5일째 알림, 7일 동안 대화가 없으면 자동 거래불발') }}</span></div>
            <div class="tg-card"><b>{{ $t('한쪽만 거래완료') }}</b><span>{{ $t('3일 뒤 자동 거래완료 (하루 전 상대에게 알림) - 못 받았으면 그 전에 거래불발·신고') }}</span></div>
            <div class="tg-card"><b>{{ $t('오래된 신청') }}</b><span>{{ $t('판매 기간이 끝나고 3일이 지나도 재등록이 없으면 남은 신청은 정리') }}</span></div>
          </div>
          <div class="tg-note warn">
            <b>{{ $t('꼭 지켜주세요') }}</b>
            <ul>
              <li>{{ $t('현금 거래·사기·도배 금지 - 신고가 쌓인 글은 자동으로 가려지고, 확인 후 이용 정지') }}</li>
              <li>{{ $t('거래는 회원끼리 직접 진행하며, 사이트는 중개·보증하지 않음') }}</li>
              <li>{{ $t('문제가 생기면 판매글·회원 신고 또는 건의 게시판으로') }}</li>
            </ul>
          </div>
        </template>
      </div>

      <div class="tg-zoom" v-if="zoom" @click="zoom = null"><img :src="zoom" alt="" /><span>{{ $t('눌러서 닫기') }}</span></div>

      <div class="tg-foot">
        <button type="button" class="tg-btn" :disabled="tabIndex() === 0" @click="go(-1)">{{ $t('← 이전') }}</button>
        <span class="tg-dots"><i v-for="(t, i) in TABS" :key="t.key" :class="{ on: i === tabIndex() }"></i></span>
        <button v-if="tabIndex() < TABS.length - 1" type="button" class="tg-btn primary" @click="go(1)">{{ $t('다음 →') }}</button>
        <button v-else type="button" class="tg-btn primary" @click="closeTradeGuide">{{ $t('시작하기') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg-overlay{align-items:center;}
.tg{position:relative; width:100%; max-width:760px; max-height:calc(100vh - 40px); display:flex; flex-direction:column; background:var(--bg-raise); border:1px solid var(--border); border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); overflow:hidden;}
.tg-head{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px 22px 12px;}
.tg-eyebrow{font-size:11.5px; color:var(--gold-dim);}
.tg-title{font-family:'Noto Serif KR', serif; font-size:20px; font-weight:700; color:var(--text);}
.tg-close{width:32px; height:32px; border-radius:8px; color:var(--text-dim); font-size:15px; flex:none;}
.tg-close:hover{background:var(--panel-2); color:var(--text);}
.tg-tabs{display:flex; gap:6px; padding:0 22px 12px; overflow-x:auto; border-bottom:1px solid var(--border-soft); scrollbar-width:none;}
.tg-tabs button{display:inline-flex; align-items:center; gap:6px; flex:none; padding:7px 12px; border:1px solid var(--border); border-radius:999px; font-size:12.5px; color:var(--text-muted);}
.tg-tabs button.on{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:700;}
.tg-num{font-size:10.5px; opacity:.7;}
.tg-body{padding:18px 22px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; font-size:13px; color:var(--text-muted); line-height:1.6;}
.tg-lead{color:var(--text); font-size:13.5px;}
.tg-grid{display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;}
.tg-grid.three{grid-template-columns:repeat(3, 1fr);}
.tg-card{display:flex; flex-direction:column; gap:3px; padding:11px 13px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px;}
.tg-card b{color:var(--gold); font-size:13px;}
.tg-card span{font-size:12px; color:var(--text-muted);}
.tg-steps{list-style:none; counter-reset:s; display:flex; flex-direction:column; gap:8px;}
.tg-steps li{counter-increment:s; position:relative; padding:10px 12px 10px 44px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; color:var(--text);}
.tg-steps li::before{content:counter(s); position:absolute; left:12px; top:10px; width:22px; height:22px; border-radius:999px; background:var(--gold); color:#1a1408; font-weight:700; font-size:12px; display:flex; align-items:center; justify-content:center;}
.tg-steps li span{display:block; font-size:12px; color:var(--text-muted);}
.tg-steps em{font-style:normal; color:var(--gold);}
.tg-note{padding:12px 14px; border-radius:12px; background:rgba(200,163,77,0.07); border:1px solid var(--border-soft);}
.tg-note.warn{background:rgba(162,81,63,0.1); border-color:rgba(162,81,63,0.4);}
.tg-note > b{display:block; color:var(--text); margin-bottom:4px; font-size:12.5px;}
.tg-note ul{padding-left:18px; display:flex; flex-direction:column; gap:3px; font-size:12.5px;}
.tg-note ul b{color:var(--text);}
.tg-flow{display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:14px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px;}
.tg-branch{display:flex; flex-direction:column; gap:6px; margin-left:4px;}
.tg-branch small{color:var(--text-dim); font-size:11px;}
.tg-arrow{font-size:11.5px; color:var(--text-dim);}
.tg-node, .tg-chip{display:inline-block; padding:3px 11px; border-radius:999px; border:1px solid var(--border); font-size:12px; color:var(--text-muted); white-space:nowrap;}
.tg-node{font-weight:700; padding:5px 13px;}
.sell{color:#1f1a10; background:var(--gold); border-color:var(--gold);}
.deal{color:var(--teal); border-color:var(--teal);}
.done{color:var(--text); border-color:var(--green); background:rgba(92,138,91,.2);}
.held{color:var(--teal); border-color:var(--teal); border-style:dashed;}
.bad{color:#e0775f; border-color:var(--blood);}
.tg-cols{display:grid; grid-template-columns:1fr 1fr; gap:14px;}
.tg-sub{font-size:12px; color:var(--gold-dim); font-weight:600; margin-bottom:6px;}
.tg-dl{display:grid; grid-template-columns:auto 1fr; gap:6px 10px; align-items:center; font-size:12.5px;}
.tg-foot{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 22px; border-top:1px solid var(--border-soft);}
.tg-btn{padding:9px 16px; border-radius:10px; border:1px solid var(--border); font-size:13px; color:var(--text-muted);}
.tg-btn:disabled{opacity:.35;}
.tg-btn.primary{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:700;}
.tg-dots{display:flex; gap:5px;}
.tg-dots i{width:6px; height:6px; border-radius:999px; background:var(--border);}
.tg-dots i.on{background:var(--gold);}
.tg-shots{display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;}
.tg-shot{display:flex; flex-direction:column; gap:5px; margin:0;}
.tg-shot img{width:100%; height:auto; display:block; border-radius:10px; border:1px solid var(--border); cursor:zoom-in; background:var(--panel);}
.tg-shot figcaption{font-size:11.5px; color:var(--text-dim);}
.tg-zoom{position:absolute; inset:0; z-index:5; background:rgba(10,8,6,.92); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:16px; cursor:zoom-out;}
.tg-zoom img{max-width:100%; max-height:calc(100% - 30px); object-fit:contain; border-radius:10px; border:1px solid var(--border);}
.tg-zoom span{font-size:11.5px; color:var(--text-dim);}
@media (max-width:640px){
  .tg-shots{grid-template-columns:1fr;}
  .tg-overlay{padding:10px;}
  .tg-grid, .tg-grid.three, .tg-cols{grid-template-columns:1fr;}
  .tg-head, .tg-tabs, .tg-body, .tg-foot{padding-left:16px; padding-right:16px;}
}
</style>
