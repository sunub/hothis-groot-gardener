#!/usr/bin/env bash
# Start Space Garden Simulator with the language model on this computer
# (macOS or Linux). On Windows, use scripts/start-with-ai.ps1.
#
#   bash scripts/start-with-ai.sh            # asks before each install or download
#   bash scripts/start-with-ai.sh --yes      # installs and downloads without asking
#   bash scripts/start-with-ai.sh --dev      # development server instead of a build
#
# What it does: checks Node.js, installs Ollama if it is missing, starts the
# Ollama server, downloads the model (about 10 GB, once), installs the npm
# packages, writes apps/web/.env.local, then builds and starts the app at
# http://localhost:3000. Without the model the game still runs and shows the
# pre-made crisis text; delete apps/web/.env.local to go back to that.

set -euo pipefail

MODEL="gemma4:e4b"
PORT="${PORT:-3000}"
OLLAMA_URL="http://127.0.0.1:11434"
ASSUME_YES=0
MODE="start"

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  echo
  echo "Options: --yes  --dev  --model NAME  --port N"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1 ;;
    --dev) MODE="dev" ;;
    --model) MODEL="${2:?--model needs a name}"; shift ;;
    --port) PORT="${2:?--port needs a number}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 2 ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/apps/web/.env.local"
OLLAMA_LOG="$ROOT/apps/web/logs/ollama-serve.log"
STARTED_OLLAMA_PID=""

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nError: %s\n' "$*" >&2; exit 1; }
confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  local answer
  read -r -p "$1 [Y/n] " answer || return 1
  case "$answer" in ""|y|Y|yes|Yes) return 0 ;; *) return 1 ;; esac
}
ollama_up() { curl -sf --max-time 3 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; }

cleanup() {
  # Stop only the Ollama server this script started.
  if [ -n "$STARTED_OLLAMA_PID" ]; then kill "$STARTED_OLLAMA_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

cd "$ROOT"
command -v curl >/dev/null 2>&1 || fail "curl is needed. Install it with your package manager and run this again."

# 1. Node.js 20.9 or later
say "Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install the LTS version from https://nodejs.org (macOS: brew install node), then run this again."
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)'; then
  fail "Node.js $(node -v) is too old; 20.9 or later is needed. Install the LTS version from https://nodejs.org."
fi
echo "Node.js $(node -v)"

# 2. Ollama
say "Checking Ollama"
if ! command -v ollama >/dev/null 2>&1; then
  case "$(uname -s)" in
    Darwin)
      if command -v brew >/dev/null 2>&1 && confirm "Ollama is not installed. Install it with Homebrew?"; then
        brew install ollama
      else
        fail "Install Ollama from https://ollama.com/download, then run this again."
      fi ;;
    Linux)
      if confirm "Ollama is not installed. Install it with the official script from ollama.com?"; then
        curl -fsSL https://ollama.com/install.sh | sh
      else
        fail "Install Ollama from https://ollama.com/download, then run this again."
      fi ;;
    *) fail "Install Ollama from https://ollama.com/download, then run this again." ;;
  esac
fi
echo "$(ollama --version 2>/dev/null | head -n 1)"

# 3. Ollama server
if ollama_up; then
  echo "Ollama server is running at $OLLAMA_URL."
else
  say "Starting the Ollama server"
  mkdir -p "$(dirname "$OLLAMA_LOG")"
  nohup ollama serve >"$OLLAMA_LOG" 2>&1 &
  STARTED_OLLAMA_PID=$!
  for _ in $(seq 1 30); do ollama_up && break; sleep 1; done
  ollama_up || fail "The Ollama server did not start. See $OLLAMA_LOG."
  echo "Started (log: $OLLAMA_LOG). It stops when this script stops."
fi

# 4. The model
say "Checking the model $MODEL"
if ollama list 2>/dev/null | awk 'NR > 1 { print $1 }' | grep -qx "$MODEL"; then
  echo "$MODEL is already downloaded."
else
  echo "$MODEL is not downloaded yet. The download is about 10 GB and happens once."
  confirm "Download it now?" || fail "The model is needed to run with the language model. Without it, run: npm install && npm run dev"
  ollama pull "$MODEL"
fi

# 5. npm packages
say "Installing npm packages"
if [ -d "$ROOT/node_modules" ]; then
  echo "Already installed."
else
  npm ci --no-audit --no-fund
fi

# 6. Settings
say "Writing settings"
if [ -f "$ENV_FILE" ] && grep -qE '^[[:space:]]*LLM_MODEL=' "$ENV_FILE"; then
  echo "Keeping the existing $ENV_FILE (it already sets LLM_MODEL)."
else
  if [ -f "$ENV_FILE" ]; then
    echo "Adding the model settings to the existing $ENV_FILE."
    printf '\n' >>"$ENV_FILE"
  fi
  cat >>"$ENV_FILE" <<EOF
# Written by scripts/start-with-ai.sh. Delete these lines to run without the model.
LLM_PROVIDER=ollama
LLM_BASE_URL=$OLLAMA_URL
LLM_MODEL=$MODEL
LLM_THINK=false
LLM_NUM_CTX=8192
LLM_KEEP_ALIVE=30m
LLM_TIMEOUT_MS=30000
EOF
  echo "Wrote $ENV_FILE."
fi

# 7. Build and start
export PORT
if [ "$MODE" = "dev" ]; then
  say "Starting the development server"
else
  say "Building the app (about a minute)"
  npm run build
  say "Starting the app"
fi
cat <<EOF

  Open http://localhost:$PORT
  The terminal shows "[llm] $MODEL is loaded" when the model is ready.
  Crisis text written by the model is labelled on the crisis screen.
  Press Ctrl+C to stop.

EOF
if [ "$MODE" = "dev" ]; then
  npm run dev
else
  npm run start
fi
