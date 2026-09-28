<script setup>
// 게임 아이템 툴팁 모양 카드를 캔버스로 그림 - 화면에 보이는 것과 "이미지로 저장"한 PNG가 똑같은 그림
// 줄 목록은 itemTooltip.js의 buildTooltip이 만듦
import { ref, watch, onMounted } from 'vue'
import { ITEM_ICONS } from '../itemIcons.js'

const props = defineProps({
  tooltip: { type: Object, required: true },
  fileName: { type: String, default: 'item' },
})

const canvas = ref(null)
const PAD = 20
const LINE_H = 23
const MIN_W = 240
const MAX_W = 440
const FONT = '"Noto Sans KR", sans-serif'

function loadIcon(key) {
  const url = key && ITEM_ICONS[key]
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// 너무 긴 옵션 줄은 폭 안에서 단어 단위로 줄바꿈
function wrap(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const out = []
  let cur = ''
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && cur) {
      out.push(cur)
      cur = word
    } else cur = next
  }
  if (cur) out.push(cur)
  return out
}

let drawId = 0
async function draw() {
  const el = canvas.value
  if (!el) return
  const id = ++drawId
  // 웹폰트가 준비되기 전에 그리면 기본 글꼴로 그려져서 기다림
  if (document.fonts?.ready) await document.fonts.ready
  const icon = await loadIcon(props.tooltip.icon_key)
  if (id !== drawId) return

  const ctx = el.getContext('2d')
  const fontFor = (i) => `${i === 0 ? 700 : 500} ${i === 0 ? 16 : 14.5}px ${FONT}`
  // 폭 계산 -> 줄바꿈
  let widest = 0
  for (const [i, l] of props.tooltip.lines.entries()) {
    ctx.font = fontFor(i)
    widest = Math.max(widest, ctx.measureText(l.text).width)
  }
  const width = Math.round(Math.min(MAX_W, Math.max(MIN_W, widest + PAD * 2)))
  const rows = []
  for (const [i, l] of props.tooltip.lines.entries()) {
    ctx.font = fontFor(i)
    for (const t of wrap(ctx, l.text, width - PAD * 2)) rows.push({ text: t, color: l.color, font: fontFor(i) })
  }

  // 작은 도트 아이콘(28px 단위)은 2배로, 큰 그림(룬워드 베이스 등)은 그대로
  const scale = icon && icon.naturalWidth <= 56 ? 2 : 1
  const iconW = icon ? icon.naturalWidth * scale : 0
  const iconH = icon ? icon.naturalHeight * scale : 0
  const height = Math.round(PAD + (icon ? iconH + 14 : 0) + rows.length * LINE_H + PAD - 4)

  const ratio = Math.max(2, window.devicePixelRatio || 1)
  el.width = width * ratio
  el.height = height * ratio
  // 높이는 CSS auto로 비율 유지 (좁은 화면에서 max-width로 줄어들 때 찌그러지지 않게)
  el.style.width = width + 'px'
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

  ctx.fillStyle = 'rgba(8, 8, 10, 0.94)'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  let y = PAD
  if (icon) {
    ctx.imageSmoothingEnabled = scale === 1
    ctx.globalAlpha = props.tooltip.ethereal ? 0.55 : 1 // 에테리얼은 게임처럼 반투명
    ctx.drawImage(icon, Math.round((width - iconW) / 2), y, iconW, iconH)
    ctx.globalAlpha = 1
    y += iconH + 14
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const r of rows) {
    ctx.font = r.font
    ctx.fillStyle = r.color
    ctx.fillText(r.text, width / 2, y)
    y += LINE_H
  }
}

function download() {
  const el = canvas.value
  if (!el) return
  el.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${props.fileName || 'item'}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')
}

defineExpose({ download })
onMounted(draw)
watch(() => props.tooltip, draw, { deep: true })
</script>

<template>
  <canvas ref="canvas" class="item-tooltip-canvas" role="img" :aria-label="tooltip.lines.map((l) => l.text).join(', ')"></canvas>
</template>

<style scoped>
.item-tooltip-canvas{display:block; max-width:100%; height:auto; box-shadow:0 12px 30px -12px rgba(0,0,0,0.8);}
</style>
