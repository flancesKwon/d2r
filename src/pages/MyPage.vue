<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import { profileState, saveProfile } from '../profileStore.js'
import { tradePostsByAuthor, tradePostsWithMyRequests, getTradeItem } from '../tradeStore.js'
import { communityPostsByAuthor } from '../communityStore.js'
import iconsData from '../data/icons.json'

const TABS = ['내가 쓴 글', '거래내역', '회원정보수정']
const activeTab = ref(TABS[0])

const myTradePosts = computed(() => tradePostsByAuthor(profileState.nickname))
const myCommunityPosts = computed(() => communityPostsByAuthor(profileState.nickname))
const myPurchasePosts = computed(() => tradePostsWithMyRequests(profileState.nickname))

const myPostsCombined = computed(() => {
  const trade = myTradePosts.value.map((p) => ({ type: 'trade', id: p.id, title: p.itemName, category: p.category, date: p.date, link: `/trade/${p.id}` }))
  const community = myCommunityPosts.value.map((p) => ({ type: 'community', id: p.id, title: p.title, category: p.category, date: p.date, link: `/community/${p.id}` }))
  return [...trade, ...community].sort((a, b) => (a.date < b.date ? 1 : -1))
})

function iconUrlFor(iconKey) {
  const b64 = iconKey && iconsData[iconKey]
  return b64 ? 'data:image/png;base64,' + b64 : null
}
function tradeIconUrl(post) {
  const item = getTradeItem(post.itemId)
  return item ? iconUrlFor(item.icon_key) : null
}

const REQUEST_STATUS_LABEL = { pending: '대기중', accepted: '수락됨', declined: '거절됨' }

const nicknameInput = ref(profileState.nickname)
const contactInput = ref(profileState.contact)
const savedToast = ref(false)
function saveProfileForm() {
  saveProfile({ nickname: nicknameInput.value, contact: contactInput.value })
  savedToast.value = true
  setTimeout(() => (savedToast.value = false), 2000)
}
</script>

<template>
  <div class="items-page mypage">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>마이페이지</b></div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">내 정보</div>
      <h1>마이페이지</h1>
      <p>내가 쓴 글, 거래내역, 회원정보를 한곳에서 관리하세요. 서버 로그인 없이 브라우저에 저장돼요.</p>
    </div>
  </div>

  <div class="grid-wrap mypage-wrap">
    <div class="mypage-tabs">
      <button v-for="t in TABS" :key="t" :class="{ active: activeTab === t }" @click="activeTab = t">{{ t }}</button>
    </div>

    <div class="no-nickname-notice" v-if="!profileState.nickname">
      아직 닉네임이 설정되지 않았어요. "회원정보수정" 탭에서 닉네임을 등록하면, 그 닉네임으로 쓴 게시글·거래내역이 여기 모여요.
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
        <span class="my-trade-req-count">구매신청 {{ p.requests.length }}건</span>
        <span class="my-trade-date">{{ p.date }}</span>
      </div>
      <div class="empty-state" v-if="!myTradePosts.length">등록한 판매글이 없어요</div>

      <div class="d-section-title" style="margin-top:26px;">내가 구매신청 보낸 거래</div>
      <div class="my-trade-row" v-for="p in myPurchasePosts" :key="'buy-' + p.id">
        <span class="my-trade-icon"><img v-if="tradeIconUrl(p)" :src="tradeIconUrl(p)" alt="" /></span>
        <router-link :to="`/trade/${p.id}`" class="my-trade-name">{{ p.itemName }}</router-link>
        <span
          class="request-status" v-for="r in p.requests.filter((r) => r.buyer === profileState.nickname)" :key="r.id"
          :class="'status-' + (r.status || 'pending')"
        >{{ REQUEST_STATUS_LABEL[r.status || 'pending'] }}</span>
        <span class="my-trade-date">{{ p.date }}</span>
      </div>
      <div class="empty-state" v-if="!myPurchasePosts.length">보낸 구매신청이 없어요</div>
    </div>

    <div v-else class="mypage-panel profile-panel">
      <label class="profile-field">
        닉네임
        <input type="text" v-model="nicknameInput" placeholder="판매글·게시글에 쓸 닉네임" class="write-input" />
      </label>
      <label class="profile-field">
        연락처
        <input type="text" v-model="contactInput" placeholder="배틀태그, 디스코드 등" class="write-input" />
      </label>
      <div class="profile-hint">여기서 저장한 닉네임·연락처는 새 판매글·게시글 작성 시 자동으로 채워져요.</div>
      <div class="profile-actions">
        <button class="btn-primary" @click="saveProfileForm">저장</button>
        <span class="profile-saved-toast" v-if="savedToast">저장했어요!</span>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.mypage-wrap{max-width:920px;}
.mypage-tabs{display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; width:fit-content; margin-bottom:20px;}
.mypage-tabs button{font-size:13px; padding:10px 20px; color:var(--text-dim); background:var(--panel);}
.mypage-tabs button + button{border-left:1px solid var(--border);}
.mypage-tabs button.active{color:var(--gold); background:var(--panel-2);}

.no-nickname-notice{
  font-size:12.5px; color:var(--text-dim); background:var(--panel-2); border:1px solid var(--border-soft);
  padding:14px 18px; border-radius:12px; margin-bottom:20px; line-height:1.7;
}

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

.profile-panel{max-width:420px;}
.profile-field{display:flex; flex-direction:column; gap:8px; font-size:12.5px; color:var(--text-dim);}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.profile-hint{font-size:11.5px; color:var(--text-dim); line-height:1.6;}
.profile-actions{display:flex; align-items:center; gap:12px;}
.profile-saved-toast{font-size:12px; color:var(--teal);}
</style>
