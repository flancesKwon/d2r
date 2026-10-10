// 접속자 세기 - Realtime 채널이 주는 목록에서 회원(uid)·비회원(guest) 을 나눠 셈
// (같은 사람이 탭을 여러 개 열어도 한 명. presence.js 에서 쓰고, 혼자 검사할 수 있게 따로 둠)
export function countPresence(state) {
  const online = new Set()
  const guests = new Set()
  for (const metas of Object.values(state || {})) {
    for (const m of metas || []) {
      if (m?.uid) online.add(m.uid)
      else if (m?.guest) guests.add(m.guest)
    }
  }
  return { online, guests: guests.size }
}
