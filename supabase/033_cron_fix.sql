-- 033: 수집 cron 고침 (Supabase SQL Editor 에서 실행. 여러 번 실행해도 됨)
--  1) 'fetch-dclone-progress' 작업이 fetch-terror-zone 주소를 부르고 있어서 우버 디아 진행도가 수집되지 않았고,
--     테러존 함수가 같은 순간 두 번 불려 같은 구역 줄이 겹쳐 들어갔음 -> 우버 디아 함수 주소로 바꿈
--     (Edge Function 'fetch-dclone-progress' 가 배포돼 있어야 함 - supabase/functions/fetch-dclone-progress)
--  2) 공포의 영역은 구역이 바뀌는 정각(:00/:30) 직후 0~3분 동안만 30초 늦게 한 번 더 불러 새 구역을 빨리 받음
--     (d2runewizard 규칙: 30초보다 자주 부르지 않기). 주소·인증값은 기존 'fetch-terror-zone' 작업 것을 그대로 씀

do $$
begin
  perform cron.alter_job(
    job_id := (select jobid from cron.job where jobname = 'fetch-dclone-progress'),
    command := replace((select command from cron.job where jobname = 'fetch-dclone-progress'), 'fetch-terror-zone', 'fetch-dclone-progress')
  );
  perform cron.schedule(
    'fetch-terror-zone-boundary',
    '0-3,30-33 * * * *',
    'select pg_sleep(30); ' || (select command from cron.job where jobname = 'fetch-terror-zone')
  );
end $$;

select jobid, jobname, schedule, left(command, 160) as command from cron.job order by jobid;
