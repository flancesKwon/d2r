#!/usr/bin/env bash
# 002 SQL 검사 - 빈 Postgres 16 DB 를 새로 만들어서
#   (supabase/schema.sql 이 있으면 그걸, 없으면 test/base_stub.sql) → 002 → 002 한 번 더(재실행 안전 확인) → tests_002.sql
# 사용: PGUSER=postgres bash supabase/test/run.sh   (로컬에 postgres 가 떠 있어야 함)
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/.."
DB=d2r_test_002
dropdb --if-exists "$DB" 2>/dev/null || true
createdb "$DB"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
if [ -f schema.sql ]; then
  echo "기본 스키마: schema.sql"
  "${PSQL[@]}" -c "do \$\$ begin create role anon nologin; exception when duplicate_object then null; end \$\$; do \$\$ begin create role authenticated nologin; exception when duplicate_object then null; end \$\$;" >/dev/null
  "${PSQL[@]}" -f schema.sql >/dev/null
else
  echo "기본 스키마: test/base_stub.sql (schema.sql 없음)"
  "${PSQL[@]}" -f test/base_stub.sql >/dev/null
fi
"${PSQL[@]}" -f 002_reports_suspension.sql >/dev/null
"${PSQL[@]}" -f 002_reports_suspension.sql >/dev/null
OUT=$("${PSQL[@]}" -f test/tests_002.sql)
echo "$OUT" | grep -E "^(ok|FAIL|[0-9]+건)"
dropdb "$DB"
echo "$OUT" | tail -1 | grep -q ' 0건 실패' 
