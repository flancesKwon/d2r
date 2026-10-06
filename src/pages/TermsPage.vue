<script setup>
// 이용 규칙 - 금지 행위, 거래 책임, 신고·정지, 도배 제한
</script>

<template>
  <div class="items-page terms-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">안내</div>
      <h1>이용 규칙</h1>
    </div>
  </div>

  <div class="grid-wrap terms-wrap">
    <section>
      <h2>사이트</h2>
      <ul>
        <li>디아블로 II: 레저렉션 비공식 팬 사이트. Blizzard Entertainment와 무관</li>
        <li>게임 데이터·계산 결과는 참고용. 패치로 달라질 수 있음</li>
        <li>로그인하면 이 규칙과 <router-link to="/privacy">개인정보 처리 안내</router-link>에 동의한 것으로 봄</li>
      </ul>
    </section>
    <section>
      <h2>금지 행위</h2>
      <ul>
        <li>현금 거래(아이템·계정을 돈으로 사고팔기), 현금 거래 광고</li>
        <li>사기, 다른 사람 사칭, 거래 약속 고의 불이행</li>
        <li>욕설·비방·차별 발언, 개인정보 노출</li>
        <li>도배, 같은 판매글 반복 등록, 홍보·광고</li>
        <li>핵·매크로·복사 버그 등 게임 규칙 위반 아이템·서비스 거래</li>
      </ul>
    </section>
    <section>
      <h2>거래</h2>
      <ul>
        <li>거래는 회원끼리 직접 진행. 사이트는 중개·보증하지 않음</li>
        <li>판매글은 올린 때부터 48시간 동안 판매. 지나면 목록에서 내려가고, 판매자가 판매가만 고쳐 재등록 가능</li>
        <li>거래완료된 판매글은 삭제 불가 (거래내역·후기 보존)</li>
        <li>거래 손해는 당사자 책임. 거래방 대화와 리뷰로 상대 확인 권장</li>
        <li>사기 피해는 글·프로필의 신고 버튼으로 신고 (거래방 대화가 증거로 쓰임)</li>
      </ul>
    </section>
    <section>
      <h2>신고와 이용 정지</h2>
      <ul>
        <li>운영진이 신고 확인 후 글 삭제, 기간 정지, 영구 정지 가능</li>
        <li>서로 다른 3명이 신고한 글·댓글·판매글은 운영진 확인 전까지 자동으로 가려짐</li>
        <li>금칙어(현금거래 관련 등)가 들어간 글·댓글·판매글·쪽지는 등록 불가</li>
        <li>정지 중에는 글·댓글·판매글·구매신청·쪽지·리뷰 작성 불가 (읽기는 가능)</li>
        <li>정지 사유는 본인에게 표시. 이의 제기는 커뮤니티의 <router-link to="/community/write?cat=건의">건의게시판</router-link>로</li>
      </ul>
    </section>
    <section>
      <h2>작성 제한 (도배 방지)</h2>
      <ul>
        <li>커뮤니티 글: 10분에 5개, 하루 30개</li>
        <li>댓글: 1분에 5개, 하루 300개</li>
        <li>판매글: 10분에 10개, 하루 60개 / 구매신청: 10분에 10개, 하루 100개</li>
        <li>쪽지·거래방 대화: 1분에 20개</li>
        <li>지운 글도 개수에 포함</li>
      </ul>
    </section>
    <section>
      <h2>변경</h2>
      <ul>
        <li>규칙이 바뀌면 이 페이지에 반영</li>
      </ul>
    </section>
  </div>
  </div>
</template>

<style scoped>
.terms-wrap{max-width:820px; display:flex; flex-direction:column; gap:26px;}
.terms-wrap h2{font-family:'Noto Serif KR', serif; font-size:17px; color:var(--gold); margin-bottom:10px;}
.terms-wrap ul{padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:14px; color:var(--text-muted); line-height:1.7;}
.terms-wrap a{color:var(--gold-dim); text-decoration:underline;}
</style>
