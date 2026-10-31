// 패치노트 = 코드에 있는 목록(data/patchNotes.json) + 운영진이 /admin/patch 에서 올린 글(tb_patch_note)
// 코드 쪽 글은 한국어 원문을 t() 로 번역, DB 글은 영어 칸이 있으면 영어 화면에서 그걸 씀
import { ref, computed } from 'vue'
import { supabase } from './supabase.js'
import { locale, t } from './i18n.js'
import staticNotes from './data/patchNotes.json'

const dbNotes = ref([])
let loading = null

export function fetchDbPatchNotes() {
  loading ||= supabase.from('tb_patch_note').select('*').order('note_date', { ascending: false }).limit(200).then(({ data, error }) => {
    if (error) throw error
    dbNotes.value = data
  })
  return loading
}

export async function reloadDbPatchNotes() {
  loading = null
  await fetchDbPatchNotes()
}

const pick = (ko, en) => (locale.value === 'en' && en ? en : ko)

function fromDb(n) {
  return {
    id: `db${n.id}`,
    version: n.version,
    date: n.note_date,
    tags: n.tags.map((x) => t(x)),
    title: pick(n.title, n.title_en),
    summary: pick(n.summary, n.summary_en),
    sections: n.sections.map((s) => ({ heading: pick(s.heading, s.heading_en), items: s.items.map((i) => pick(i.ko, i.en)) })),
  }
}

const fromStatic = (n) => ({
  id: n.id, version: n.version, date: n.date, tags: n.tags.map((x) => t(x)), title: t(n.title), summary: t(n.summary),
  sections: n.sections.map((s) => ({ heading: t(s.heading), items: s.items.map((i) => t(i)) })),
})

// 최신순 (날짜가 같으면 DB 글이 위)
export const patchNotes = computed(() => {
  return [...dbNotes.value.map(fromDb), ...staticNotes.map(fromStatic)].sort((a, b) => b.date.localeCompare(a.date))
})
export { dbNotes }
