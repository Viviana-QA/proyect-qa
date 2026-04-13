#!/bin/bash
# Helper script to query Supabase REST API
# Usage: ./scripts/supabase-query.sh <table> [query_params]
# Example: ./scripts/supabase-query.sh projects
# Example: ./scripts/supabase-query.sh test_cases "select=id,title&limit=5"

SB_URL="https://tsnqqmsrydsfuaezkfkr.supabase.co"
SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbnFxbXNyeWRzZnVhZXprZmtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc2MDQ1OSwiZXhwIjoyMDkxMzM2NDU5fQ.crH9oUdSK4wfx8WEV0PCOaFW_igrGtWry_x_zP5QdnE"

TABLE=$1
PARAMS=${2:-"select=*&limit=10"}

if [ -z "$TABLE" ]; then
  echo "Usage: $0 <table> [query_params]"
  echo "Tables: projects test_suites test_cases test_runs test_results reports jira_configs artifacts"
  exit 1
fi

curl -s "$SB_URL/rest/v1/$TABLE?$PARAMS" \
  -H "apikey: $SB_KEY" \
  -H "Authorization: Bearer $SB_KEY" \
  -H "Content-Type: application/json" | python3 -m json.tool
