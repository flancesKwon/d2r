// 빌드 가이드 - Supabase tb_guide (supabase/003_guides_builds.sql)
// 누구나 읽고, 운영진(moderator)·최고관리자(admin)만 쓰고 고치고 지움 (RLS가 막음, 화면은 버튼만 숨김)
// 003 을 아직 안 돌렸거나 DB에 못 붙으면 사이트에 들어 있던 가이드(guides.json)를 그대로 보여줌
import { reactive, computed } from 'vue'
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'
import bundledGuides from './data/guides.json'

export const GUIDE_CLASSES = [
  { key: 'amazon', name: '아마존' }, { key: 'sorc', name: '소서리스' }, { key: 'necro', name: '네크로맨서' },
  { key: 'paladin', name: '팔라딘' }, { key: 'barb', name: '바바리안' }, { key: 'druid', name: '드루이드' },
  { key: 'assassin', name: '어쌔신' }, { key: 'warlock', name: '악마술사' },
]
export const GUIDE_TIERS = ['S TIER', 'A TIER', 'B TIER', 'C TIER']

export const guidesState = reactive({ list: bundledGuides, loaded: false, fromDb: false })

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const arr = (v) => (Array.isArray(v) ? v : [])

// DB 한 줄 -> 화면에서 쓰던 guides.json 모양 그대로 (id = 주소에 쓰는 slug)
function mapGuide(r) {
  return {
    id: r.slug,
    dbId: r.id,
    classKey: r.class_key,
    className: r.class_name,
    title: r.title,
    tier: r.tier || '',
    desc: r.description || '',
    // 작성일 (updated_at 은 DB가 넣을 때 now 로 채워서, 옮겨 온 가이드도 전부 오늘이 됨)
    date: fmtDate(r.created_at),
    summary: r.summary || '',
    statPriority: r.stat_priority || '',
    skillOrder: arr(r.skill_order),
    keyItems: arr(r.key_items),
    levelingNotes: arr(r.leveling_notes),
    strengths: arr(r.strengths),
    weaknesses: arr(r.weaknesses),
    published: r.published,
  }
}

// 화면에 들어올 때마다 불러도 됨 - 1분 안에 받았으면 그대로 (새 가이드가 새로고침 없이 보이게)
let guidesAt = 0
export async function loadGuides(force = false) {
  if (!supabase || (guidesState.loaded && !force && Date.now() - guidesAt < 60000)) return
  guidesAt = Date.now()
  const { data, error } = await supabase.from('tb_guide').select('*').order('created_at', { ascending: false })
  guidesState.loaded = true
  // 표가 없거나(003 전) 비어 있으면 사이트에 들어 있던 가이드 그대로
  if (error || !data?.length) return
  guidesState.list = data.map(mapGuide)
  guidesState.fromDb = true
}

export function getGuide(slug) {
  return guidesState.list.find((g) => g.id === slug) || null
}

// 운영진 이상 + DB에 가이드 표가 있을 때만 쓰기 버튼
export const canEditGuides = computed(() => guidesState.fromDb && ['moderator', 'admin'].includes(authState.profile?.role))

function toRow(g) {
  const cls = GUIDE_CLASSES.find((c) => c.key === g.classKey)
  const lines = (v) => arr(v).map((s) => String(s).trim()).filter(Boolean)
  return {
    class_key: g.classKey,
    class_name: cls?.name || g.className || '',
    title: g.title.trim(),
    tier: g.tier || null,
    description: g.desc?.trim() || null,
    summary: g.summary?.trim() || null,
    stat_priority: g.statPriority?.trim() || null,
    skill_order: arr(g.skillOrder).map((s) => ({ level: String(s.level || '').trim(), skill: String(s.skill || '').trim() })).filter((s) => s.level || s.skill),
    key_items: lines(g.keyItems),
    leveling_notes: lines(g.levelingNotes),
    strengths: lines(g.strengths),
    weaknesses: lines(g.weaknesses),
    published: g.published !== false,
  }
}

// 새 가이드 주소: g-<직업>-<시각> (영문·숫자만 - DB가 검사함)
const newSlug = (classKey) => `g-${classKey}-${Date.now().toString(36)}`

export async function saveGuide(g) {
  if (!authState.user) throw new Error('로그인 필요')
  if (!g.title?.trim()) throw new Error('제목 입력')
  const row = toRow(g)
  let saved
  if (g.dbId) {
    saved = await mustReturnRows(supabase.from('tb_guide').update(row).eq('id', g.dbId).select('*'), '가이드 수정 권한 없음')
  } else {
    saved = await mustReturnRows(
      supabase.from('tb_guide').insert({ ...row, slug: newSlug(g.classKey), author_id: authState.user.id }).select('*'),
      '가이드 작성 권한 없음'
    )
  }
  const guide = mapGuide(saved[0])
  const i = guidesState.list.findIndex((x) => x.dbId === guide.dbId)
  if (i >= 0) guidesState.list[i] = guide
  else guidesState.list.unshift(guide)
  return guide
}

export async function deleteGuide(g) {
  if (!authState.user) throw new Error('로그인 필요')
  await mustReturnRows(supabase.from('tb_guide').delete().eq('id', g.dbId).select('id'), '가이드 삭제 권한 없음')
  guidesState.list = guidesState.list.filter((x) => x.dbId !== g.dbId)
}
