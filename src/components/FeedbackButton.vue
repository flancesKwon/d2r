<script setup>
// 화면 오른쪽 아래 피드백 버튼 + 보내는 창. 로그인한 회원만 보낼 수 있음
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { authState, signIn } from '../profileStore.js'
import { FEEDBACK_KINDS, submitFeedback } from '../feedbackStore.js'

const route = useRoute()
const open = ref(false)
const done = ref(false)
const kind = ref('bug')
const content = ref('')
const error = ref('')
const sending = ref(false)

function start() {
  if (!authState.user) return signIn()
  done.value = false
  error.value = ''
  open.value = true
}
async function send() {
  if (content.value.trim().length < 5 || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await submitFeedback({ kind: kind.value, content: content.value, page: route.fullPath.slice(0, 300) })
    content.value = ''
    done.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <button type="button" class="fb-fab" @click="start">{{ $t('피드백') }}</button>
  <Teleport to="body">
    <div class="modal-overlay" v-if="open" @click.self="open = false">
      <div class="modal-panel fb-panel" role="dialog" aria-modal="true" aria-labelledby="fb-title">
        <button type="button" class="modal-close" :aria-label="$t('닫기')" @click="open = false">✕</button>
        <h2 id="fb-title" class="fb-title">{{ $t('피드백 보내기') }}</h2>
        <template v-if="done">
          <p class="fb-done">{{ $t('보냈어요. 고맙습니다') }}</p>
          <div class="fb-actions"><button type="button" class="btn-primary" @click="open = false">{{ $t('닫기') }}</button></div>
        </template>
        <template v-else>
          <div class="fb-kinds" role="radiogroup" :aria-label="$t('종류')">
            <button
              v-for="k in FEEDBACK_KINDS" :key="k.value" type="button" role="radio"
              :aria-checked="kind === k.value" :class="{ active: kind === k.value }" @click="kind = k.value"
            >{{ $t(k.label) }}</button>
          </div>
          <textarea v-model="content" class="fb-text" maxlength="1000" rows="5" :placeholder="$t('어떤 화면에서 무엇이 불편했는지, 어떻게 바뀌면 좋을지 적어주세요')"></textarea>
          <div class="fb-error" v-if="error">{{ $t(error) }}</div>
          <div class="fb-actions">
            <button type="button" class="btn-ghost" @click="open = false">{{ $t('취소') }}</button>
            <button type="button" class="btn-primary" :disabled="content.trim().length < 5 || sending" @click="send">{{ $t('보내기') }}</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fb-fab{
  position:fixed; right:16px; bottom:16px; z-index:40; font-size:13px; font-weight:700; color:#1b1714;
  background:var(--gold); padding:10px 16px; border-radius:999px; box-shadow:0 4px 14px rgba(0,0,0,.45);
}
.fb-fab:hover{background:var(--focus);}
@media (max-width:720px){
  .fb-fab{bottom:calc(72px + env(safe-area-inset-bottom));}
}
.fb-panel{max-width:440px; padding:28px 26px 24px; border-radius:16px; margin-top:10vh;}
.fb-title{font-family:'Noto Serif KR', serif; font-size:18px; color:var(--text); margin-bottom:16px;}
.fb-kinds{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;}
.fb-kinds button{font-size:13px; color:var(--text-muted); border:1px solid var(--border); padding:8px 14px; border-radius:999px;}
.fb-kinds button:hover{border-color:var(--gold-dim);}
.fb-kinds button.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel-2);}
.fb-text{
  width:100%; background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; border-radius:10px; resize:vertical; font-family:inherit;
}
.fb-done{font-size:14px; color:var(--text-muted); margin:8px 0 4px;}
.fb-error{font-size:12.5px; color:#e0775f; margin-top:8px;}
.fb-actions{display:flex; justify-content:flex-end; gap:8px; margin-top:16px;}
.fb-actions button{padding:10px 18px; font-size:13px; border-radius:10px;}
.fb-actions .btn-primary:disabled{opacity:.5; cursor:default;}
</style>
