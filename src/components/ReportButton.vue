<script setup>
// 신고 버튼 + 사유 고르는 창. 내 글이면 안 보임 (DB 도 막음)
import { ref, computed } from 'vue'
import { authState, signIn } from '../profileStore.js'
import { REPORT_REASONS, REPORT_TARGET_LABEL, submitReport } from '../reportStore.js'

const props = defineProps({
  targetType: { type: String, required: true },
  targetId: { type: [String, Number], required: true },
  ownerId: { type: String, default: null },
  label: { type: String, default: '신고' },
})

const hidden = computed(() => !!authState.user && props.ownerId === authState.user.id)
const open = ref(false)
const done = ref(false)
const reason = ref('')
const detail = ref('')
const error = ref('')
const sending = ref(false)

function start() {
  if (!authState.user) return signIn()
  error.value = ''
  open.value = true
}
function close() {
  open.value = false
}
async function send() {
  if (!reason.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await submitReport({ targetType: props.targetType, targetId: props.targetId, reason: reason.value, detail: detail.value })
    done.value = true
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <template v-if="!hidden">
    <button type="button" class="report-btn" :disabled="done" @click="start">{{ done ? $t('신고함') : $t(label) }}</button>
    <Teleport to="body">
      <div class="modal-overlay" v-if="open" @click.self="close">
        <div class="modal-panel report-panel" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <button type="button" class="modal-close" :aria-label="$t('닫기')" @click="close">✕</button>
          <h2 id="report-title" class="report-title">{{ $t('{x} 신고', { x: $t(REPORT_TARGET_LABEL[targetType]) }) }}</h2>
          <div class="report-reasons" role="radiogroup" :aria-label="$t('신고 사유')">
            <button
              v-for="r in REPORT_REASONS" :key="r.value" type="button" role="radio"
              :aria-checked="reason === r.value" :class="{ active: reason === r.value }" @click="reason = r.value"
            >{{ $t(r.label) }}</button>
          </div>
          <textarea v-model="detail" class="report-detail" maxlength="500" rows="3" :placeholder="$t('자세한 내용 (선택)')"></textarea>
          <div class="report-error" v-if="error">{{ $t(error) }}</div>
          <div class="report-actions">
            <button type="button" class="btn-ghost" @click="close">{{ $t('취소') }}</button>
            <button type="button" class="btn-primary" :disabled="!reason || sending" @click="send">{{ $t('신고하기') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
</template>

<style scoped>
.report-btn{font-size:11.5px; color:var(--text-dim); border:1px solid var(--border-soft); padding:5px 12px; border-radius:999px;}
.report-btn:hover:not(:disabled){color:#e0775f; border-color:#e0775f;}
.report-btn:disabled{opacity:.6; cursor:default;}

.report-panel{max-width:440px; padding:28px 26px 24px; border-radius:16px; margin-top:10vh;}
.report-title{font-family:'Noto Serif KR', serif; font-size:18px; color:var(--text); margin-bottom:16px;}
.report-reasons{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;}
.report-reasons button{font-size:13px; color:var(--text-muted); border:1px solid var(--border); padding:8px 14px; border-radius:999px;}
.report-reasons button:hover{border-color:var(--gold-dim);}
.report-reasons button.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel-2);}
.report-detail{
  width:100%; background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; border-radius:10px; resize:vertical; font-family:inherit;
}
.report-error{font-size:12.5px; color:#e0775f; margin-top:8px;}
.report-actions{display:flex; justify-content:flex-end; gap:8px; margin-top:16px;}
.report-actions button{padding:10px 18px; font-size:13px; border-radius:10px;}
.report-actions .btn-primary:disabled{opacity:.5; cursor:default;}
</style>
