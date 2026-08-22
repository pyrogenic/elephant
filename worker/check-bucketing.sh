#!/bin/bash
# Does a real Discogs token authenticate through the relay, and does it get its own
# rate-limit bucket?
#
# /oauth/identity is the instrument: it answers with a username only if Discogs can
# attribute the request to a user. A rate-limit *number* cannot tell you this -- invalid
# tokens are also given limit:60 -- which is why earlier attempts at this were unreadable.
#
# Reads the bare token from .token. Never prints it.
#
# Deliberately no `set -u`: if this file is ever sourced rather than executed, that
# leaks `nounset` into the interactive shell, where VS Code's shell integration then
# dies on an unset RPROMPT (`__vsc_preexec:3: RPROMPT: parameter not set`). The two
# variables that could be unset are checked explicitly instead.
set -e
# Resolve paths relative to this script rather than cd-ing. A script has no business
# moving the caller's working directory around to find its own files.
TOKEN_FILE="$(cd "$(dirname "$0")/.." && pwd)/.token"
if [ ! -s "$TOKEN_FILE" ]; then echo "$TOKEN_FILE is missing or empty — put the bare token in it."; exit 1; fi
TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
if [ -z "$TOKEN" ]; then echo "$TOKEN_FILE is empty — put the bare token in it."; exit 1; fi

W="${1:-https://elephant-proxy.pyrogenique.workers.dev}"
O="Origin: http://localhost:3000"

probe() { # label, url, token
  printf '%-28s ' "$1"
  curl -sS -m 20 -w ' [%{http_code}]' -H "$O" -H "Authorization: Discogs token=$3" "$2" 2>&1 \
    | tr -d '\r\n' | cut -c1-160
  echo
}

echo "== identity (who does Discogs think we are?) =="
probe "real, direct"   "https://api.discogs.com/oauth/identity" "$TOKEN"
probe "real, via relay" "$W/oauth/identity"                     "$TOKEN"
probe "bogus, via relay (control)" "$W/oauth/identity"          "bogusControlToken"

echo
echo "== rate-limit counters =="
counter() {
  printf '%-28s ' "$1"
  curl -sS -m 20 -o /dev/null -D - -H "$O" -H "Authorization: Discogs token=$3" "$2" 2>/dev/null \
    | tr -d '\r' | grep -iE '^HTTP/|x-discogs-ratelimit(-used|-remaining)?:' | tr '\n' ' '
  echo
}
counter "real, direct"   "https://api.discogs.com/releases/1" "$TOKEN"
counter "real, via relay" "$W/releases/1"                     "$TOKEN"
counter "bogus, via relay (control)" "$W/releases/1"          "bogusControlToken"

cat <<'EOF'

Reading it:
  real-via-relay shows your username  -> auth survives the relay
  real-via-relay 401                  -> the worker is not forwarding the credential (worker bug)
  real-via-relay 429 while bogus also -> you share the saturated IP bucket (per-IP; relay is wrong)
  real counters far from bogus ones   -> separate buckets (per-token; relay is safe)
EOF
