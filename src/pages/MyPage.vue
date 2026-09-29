<script setup>
import { ref, computed, watch } from 'vue'
import { profileState, saveProfile, authState, signIn } from '../profileStore.js'
import { fetchMyTradePosts, fetchMyRequests, getTradeItem } from '../tradeStore.js'
import { fetchPosts } from '../communityStore.js'
import { fetchReviewsFor } from '../dealsStore.js'
import { ITEM_ICONS } from '../itemIcons.js'

const TABS = ['내가 쓴 글', '거래내역', '받은 리뷰', '회원정보수정']
const activeTab = ref(TABS[0])

// 받은 리뷰 (DB)
const myReviews = ref([])
watch(() => authState.user?.id, async (uid) => { myReviews.value = uid ? await fetchReviewsFor(uid).catch(() => []) : [] }, { immediate: true })

// 내 판매글 / 내가 보낸 구매신청 / 내가 쓴 커뮤니티 글 (DB)
const myTradePosts = ref([])
const myRequests = ref([])
const myCommunityPosts = ref([])
watch(() => authState.user?.id, async (uid) => {
  myTradePosts.value = uid ? await fetchMyTradePosts().catch(() => []) : []
  myRequests.value = uid ? await fetchMyRequests().catch(() => []) : []
  myCommunityPosts.value = uid ? (await fetchPosts({ authorId: uid, pageSize: 50 }).catch(() => ({ posts: [] }))).posts : []
}, { immediate: true })

const myPostsCombined = computed(() => {
  const trade = myTradePosts.value.map((p) => ({ type: 'trade', id: p.id, title: p.itemName, category: p.category, date: p.date, link: `/trade/${p.id}` }))
  const community = myCommunityPosts.value.map((p) => ({ type: 'community', id: p.id, title: p.title, category: p.category, date: p.date, link: `/community/${p.id}` }))
  return [...trade, ...community].sort((a, b) => (a.date < b.date ? 1 : -1))
})

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}
function tradeIconUrl(post) {
  const item = getTradeItem(post.itemId)
  return item ? iconUrlFor(item.icon_key) : null
}

const REQUEST_STATUS_LABEL = { pending: '대기중', accepted: '수락됨', declined: '거절됨', cancelled: '취소됨' }

