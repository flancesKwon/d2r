// 스킬·스탯 시뮬레이터 - 내 빌드 저장 (Supabase tb_saved_build, supabase/003_guides_builds.sql)
// 본인만 보고 씀(RLS), 1인 100개까지(DB가 막음). 빌드 내용은 공유 링크와 같은 코드(code) 그대로 저장
import { reactive, watch } from 'vue'
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'

export const buildsState = reactive({ list: [], loaded: false, error: '' })

function fmtDate(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const mapBuild = (r) => ({ id: r.id, name: r.name, classKey: r.class_key, level: r.level, code: r.code, date: fmtDate(r.updated_at) })

export async function loadBuilds() {
  buildsState.error = ''
  if (!supabase || !authState.user) {
    buildsState.list = []
    buildsState.loaded = false
    return
  }
  const { data, error } = await supabase.from('tb_saved_build').select('*').order('updated_at', { ascending: false })
  buildsState.loaded = true
  if (error) {
    // 003 을 아직 안 돌렸으면 표가 없음
    buildsState.error = '빌드 저장 기능을 준비 중이에요.'
    buildsState.list = []
    return
  }
  buildsState.list = data.map(mapBuild)
}
watch(() => authState.user?.id, () => loadBuilds().catch(() => {}), { immediate: true })

// 새로 저장 (id 가 있으면 그 빌드를 덮어씀)
export async function saveBuild({ id = null, name, classKey, level, code }) {
  if (!authState.user) throw new Error('로그인이 필요해요')
  const row = { name: (name || '').trim().slice(0, 60) || '이름 없는 빌드', class_key: classKey, level: Math.min(99, Math.max(1, Number(level) || 1)), code }
  const q = id
    ? supabase.from('tb_saved_build').update(row).eq('id', id).select('*')
    : supabase.from('tb_saved_build').insert({ ...row, user_id: authState.user.id }).select('*')
  const { data, error } = await q
  if (error) throw new Error(/100/.test(error.message) ? '빌드는 100개까지 저장할 수 있어요' : '빌드를 저장하지 못했어요')
  if (!data?.length) throw new Error('빌드를 저장하지 못했어요')
  const b = mapBuild(data[0])
  buildsState.list = [b, ...buildsState.list.filter((x) => x.id !== b.id)]
  return b
}

export async function renameBuild(build, name) {
  const rows = await mustReturnRows(
    supabase.from('tb_saved_build').update({ name: (name || '').trim().slice(0, 60) || build.name }).eq('id', build.id).select('*'),
    '이름을 바꾸지 못했어요'
  )
  Object.assign(build, mapBuild(rows[0]))
}

export async function deleteBuild(build) {
  await mustReturnRows(supabase.from('tb_saved_build').delete().eq('id', build.id).select('id'), '빌드를 지우지 못했어요')
  buildsState.list = buildsState.list.filter((x) => x.id !== build.id)
}
