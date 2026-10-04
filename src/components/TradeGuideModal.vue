<script setup>
// 거래 이용 안내 - 장점 / 판매하기 / 구매하기 / 거래 진행·상태 / 자동 정리·규칙
// 실제 규칙은 DB(016~023 SQL)가 지킴 - 여기 문구는 그 규칙을 그대로 풀어 쓴 것 (규칙이 바뀌면 같이 고칠 것)
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { tradeGuideState, closeTradeGuide } from '../tradeGuide.js'

const TABS = [
  { key: 'why', label: '장점' },
  { key: 'sell', label: '판매하기' },
  { key: 'buy', label: '구매하기' },
  { key: 'flow', label: '거래 진행·상태' },
  { key: 'rules', label: '자동 정리·규칙' },
]
const route = useRoute()
watch(() => route.fullPath, closeTradeGuide)
const onKey = (e) => { if (e.key === 'Escape') closeTradeGuide() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
const tabIndex = () => TABS.findIndex((t) => t.key === tradeGuideState.tab)
const go = (d) => { const i = tabIndex() + d; if (TABS[i]) tradeGuideState.tab = TABS[i].key }
</script>

<template>
  <div class="modal-overlay tg-overlay" v-if="tradeGuideState.open" @click.self="closeTradeGuide">
    <div class="tg" role="dialog" aria-label="거래 이용 안내">
      <div class="tg-head">
        <div>
          <div class="tg-eyebrow">디아허브 거래게시판</div>
          <div class="tg-title">거래 이용 안내</div>
        </div>
        <button type="button" class="tg-close" aria-label="닫기" @click="closeTradeGuide">✕</button>
      </div>
      <div class="tg-tabs" role="tablist">
        <button
          v-for="(t, i) in TABS" :key="t.key" type="button" role="tab" :aria-selected="tradeGuideState.tab === t.key"
          :class="{ on: tradeGuideState.tab === t.key }" @click="tradeGuideState.tab = t.key"
        ><span class="tg-num">{{ i + 1 }}</span>{{ t.label }}</button>
      </div>

      <div class="tg-body">
        <!-- 1. 장점 -->
        <template v-if="tradeGuideState.tab === 'why'">
          <p class="tg-lead">아시아 서버 디아블로 2 레저렉션 유저끼리 아이템을 사고파는 곳. 등록부터 거래완료·리뷰까지 사이트 안에서 이어집니다.</p>
          <div class="tg-grid">
            <div class="tg-card"><b>게임 그대로의 아이템 카드</b><span>옵션을 고르면 게임 툴팁 모양으로 바로 보이고 이미지로 저장도 가능</span></div>
            <div class="tg-card"><b>나올 수 없는 수치는 등록 불가</b><span>옵션 수치를 게임 범위로 검사 - 잘못 적힌 매물이 없음</span></div>
            <div class="tg-card"><b>옵션으로 찾기</b><span>"블리자드 3", "저항 20~40" 처럼 키워드·수치 범위로 매물 검색</span></div>
            <div class="tg-card"><b>가격 제안이 공개</b><span>다른 사람의 구매·제안 내역이 보여서 대략적인 시세를 바로 파악 (연락처는 비공개)</span></div>
            <div class="tg-card"><b>거래방 + 양쪽 확인</b><span>수락하면 1:1 거래방, 판매자·구매자 둘 다 확인해야 거래완료</span></div>
            <div class="tg-card"><b>리뷰·평점과 실제 거래가</b><span>거래가 끝나면 서로 리뷰, 실제로 거래된 가격이 거래내역에 남음</span></div>
            <div class="tg-card"><b>실시간 알림·접속 표시</b><span>신청·수락·메시지가 바로 알림으로, 접속 중인 회원은 초록 점</span></div>
            <div class="tg-card"><b>멈춘 거래 자동 정리</b><span>연락이 끊긴 거래는 자동으로 정리돼 매물이 묶이지 않음</span></div>
          </div>
        </template>

        <!-- 2. 판매하기 -->
        <template v-else-if="tradeGuideState.tab === 'sell'">
          <ol class="tg-steps">
            <li><b>판매글 등록</b> 누르기 <span>로그인 필요 (구글·디스코드)</span></li>
            <li><b>아이템 검색</b> <span>이름·별칭으로 (예: 샤코, 이스트 룬, 무한, 골드). 사전에 없는 매직·레어는 베이스를 골라 등록</span></li>
            <li><b>옵션 수치 입력</b> <span>실제 아이템에 뜬 값 그대로. 유니크·세트는 방어력·데미지도 입력 가능, 미확인 아이템은 수치 없이</span></li>
            <li><b>가격 정하기</b> <span>받을 룬·보석·재료 선택. 또는 <em>흥정 가능</em>(가격 제안도 받음) / <em>제안만 받기</em>(판매가 없이 제안만)</span></li>
            <li><b>등록</b> <span>판매 기간 48시간 동안 거래게시판에 노출</span></li>
          </ol>
          <div class="tg-note">
            <b>알아두기</b>
            <ul>
              <li>여러 개(룬 5개 등)·골드·묶음은 <b>한 번에 통째로</b> 판매 - 나눠 팔려면 글을 따로</li>
              <li>골드는 한 글에 최대 1,500만</li>
              <li>구매신청이 들어오기 전까지 <b>수정</b> 가능 (옵션 수치·판매가·수량·설명, 아이템 자체는 변경 불가)</li>
              <li>48시간이 지나면 목록에서 내려감 - <b>재등록</b>(판매가만 고쳐서 다시 48시간)</li>
            </ul>
          </div>
        </template>

        <!-- 3. 구매하기 -->
        <template v-else-if="tradeGuideState.tab === 'buy'">
          <div class="tg-grid three">
            <div class="tg-card"><b>구매하기</b><span>판매가 그대로 구매 신청</span></div>
            <div class="tg-card"><b>가격 제안</b><span>흥정 가능·제안만 받기 글에 룬·보석·재료로 가격 제안</span></div>
            <div class="tg-card"><b>문의하기 (쪽지)</b><span>거래 시간·옵션 확인 같은 질문은 쪽지로 - 판매글이 링크로 함께 붙음</span></div>
          </div>
          <div class="tg-note">
            <b>알아두기</b>
            <ul>
              <li>한 글에 대기 중인 신청은 한 사람당 하나 - 바꾸려면 취소 후 다시</li>
              <li>신청·제안 내역은 누구나 볼 수 있음 (연락처는 판매자·본인만)</li>
              <li>이미 다른 사람과 거래중인 글에 신청하면 <b>보류</b> → 그 거래가 불발되면 대기로 돌아옴</li>
              <li>☆ 찜하면 거래중이 돼도 거래게시판에서 계속 보임</li>
            </ul>
          </div>
        </template>

        <!-- 4. 거래 진행·상태 -->
        <template v-else-if="tradeGuideState.tab === 'flow'">
          <div class="tg-flow">
            <div class="tg-node sell">판매중</div>
            <div class="tg-arrow">판매자가 신청 하나 수락 →</div>
            <div class="tg-node deal">거래중</div>
            <div class="tg-branch">
              <div><span class="tg-arrow">둘 다 거래완료 →</span> <span class="tg-node done">거래완료</span> <small>리뷰 작성</small></div>
              <div><span class="tg-arrow">거래불발 →</span> <span class="tg-node sell">판매중</span> <small>다시 판매 (48시간 새로)</small></div>
            </div>
          </div>
          <div class="tg-cols">
            <div>
              <div class="tg-sub">판매글 상태</div>
              <dl class="tg-dl">
                <dt><span class="tg-chip sell">판매중</span></dt><dd>신청을 받는 중</dd>
                <dt><span class="tg-chip deal">거래중</span></dt><dd>신청 하나를 수락해 거래방에서 진행 중</dd>
                <dt><span class="tg-chip done">거래완료</span></dt><dd>거래 끝 - 거래내역에 남고 삭제 불가</dd>
              </dl>
            </div>
            <div>
              <div class="tg-sub">구매신청 상태</div>
              <dl class="tg-dl">
                <dt><span class="tg-chip">대기중</span></dt><dd>판매자의 수락·거절을 기다림</dd>
                <dt><span class="tg-chip held">보류</span></dt><dd>다른 사람과 거래중 - 불발되면 대기로</dd>
                <dt><span class="tg-chip deal">수락됨</span></dt><dd>거래방이 열림</dd>
                <dt><span class="tg-chip bad">거절·취소</span></dt><dd>판매자 거절 / 내가 취소 (다시 신청 가능)</dd>
              </dl>
            </div>
          </div>
          <div class="tg-note">
            <b>거래방에서</b>
            <ul>
              <li>접속 시간·배틀태그 등을 맞추고 게임에서 거래</li>
              <li><b>거래완료</b>는 판매자·구매자 <b>둘 다</b> 눌러야 처리 (판매자가 혼자 상태를 바꿀 수 없음)</li>
              <li><b>거래불발</b>은 한 사람만 눌러도 바로 처리</li>
              <li>거래완료 후 서로 리뷰(★1~5) - 프로필에 평점으로 표시</li>
            </ul>
          </div>
        </template>

        <!-- 5. 자동 정리·규칙 -->
        <template v-else>
          <div class="tg-grid">
            <div class="tg-card"><b>판매 기간 48시간</b><span>지나면 목록에서 내려감 - 재등록하면 다시 48시간</span></div>
            <div class="tg-card"><b>대화 없는 거래방</b><span>5일째 알림, 7일 동안 대화가 없으면 자동 거래불발</span></div>
            <div class="tg-card"><b>한쪽만 거래완료</b><span>3일 뒤 자동 거래완료 (하루 전 상대에게 알림) - 못 받았으면 그 전에 거래불발·신고</span></div>
            <div class="tg-card"><b>오래된 신청</b><span>판매 기간이 끝나고 3일이 지나도 재등록이 없으면 남은 신청은 정리</span></div>
          </div>
          <div class="tg-note warn">
            <b>꼭 지켜주세요</b>
            <ul>
              <li>현금 거래·사기·도배 금지 - 신고가 쌓인 글은 자동으로 가려지고, 확인 후 이용 정지</li>
              <li>거래는 회원끼리 직접 진행하며, 사이트는 중개·보증하지 않음</li>
              <li>문제가 생기면 판매글·회원 신고 또는 건의 게시판으로</li>
            </ul>
          </div>
        </template>
      </div>

      <div class="tg-foot">
        <button type="button" class="tg-btn" :disabled="tabIndex() === 0" @click="go(-1)">← 이전</button>
        <span class="tg-dots"><i v-for="(t, i) in TABS" :key="t.key" :class="{ on: i === tabIndex() }"></i></span>
        <button v-if="tabIndex() < TABS.length - 1" type="button" class="tg-btn primary" @click="go(1)">다음 →</button>
        <button v-else type="button" class="tg-btn primary" @click="closeTradeGuide">시작하기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg-overlay{align-items:center;}
.tg{width:100%; max-width:760px; max-height:calc(100vh - 40px); display:flex; flex-direction:column; background:var(--bg-raise); border:1px solid var(--border); border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); overflow:hidden;}
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
@media (max-width:640px){
  .tg-overlay{padding:10px;}
  .tg-grid, .tg-grid.three, .tg-cols{grid-template-columns:1fr;}
  .tg-head, .tg-tabs, .tg-body, .tg-foot{padding-left:16px; padding-right:16px;}
}
</style>
