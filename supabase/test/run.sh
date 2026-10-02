#!/usr/bin/env bash
# SQL 검사 - 묶음마다 빈 Postgres DB 를 새로 만들어서
#   (supabase/schema.sql 이 있으면 그걸, 없으면 test/base_stub.sql) → SQL 파일들(각각 두 번 = 재실행 안전 확인) → 검사 파일
# 사용: PGUSER=postgres bash supabase/test/run.sh   (로컬이나 CI 에 postgres 가 떠 있어야 함)
# 003~008 검사(tests_003~008)는 실제 schema.sql 이 있어야 해서 여기선 안 돌림
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/.."

FAILED=0
suite() {
  local name="$1" tests="$2"; shift 2
  local db="d2r_test_$name"
  dropdb --if-exists "$db" 2>/dev/null || true
  createdb "$db"
  local psql=(psql -X -q -v ON_ERROR_STOP=1 -d "$db")
  if [ -f schema.sql ]; then
    "${psql[@]}" -c "do \$\$ begin create role anon nologin; exception when duplicate_object then null; end \$\$; do \$\$ begin create role authenticated nologin; exception when duplicate_object then null; end \$\$;" >/dev/null
    "${psql[@]}" -f schema.sql >/dev/null
  else
    "${psql[@]}" -f test/base_stub.sql >/dev/null
  fi
  for f in "$@"; do
    "${psql[@]}" -f "$f" >/dev/null
    "${psql[@]}" -f "$f" >/dev/null
  done
  local out
  out=$("${psql[@]}" -f "$tests")
  echo "── $name ($([ -f schema.sql ] && echo schema.sql || echo base_stub.sql))"
  echo "$out" | grep -E "^(FAIL|[0-9]+건)" || true
  dropdb "$db"
  echo "$out" | tail -1 | grep -q ' 0건 실패' || FAILED=1
}

suite 002 test/tests_002.sql 002_reports_suspension.sql
suite 009_010 test/tests_009_010.sql 002_reports_suspension.sql 009_report_alert_login_log.sql 010_community_images.sql

exit $FAILED
