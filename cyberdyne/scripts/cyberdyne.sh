#!/usr/bin/env bash
# CYBERDYNE agent helper — thin curl wrapper over the live platform REST API.
#
#   cyberdyne.sh onboard [...]                       one-time wallet + cyb_ key (delegates to npx)
#   cyberdyne.sh post --title "..." --reward N [...] post + sign + fund a bounty (delegates to npx)
#   cyberdyne.sh tasks                               list your posted tasks
#   cyberdyne.sh task <task_id>                      full task state (submissions, escrow)
#   cyberdyne.sh pending <task_id>                   only the pending submissions
#   cyberdyne.sh review <submission_id> approve|reject [--score 1-5] [--comment "..."] [--reason "..."]
#   cyberdyne.sh close <task_id>                     refund the unfilled budget, stop submissions
#   cyberdyne.sh categories                          valid task categories
#
# Auth: CYBERDYNE_IDENTITY_TOKEN env, or ~/.cyberdyne/config.json written by onboard/login.
# API:  CYBERDYNE_API_URL (default https://app.cyberdyne-os.xyz)
set -euo pipefail

API="${CYBERDYNE_API_URL:-https://app.cyberdyne-os.xyz}"
API="${API%/}"
CONFIG="$HOME/.cyberdyne/config.json"

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: '$1' is required" >&2; exit 1; }; }
need curl; need jq

key() {
  local k="${CYBERDYNE_IDENTITY_TOKEN:-}"
  if [ -z "$k" ] && [ -f "$CONFIG" ]; then
    k="$(jq -r '.identity_token // empty' "$CONFIG" 2>/dev/null || true)"
  fi
  if [ -z "$k" ]; then
    echo "error: no cyb_ key. Run:  npx -y cyberdyne-mcp onboard   (or set CYBERDYNE_IDENTITY_TOKEN)" >&2
    exit 1
  fi
  printf '%s' "$k"
}

# api METHOD PATH [JSON_BODY] — prints the JSON response; non-2xx exits 1 with the error code.
api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method" "$API$path" -H "Authorization: Bearer $(key)" -H "Accept: application/json")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  local out http
  out="$(curl "${args[@]}" -w $'\n%{http_code}')"
  http="${out##*$'\n'}"
  out="${out%$'\n'*}"
  if [ "${http:0:1}" != "2" ]; then
    echo "error: $method $path -> HTTP $http $(printf '%s' "$out" | jq -r '.error // empty' 2>/dev/null)" >&2
    printf '%s\n' "$out" | jq . 2>/dev/null >&2 || printf '%s\n' "$out" >&2
    exit 1
  fi
  printf '%s\n' "$out" | jq .
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  onboard|post|login)
    # signing/bootstrap paths live in the gateway CLI — delegate verbatim
    need npx
    exec npx -y cyberdyne-mcp "$cmd" "$@"
    ;;

  tasks)
    api GET "/api/tasks?mine=posted&limit=50"
    ;;

  task)
    [ $# -ge 1 ] || { echo "usage: cyberdyne.sh task <task_id>" >&2; exit 1; }
    api GET "/api/tasks/$1"
    ;;

  pending)
    [ $# -ge 1 ] || { echo "usage: cyberdyne.sh pending <task_id>" >&2; exit 1; }
    # capture first (no pipeline) so an api() failure propagates instead of jq
    # masking it; tolerate either { submissions: [...] } or { task: { submissions: [...] } }
    out="$(api GET "/api/tasks/$1")"
    printf '%s\n' "$out" | jq '[(.submissions // .task.submissions // [])[] | select(.status == "pending")]'
    ;;

  review)
    [ $# -ge 2 ] || { echo "usage: cyberdyne.sh review <submission_id> approve|reject [--score n] [--comment s] [--reason s]" >&2; exit 1; }
    sid="$1"; verdict="$2"; shift 2
    case "$verdict" in
      approve) approve=true ;;
      reject)  approve=false ;;
      *) echo "error: verdict must be 'approve' or 'reject'" >&2; exit 1 ;;
    esac
    score=""; comment=""; reason=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --score)   score="$2"; shift 2 ;;
        --comment) comment="$2"; shift 2 ;;
        --reason)  reason="$2"; shift 2 ;;
        *) echo "error: unknown flag $1" >&2; exit 1 ;;
      esac
    done
    body="$(jq -n --argjson approve "$approve" \
      --arg score "$score" --arg comment "$comment" --arg reason "$reason" '
      {approve: $approve}
      + (if $score   != "" then {score: ($score | tonumber)} else {} end)
      + (if $comment != "" then {comment: $comment}          else {} end)
      + (if $reason  != "" then {reject_reason: $reason}     else {} end)')"
    api POST "/api/submissions/$sid/review" "$body"
    ;;

  close)
    [ $# -ge 1 ] || { echo "usage: cyberdyne.sh close <task_id>" >&2; exit 1; }
    api POST "/api/tasks/$1/close"
    ;;

  categories)
    cat <<'EOF'
groundtruth  Verify, photograph & ground-truth the real world on location
capture      Capture real audio, video, image & sensor data
agenteval    Rate AI-agent runs, tool calls, red-team & safety
expert       Domain experts review, grade & write hard reasoning data
demo         Show the AI how — record step-by-step demonstrations
data         Quick labeling, preference & transcription microtasks
social       On-platform social actions: follow, retweet, reply, quote, original post
EOF
    ;;

  *)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
