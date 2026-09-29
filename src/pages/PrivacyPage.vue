<script setup>
// 개인정보 처리 안내 - 디스코드 로그인으로 받는 정보와 보관·삭제
</script>

<template>
  <div class="items-page privacy-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">안내</div>
      <h1>개인정보 처리 안내</h1>
      <p>디아허브가 어떤 정보를 받고 어떻게 다루는지 적어 두었어요.</p>
    </div>
  </div>

  <div class="grid-wrap privacy-wrap">
    <section>
      <h2>받는 정보</h2>
      <ul>
        <li>디스코드 로그인 시: 디스코드 계정 식별값, 디스코드 이름, 프로필 사진 주소</li>
        <li>직접 입력하는 것: 닉네임, 연락처(배틀태그·디스코드 등), 게시글·댓글·판매글·쪽지·리뷰</li>
        <li>비밀번호는 받지 않아요. 로그인은 디스코드가 처리해요.</li>
      </ul>
    </section>
    <section>
      <h2>공개되는 정보</h2>
      <ul>
        <li>닉네임, 프로필 사진, 게시글·댓글·판매글·리뷰는 누구나 볼 수 있어요.</li>
        <li>마이페이지에 적은 연락처는 거래를 위해 공개돼요. 공개를 원하지 않으면 비워 두세요.</li>
        <li>쪽지·구매신청·거래방 대화는 당사자만 볼 수 있어요.</li>
      </ul>
    </section>
    <section>
      <h2>쓰는 곳</h2>
      <ul>
        <li>로그인, 글 작성자 표시, 거래 상대와의 연락에만 써요. 광고나 다른 곳에 넘기지 않아요.</li>
        <li>정보는 Supabase(데이터베이스 서비스)에 저장돼요.</li>
      </ul>
    </section>
    <section>
      <h2>보관과 삭제</h2>
      <ul>
        <li>회원 탈퇴를 요청하면 계정과 계정에 딸린 글·쪽지·거래 기록을 함께 지워요.</li>
        <li>탈퇴·삭제 요청과 문의는 커뮤니티의 <router-link to="/community/write?cat=질문">문의</router-link>로 남겨 주세요.</li>
      </ul>
    </section>
  </div>
  </div>
</template>

<style scoped>
.privacy-wrap{max-width:820px; display:flex; flex-direction:column; gap:26px;}
.privacy-wrap h2{font-family:'Noto Serif KR', serif; font-size:17px; color:var(--gold); margin-bottom:10px;}
.privacy-wrap ul{padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:14px; color:var(--text-muted); line-height:1.7;}
.privacy-wrap a{color:var(--gold-dim); text-decoration:underline;}
</style>
