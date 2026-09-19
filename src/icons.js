export const ICONS = {
  sword:   '<path d="M5 19L17 7M13 7h4v4M5 19l2 2M15 5l2 2"/>',
  axe:     '<path d="M12 3v18"/><path d="M12 3c3.5 0 6.5 2 6.5 5.2 0 3-3 4.3-6.5 3.3"/>',
  mace:    '<path d="M12 21V9"/><circle cx="12" cy="6.5" r="3.5"/>',
  dagger:  '<path d="M12 3v12M9 6h6M9 17l3 4 3-4"/>',
  spear:   '<path d="M12 21V5M8 8l4-4 4 4"/>',
  polearm: '<path d="M12 21V5M7 9l5-4 5 4M7 9h10"/>',
  bow:     '<path d="M7 4a12 12 0 000 16M7 4l10 8-10 8"/>',
  staff:   '<circle cx="12" cy="5" r="2.6"/><path d="M12 7.6V21"/>',
  armor:   '<path d="M6 4l6-2 6 2v8c0 5-3 8-6 10-3-2-6-5-6-10V4z"/>',
  shield:  '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/>',
  helm:    '<path d="M4 14a8 8 0 0116 0v2H4v-2z"/><path d="M9 16v3M15 16v3"/>',
  gloves:  '<path d="M8 21V11a4 4 0 118 0v10M8 21h8"/>',
  boots:   '<path d="M9 3v10l-5 4v3h11v-6h3v-3h-5V3H9z"/>',
  belt:    '<rect x="3" y="10" width="18" height="4" rx="1"/><circle cx="12" cy="12" r="1.4"/>',
  ring:    '<circle cx="12" cy="14" r="5"/><path d="M9 9l3-6 3 6"/>',
  amulet:  '<path d="M8 3h8l-2 5h-4L8 3z"/><circle cx="12" cy="15" r="5"/>',
  charm:   '<path d="M12 3c4 4 7 7 7 11a7 7 0 11-14 0c0-4 3-7 7-11z"/>',
  gem:     '<path d="M6 9l6-6 6 6-6 12-6-12z"/><path d="M6 9h12"/>',
  rune:    '<path d="M12 3v18M7 8l10 8M17 8L7 16"/>',
  runeword:'<rect x="3" y="10" width="5" height="5"/><rect x="9.5" y="10" width="5" height="5"/><rect x="16" y="10" width="5" height="5"/>',
  unknown: '<circle cx="12" cy="12" r="8"/>'
};

// 스킬 노드 아이콘 (원작 아이콘이 아닌 사이트 자체 제작 심볼 — 속성/역할별 구분용)
export const SKILL_ICONS = {
  fire:       '<path d="M12 2c-2 4-5 6-5 10a5 5 0 0010 0c0-1.5-.7-2.6-1.3-3.3.2 1.3-.5 2-1.4 2-.9 0-1.3-.7-1.3-1.6 0-1.6.8-3 0-6.1-.4.3-.7.6-1 1z"/>',
  cold:       '<path d="M12 2v20M4.5 6.5l15 11M4.5 17.5l15-11"/>',
  ltng:       '<path d="M13 2L5 14h6l-2 8 9-13h-6l1-7z"/>',
  pois:       '<path d="M12 3c4 4 7 7 7 11a7 7 0 11-14 0c0-4 3-7 7-11z"/>',
  mag:        '<path d="M6 9l6-6 6 6-6 12-6-12z"/><path d="M6 9h12"/>',
  phy:        '<path d="M5 19L17 7M13 7h4v4M5 19l2 2M15 5l2 2"/>',
  aura:       '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/>',
  warcry:     '<path d="M3 10v4h4l6 4V6l-6 4H3z"/><path d="M17 9a4 4 0 010 6"/><path d="M19.5 7a7 7 0 010 10"/>',
  curse:      '<circle cx="12" cy="10" r="6"/><circle cx="9.5" cy="9.2" r="1.1"/><circle cx="14.5" cy="9.2" r="1.1"/><path d="M9 16v3M15 16v3"/>',
  summon:     '<circle cx="12" cy="15" r="4.5"/><circle cx="6.5" cy="8" r="2"/><circle cx="17.5" cy="8" r="2"/><circle cx="12" cy="5.5" r="2"/>',
  mastery:    '<path d="M12 3v18M7 8l10 8M17 8L7 16"/>',
  shapeshift: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
  passive:    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>',
}

export const CLASS_ICONS = {
  amazon:   '<path d="M7 4a12 12 0 000 16M7 4l10 8-10 8"/>',
  sorc:     '<circle cx="12" cy="5" r="2.6"/><path d="M12 7.6V21"/>',
  necro:    '<path d="M12 3v18M7 8l10 8M17 8L7 16"/>',
  paladin:  '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/>',
  barb:     '<path d="M12 21V9"/><circle cx="12" cy="6.5" r="3.5"/>',
  druid:    '<path d="M12 3c4 4 7 7 7 11a7 7 0 11-14 0c0-4 3-7 7-11z"/>',
  assassin: '<path d="M12 3v12M9 6h6M9 17l3 4 3-4"/>',
  warlock:  '<path d="M6 9l6-6 6 6-6 12-6-12z"/><path d="M6 9h12"/>'
};
