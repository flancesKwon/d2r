<script setup>
// 사이트 확인 모달 (src/dialog.js 의 askConfirm·askPrompt·showAlert) - App.vue 에 하나만 둠
import { ref, watch, nextTick } from 'vue'
import { dialogState, closeDialog } from '../dialog.js'

const okBtn = ref(null)
const input = ref(null)
watch(() => dialogState.open, (open) => {
  if (!open) return
  nextTick(() => (dialogState.kind === 'prompt' ? input.value : okBtn.value)?.focus())
})
function onKey(e) {
  if (e.key === 'Escape') closeDialog(false)
  if (e.key === 'Enter' && dialogState.kind === 'prompt') closeDialog(true)
}
</script>

<template>
  <Transition name="dlg">
    <div class="dlg-backdrop" v-if="dialogState.open" @mousedown.self="closeDialog(false)" @keydown="onKey">
      <div class="dlg" role="dialog" aria-modal="true" :aria-label="dialogState.title">
        <div class="dlg-icon" :class="{ danger: dialogState.danger, success: dialogState.icon === 'success' && !dialogState.danger }" aria-hidden="true">
          <svg v-if="dialogState.icon === 'success' && !dialogState.danger" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></svg>
          <svg v-else-if="dialogState.danger" viewBox="0 0 24 24"><path d="M12 8v5M12 16.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          <svg v-else viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></svg>
        </div>
        <div class="dlg-title">{{ dialogState.title }}</div>
        <div class="dlg-message" v-if="dialogState.message">{{ dialogState.message }}</div>
        <input
          v-if="dialogState.kind === 'prompt'" ref="input" v-model="dialogState.value" class="dlg-input"
          :placeholder="dialogState.placeholder" maxlength="200"
        />
        <div class="dlg-actions">
          <button type="button" class="dlg-btn cancel" v-if="dialogState.kind !== 'alert'" @click="closeDialog(false)">{{ dialogState.cancelText }}</button>
          <button type="button" ref="okBtn" class="dlg-btn ok" :class="{ danger: dialogState.danger }" @click="closeDialog(true)">{{ dialogState.confirmText }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dlg-backdrop{position:fixed; inset:0; z-index:200; background:rgba(8,6,4,0.62); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px;}
.dlg{
  width:100%; max-width:400px; background:var(--panel); border:1px solid var(--border); border-radius:18px;
  padding:26px 24px 20px; box-shadow:0 30px 60px -20px rgba(0,0,0,0.8); text-align:center;
}
.dlg-icon{width:48px; height:48px; margin:0 auto 14px; border-radius:999px; display:flex; align-items:center; justify-content:center; background:rgba(200,163,77,0.14); color:var(--gold);}
.dlg-icon.success{background:rgba(62,207,90,0.14); color:#3ecf5a;}
.dlg-icon.danger{background:rgba(162,81,63,0.18); color:#e0775f;}
.dlg-icon svg{width:24px; height:24px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;}
.dlg-title{font-family:'Noto Serif KR', serif; font-size:18px; font-weight:700; color:var(--text); line-height:1.45; word-break:keep-all;}
.dlg-message{font-size:13.5px; color:var(--text-muted); margin-top:8px; line-height:1.65; word-break:keep-all;}
.dlg-input{width:100%; margin-top:14px; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:14px; padding:11px 14px; border-radius:10px;}
.dlg-input:focus{outline:none; border-color:var(--gold-dim);}
.dlg-actions{display:flex; gap:8px; margin-top:22px;}
.dlg-btn{flex:1; font-size:14px; font-weight:700; padding:12px 0; border-radius:12px; border:1px solid var(--border); color:var(--text-muted);}
.dlg-btn.cancel:hover{color:var(--text); border-color:var(--text-dim);}
.dlg-btn.ok{background:var(--gold); border-color:var(--gold); color:#1a1408;}
.dlg-btn.ok.danger{background:#b5533f; border-color:#b5533f; color:#fff;}
.dlg-btn.ok:hover{filter:brightness(1.08);}
.dlg-btn:focus-visible{outline:2px solid var(--gold); outline-offset:2px;}
.dlg-enter-active, .dlg-leave-active{transition:opacity .15s ease;}
.dlg-enter-active .dlg, .dlg-leave-active .dlg{transition:transform .15s ease;}
.dlg-enter-from, .dlg-leave-to{opacity:0;}
.dlg-enter-from .dlg, .dlg-leave-to .dlg{transform:translateY(8px) scale(.98);}
</style>