const nicknameInput = ref(profileState.nickname)
const contactInput = ref(profileState.contact)
watch(() => [profileState.nickname, profileState.contact], ([n, c]) => { nicknameInput.value = n; contactInput.value = c })
const savedToast = ref(false)
const saveError = ref('')
const saving = ref(false)
async function saveProfileForm() {
  saveError.value = ''
  const nick = nicknameInput.value.trim()
  if (nick.length < 2 || nick.length > 20) return (saveError.value = '닉네임은 2~20자로 정해주세요')
  saving.value = true
  try {
    await saveProfile({ nickname: nick, contact: contactInput.value })
    savedToast.value = true
    setTimeout(() => (savedToast.value = false), 2000)
  } catch (e) {
    // 닉네임 중복(unique 제약) 등
    saveError.value = /duplicate|unique/i.test(e.message || '') ? '이미 쓰는 사람이 있는 닉네임이에요' : e.message || '저장하지 못했어요'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page mypage">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">내 정보</div>
      <h1>마이페이지</h1>
      <p>내가 쓴 글, 거래내역, 회원정보를 한곳에서 관리하세요.</p>
    </div>
  </div>

  <div class="grid-wrap mypage-wrap" v-if="!authState.user">
    <div class="mypage-login">
      <p>로그인하면 내가 쓴 글·거래내역·받은 리뷰를 볼 수 있어요.</p>
      <button type="button" class="btn-primary" @click="signIn">디스코드로 로그인</button>
    </div>
  </div>
  <div class="grid-wrap mypage-wrap" v-else>
    <div class="mypage-tabs">
      <button v-for="t in TABS" :key="t" :class="{ active: activeTab === t }" @click="activeTab = t">{{ t }}</button>
    </div>

    <div v-if="activeTab === '내가 쓴 글'" class="mypage-panel">
      <div class="my-post-row" v-for="p in myPostsCombined" :key="p.type + p.id">
        <span class="my-post-type" :class="'type-' + p.type">{{ p.type === 'trade' ? '거래' : '커뮤니티' }}</span>
        <span class="my-post-cat">{{ p.category }}</span>
        <router-link :to="p.link" class="my-post-title">{{ p.title }}</router-link>
        <span class="my-post-date">{{ p.date }}</span>
      </div>
      <div class="empty-state" v-if="!myPostsCombined.length">아직 작성한 글이 없어요</div>
    </div>

    <div v-else-if="activeTab === '거래내역'" class="mypage-panel">
      <div class="d-section-title">내가 등록한 판매글</div>
      <div class="my-trade-row" v-for="p in myTradePosts" :key="p.id">
        <span class="my-trade-icon"><img v-if="tradeIconUrl(p)" :src="tradeIconUrl(p)" alt="" /></span>
        <router-link :to="`/trade/${p.id}`" class="my-trade-name">{{ p.itemName }}</router-link>
        <span class="status-badge" :class="'status-' + p.status">{{ p.status }}</span>
        <span class="my-trade-date">{{ p.date }}</span>
      </div>
      <div class="empty-state" v-if="!myTradePosts.length">등록한 판매글이 없어요</div>

      <div class="d-section-title" style="margin-top:26px;">내가 구매신청 보낸 거래</div>
      <div class="my-trade-row" v-for="r in myRequests" :key="'buy-' + r.id">
        <span class="my-trade-icon"><img v-if="tradeIconUrl(r.post)" :src="tradeIconUrl(r.post)" alt="" /></span>
        <router-link :to="`/trade/${r.post.id}`" class="my-trade-name">{{ r.post.itemName }}</router-link>
        <span class="request-status" :class="'status-' + (r.status || 'pending')">{{ REQUEST_STATUS_LABEL[r.status || 'pending'] }}</span>
        <span class="my-trade-date">{{ r.date }}</span>
      </div>
      <div class="empty-state" v-if="!myRequests.length">보낸 구매신청이 없어요</div>
    </div>

    <div v-else-if="activeTab === '받은 리뷰'" class="mypage-panel">
      <div class="my-review-row" v-for="r in myReviews" :key="r.dealId">
        <div class="my-review-top">
          <span class="my-review-stars"><span v-for="n in 5" :key="n" class="star" :class="{ filled: n <= r.rating }">★</span></span>
          <span class="my-review-from">{{ r.from }}</span>
          <span class="my-review-post">{{ r.postTitle }}</span>
          <span class="my-review-date">{{ r.date }}</span>
        </div>
        <div class="my-review-comment" v-if="r.comment">{{ r.comment }}</div>
      </div>
      <div class="empty-state" v-if="!myReviews.length">아직 받은 리뷰가 없어요</div>
    </div>

    <div v-else class="mypage-panel profile-panel">
      <label class="profile-field">
        닉네임
        <input type="text" v-model="nicknameInput" placeholder="판매글·게시글에 보일 닉네임 (2~20자)" maxlength="20" class="write-input" />
      </label>
      <label class="profile-field">
        연락처
        <input type="text" v-model="contactInput" placeholder="배틀태그, 디스코드 등" class="write-input" />
        <small class="profile-hint-public">거래 상대가 볼 수 있게 공개돼요.</small>
      </label>
      <div class="profile-actions">
        <button class="btn-primary" :disabled="saving" @click="saveProfileForm">저장</button>
        <span class="profile-saved-toast" v-if="savedToast">저장했어요!</span>
        <span class="profile-save-error" v-if="saveError">{{ saveError }}</span>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.mypage-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px; text-align:center;}
.profile-hint-public{font-size:11.5px; color:var(--text-dim); font-weight:400;}
.profile-save-error{font-size:12.5px; color:#e0775f;}
.mypage-wrap{max-width:920px;}
.mypage-tabs{display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; width:fit-content; margin-bottom:20px;}
.mypage-tabs button{font-size:13px; padding:10px 20px; color:var(--text-dim); background:var(--panel);}
.mypage-tabs button + button{border-left:1px solid var(--border);}
.mypage-tabs button.active{color:var(--gold); background:var(--panel-2);}

.mypage-panel{display:flex; flex-direction:column; gap:10px;}

.my-post-row{
  display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border-soft);
  padding:14px 18px; border-radius:12px; flex-wrap:wrap;
}
.my-post-type{font-size:10.5px; padding:3px 11px; border-radius:999px; flex:none; font-weight:600; border:1px solid var(--border);}
.my-post-type.type-trade{color:var(--gold); border-color:var(--gold-dim);}
.my-post-type.type-community{color:var(--teal); border-color:var(--teal);}
.my-post-cat{font-size:11px; color:var(--text-dim); flex:none;}
.my-post-title{flex:1; font-size:13.5px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.my-post-title:hover{color:var(--gold-dim);}
.my-post-date{font-size:11.5px; color:var(--text-dim); flex:none;}

.my-trade-row{
  display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border-soft);
  padding:12px 18px; border-radius:12px; flex-wrap:wrap;
}
.my-trade-icon{
  width:30px; height:30px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:8px;
}
.my-trade-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.my-trade-name{flex:1; font-size:13.5px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.my-trade-name:hover{color:var(--gold-dim);}
.my-trade-req-count{font-size:11.5px; color:var(--text-dim); flex:none;}
.my-trade-date{font-size:11.5px; color:var(--text-dim); flex:none;}

.status-badge{font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim); flex:none;}
.status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.status-badge.status-거래완료{color:var(--text-dim); border-color:var(--border);}

.request-status{font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim); flex:none;}
.request-status.status-accepted{color:var(--gold); border-color:var(--gold-dim);}
.request-status.status-declined{color:var(--blood); border-color:var(--blood);}

.my-review-row{background:var(--panel); border:1px solid var(--border-soft); padding:14px 18px; border-radius:12px; display:flex; flex-direction:column; gap:8px;}
.my-review-top{display:flex; align-items:center; gap:10px; flex-wrap:wrap;}
.my-review-stars .star{font-size:14px; color:var(--border);}
.my-review-stars .star.filled{color:var(--gold);}
.my-review-from{font-size:12.5px; color:var(--gold-dim); font-weight:600;}
.my-review-post{font-size:11.5px; color:var(--text-dim); flex:1;}
.my-review-date{font-size:11px; color:var(--text-dim);}
.my-review-comment{font-size:13px; color:var(--text-muted); line-height:1.7;}

.profile-panel{max-width:420px;}
.profile-field{display:flex; flex-direction:column; gap:8px; font-size:12.5px; color:var(--text-dim);}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.profile-actions{display:flex; align-items:center; gap:12px;}
.profile-saved-toast{font-size:12px; color:var(--teal);}
</style>
