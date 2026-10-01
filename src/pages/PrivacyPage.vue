<script setup>
// 개인정보 처리 안내 - 디스코드·구글 로그인으로 받는 정보와 보관·삭제
</script>

<template>
  <div class="items-page privacy-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">안내</div>
      <h1>개인정보 처리 안내</h1>
    </div>
  </div>

  <div class="grid-wrap privacy-wrap">
    <section>
      <h2>받는 정보</h2>
      <ul>
        <li>디스코드·구글 로그인 시: 계정 식별값, 계정 이름, 프로필 사진 주소 (구글은 이메일 주소도 받지만 화면에 표시 안 함)</li>
        <li>처음 로그인 시 계정 이름이 닉네임 (마이페이지에서 변경 가능)</li>
        <li>직접 입력하는 것: 닉네임, 연락처(배틀태그·디스코드 등), 게시글·댓글·판매글·쪽지·리뷰</li>
        <li>마지막 활동 시각 (사이트를 쓰는 동안 5분 단위로 기록)</li>
        <li>비밀번호 저장 안 함 (로그인은 디스코드·구글이 처리)</li>
      </ul>
    </section>
    <section>
      <h2>공개되는 정보</h2>
      <ul>
        <li>닉네임, 프로필 사진, 게시글·댓글·판매글·리뷰: 전체 공개</li>
        <li>마이페이지 연락처: 거래용 공개 (원치 않으면 비워 둘 것)</li>
        <li>쪽지·구매신청·거래방 대화: 당사자만</li>
        <li>마지막 활동 시각: 공개 (거래 상대 확인용)</li>
        <li>신고 내용(신고자·대상·사유): 신고자 본인과 운영진만</li>
      </ul>
    </section>
    <section>
      <h2>쓰는 곳</h2>
      <ul>
        <li>로그인, 작성자 표시, 거래 연락에만 사용. 광고·제3자 제공 없음</li>
        <li>신고는 운영진이 확인, 규칙 위반 글 삭제·계정 정지 가능 (정지 사유는 본인에게 표시)</li>
        <li>저장 위치: Supabase(데이터베이스 서비스)</li>
        <li>백업: 주 1회 암호화해 30일 보관</li>
      </ul>
    </section>
    <section>
      <h2>보관과 삭제</h2>
      <ul>
        <li>탈퇴 요청 시 계정과 글·쪽지·거래 기록 함께 삭제 (백업에서는 30일 안에 사라짐)</li>
        <li>탈퇴·삭제 요청과 문의는 커뮤니티의 <router-link to="/community/write?cat=건의">건의게시판</router-link>로 접수</li>
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
