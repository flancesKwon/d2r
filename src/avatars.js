// 프로필 사진: 디스코드·구글 사진 그대로 쓰거나, 사이트가 준비한 그림(직업 대표 스킬·유명 아이템) 중에서 고름
// DB(tb_profile.avatar_url)엔 'preset:키' 로 저장 - 그림 파일 주소는 배포마다 바뀌어서 키로 둠
import { ITEM_ICONS } from './itemIcons.js'

const skills = import.meta.glob('./assets/skillicons/*.webp', { eager: true, query: '?url', import: 'default' })
const skill = (name) => skills[`./assets/skillicons/${name}.webp`]

export const AVATAR_PRESETS = [
  { key: 'ama', label: '아마존', src: skill('ama_lightning_fury') },
  { key: 'ass', label: '어쌔신', src: skill('ass_lightning_sentry') },
  { key: 'bar', label: '바바리안', src: skill('bar_whirlwind') },
  { key: 'dru', label: '드루이드', src: skill('dru_tornado') },
  { key: 'nec', label: '네크로맨서', src: skill('nec_bone_spear') },
  { key: 'pal', label: '팔라딘', src: skill('pal_blessed_hammer') },
  { key: 'sor', label: '소서리스', src: skill('sor_frozen_orb') },
  { key: 'war', label: '악마술사', src: skill('war_miasma_bolt') },
  { key: 'ber', label: '베르 룬', src: ITEM_ICONS.invrber, item: true },
  { key: 'jah', label: '자 룬', src: ITEM_ICONS.invrjo, item: true },
  { key: 'anni', label: '어나이얼러스', src: ITEM_ICONS.invmss__charm, item: true },
  { key: 'torch', label: '지옥불 횃불', src: ITEM_ICONS.invtrch__charm, item: true },
  { key: 'griffon', label: '그리폰의 눈', src: ITEM_ICONS.invci3__armor, item: true },
  { key: 'tyrael', label: '티리엘의 권능', src: ITEM_ICONS.invaaru__armor, item: true },
].filter((a) => a.src)
const BY_KEY = new Map(AVATAR_PRESETS.map((a) => [a.key, a]))

export const presetValue = (key) => `preset:${key}`
export const presetOf = (value) => (typeof value === 'string' && value.startsWith('preset:') ? BY_KEY.get(value.slice(7)) || null : null)

// 화면에 쓸 그림 주소 (없거나 모르는 값이면 null -> 닉네임 첫 글자)
export function avatarSrc(value) {
  if (!value) return null
  if (value.startsWith('preset:')) return presetOf(value)?.src || null
  return /^https:\/\//.test(value) ? value : null
}
