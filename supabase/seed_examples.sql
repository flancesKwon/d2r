-- ============================================================
--  예시 글 넣기 (커뮤니티 카테고리마다 1개 + 거래 카테고리마다 1개)
--  작성자: 최고관리자(admin) 계정. 제목·본문에 [예시] 표시
--  적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run (006 을 먼저 실행해야 건의·버그제보 글이 들어감)
--  지우기: 맨 아래 "예시 글 지우기" 두 줄만 따로 실행
-- ============================================================
do $$
declare
  me uuid := (select id from public.tb_profile where role = 'admin' order by created_at limit 1);
  qid bigint;
begin
  if me is null then raise exception '최고관리자 계정이 없음'; end if;
  if exists (select 1 from public.tb_community_post where title like '[예시]%') then
    raise notice '이미 들어가 있음 - 건너뜀';
    return;
  end if;

  -- 커뮤니티
  insert into public.tb_community_post (author_id, category, title, content, tags) values
    (me, '질문', '[예시] 파벽 소서 레벨링, 노멀 바알까지 뭐 찍어요?',
     E'[예시 글]\n\n처음 키워봐서요. 노멀은 화염탄만 올려도 되나요? 블리자드로 언제 갈아타는 게 좋을까요?', array['소서리스', '레벨링']),
    (me, '거래', '[예시] 레더 시즌 15 베르 시세 어느 정도인가요',
     E'[예시 글]\n\n요즘 베르 하나에 이스트 몇 개 정도로 거래되는지 궁금합니다. 아이템별 거래내역 메뉴도 참고 중이에요.', array['시세']),
    (me, '잡담', '[예시] 오늘 카우방에서 자 룬 떴습니다',
     E'[예시 글]\n\n헬 카우 돌다가 자 룬 드랍! 시즌 시작하고 첫 하이룬이라 기분 좋네요.', array['드랍']),
    (me, '공략', '[예시] 공포의 영역 전령 3단계 빠르게 올리는 법',
     E'[예시 글]\n\n## 요약\n- 공포의 영역에서 몬스터를 잡으면 전령이 나타남\n- 3단계 이상부터 레어 이상 드롭 증가 (3.3 패치)\n\n## 팁\n1. 광역 빌드로 몬스터 밀도 높은 곳 위주\n2. 전령 등장 전 번개 폭풍 예고 확인', array['공포의 영역', '전령']),
    (me, '건의', '[예시] 거래게시판에 가격 정렬 기능 있으면 좋겠어요',
     E'[예시 글]\n\n같은 아이템 판매글이 많아지면 희망 가격 기준으로 정렬하고 싶습니다.', array['거래게시판']),
    (me, '버그제보', '[예시] 모바일에서 거래방 메시지 입력창이 가려져요',
     E'[예시 글]\n\n**어느 화면**: 거래중인 품목\n\n**무슨 일**: 키보드가 올라오면 입력창이 가려짐\n\n**어떻게 하면 생기는지**:\n1. 폰으로 거래방 열기\n2. 메시지 입력칸 누르기\n\n**기기·브라우저**: 아이폰 사파리', array['모바일'])
  ;
  select id into qid from public.tb_community_post where title = '[예시] 파벽 소서 레벨링, 노멀 바알까지 뭐 찍어요?';
  insert into public.tb_community_comment (post_id, author_id, content)
    values (qid, me, E'[예시 댓글]\n노멀은 화염탄 → 레벨 24쯤 블리자드 찍고 넘어가면 편해요.');

  -- 거래 (options: 옵션 줄·품질·아이콘·흥정 가능)
  insert into public.tb_trade_post (author_id, category, item_id, item_name, amount_label, options, ethereal, price, realm, ladder, hardcore, content, status, updated_at) values
    (me, '룬', 'g64', '베르 룬', '1개', '{"lines":[],"quality":"","iconKey":null,"negotiable":true}', false,
     '이스트 룬 3개', '아시아', '레더', '일반', '[예시 판매글] 흥정 가능, 쪽지 주세요.', '판매중', now()),
    (me, '퍼펙트 보석', 'g4', '최상급 자수정', '10개', '{"lines":[],"quality":"","iconKey":null,"negotiable":false}', false,
     '우움 룬 1개', '아시아', '레더', '일반', '[예시 판매글] 소켓 뚫기용으로 모아둔 것 일괄.', '판매중', now()),
    (me, '우버보스 재료', 'uber-key-terror', '공포의 열쇠', '3개', '{"lines":[],"quality":"","iconKey":"invmph__key","negotiable":false}', false,
     '오움 룬 1개', '아시아', '레더', '일반', '[예시 판매글] 공포의 열쇠 3개 묶음.', '판매중', now()),
    (me, '정수·징표', 'uber-essence-suffering', '고통의 일그러진 정수', '2개', '{"lines":[],"quality":"","iconKey":"invtes__uber","negotiable":true}', false,
     '말 룬 1개', '아시아', '레더', '일반', '[예시 판매글] 면죄의 징표 재료.', '판매중', now()),
    (me, '유니크/세트', 'u248', '할리퀸 관모', '', '{"lines":["모든 기술 +2","마법 아이템 발견 확률 50% 증가","받는 물리 피해 10% 감소"],"quality":"unique","iconKey":null,"negotiable":false}', false,
     '우움 룬 1개 + 말 룬 1개', '아시아', '레더', '일반', '[예시 판매글] 피해 감소 10% 짜리.', '예약중', now()),
    (me, '룬워드', 'r20', '수수께끼', '', '{"lines":["베이스: 아칸 플레이트","방어력 775","모든 기술 +2","달리기/걷기 속도 +45%","캐릭터 레벨당 힘 +0.75","순간이동 +1"],"quality":"","iconKey":null,"negotiable":true}', false,
     '자 룬 1개 + 베르 룬 1개', '아시아', '레더', '일반', '[예시 판매글] 방어력 높은 베이스.', '판매중', now()),
    (me, '매직/레어/일반', null, '레어 반지', '', '{"lines":["시전 속도 +10%","힘 +12","민첩 +9","적중당 마나 5% 훔침","번개 저항 +22%"],"quality":"rare","iconKey":"invrin1__ring","negotiable":true}', false,
     '이스트 룬 2개', '아시아', '레더', '일반', '[예시 판매글] 패캐 10 힘민 반지.', '판매중', now()),
    (me, '기타', null, '큐브 재료 일괄 (최상급 해골 6개)', '6개', '{"lines":[],"quality":"","iconKey":null,"negotiable":false}', false,
     '팔 룬 1개', '아시아', '논레더', '일반', '[예시 판매글] 레어 다시 굴리기용.', '판매중', now()),
    -- 아이템별 거래내역에 "거래완료"가 보이게 하나는 팔린 상태로
    (me, '룬', 'g64', '베르 룬', '1개', '{"lines":[],"quality":"","iconKey":null,"negotiable":false}', false,
     '이스트 룬 3개 + 말 룬 1개', '아시아', '레더', '일반', '[예시 판매글] 거래완료된 글.', '거래완료', now());
end $$;

-- 예시 글 지우기 (필요할 때 이 두 줄만 실행)
-- delete from public.tb_community_post where title like '[예시]%';
-- delete from public.tb_trade_post where content like '[예시 판매글]%';
