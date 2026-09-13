#!/usr/bin/env bash
# ==============================================================================
# Ralph Loop — Autonomous AI Agent Execution Harness for Bash / Git Bash
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

MAX_ITERATIONS="${1:-10}"
AGENT_CMD="${2:-claude}"
PROGRESS_FILE="$PROJECT_ROOT/progress.txt"

echo "============================================================"
echo " 🔄 KAPILA INVENTORY — RALPH AUTONOMOUS CODING LOOP (BASH)"
echo "============================================================"
echo "Project Root   : $PROJECT_ROOT"
echo "Max Iterations : $MAX_ITERATIONS"
echo "Agent Command  : $AGENT_CMD"
echo ""

if [ ! -f "$PROGRESS_FILE" ]; then
    echo "ERROR: progress.txt not found at $PROGRESS_FILE" >&2
    exit 1
fi

iteration=0

while [ "$iteration" -lt "$MAX_ITERATIONS" ]; do
    iteration=$((iteration + 1))
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] >>> Starting Ralph Iteration #$iteration of $MAX_ITERATIONS <<<"

    if grep -q "^ALL_TASKS_COMPLETED$" "$PROGRESS_FILE"; then
        echo "🎉 All tasks in progress.txt are marked COMPLETED!"
        break
    fi

    PROMPT="You are operating inside an autonomous Ralph Loop.
1. Inspect progress.txt and git log -n 5.
2. Pick the FIRST pending item under [ACTIVE_BACKLOG] marked with [ ].
3. Implement the feature or bug fix completely following rules in AGENTS.md.
4. Run verification:
   - In frontend/: npm run build
   - In backend/: npm test
5. Ensure zero errors and zero failing tests.
6. Commit your changes to git with a clear conventional commit message.
7. Update progress.txt: mark the task [x] COMPLETED with commit hash.
8. If no pending tasks remain, append 'ALL_TASKS_COMPLETED' to progress.txt.
9. Exit cleanly so the next iteration starts with fresh context."

    if command -v "$AGENT_CMD" &>/dev/null; then
        "$AGENT_CMD" -p "$PROMPT" || true
    else
        echo "Agent '$AGENT_CMD' not found in PATH. Running automated verification..."
        (cd "$PROJECT_ROOT/frontend" && npm run build)
        (cd "$PROJECT_ROOT/backend" && npm test)
        echo "Verification passed ✓"
        break
    fi

    if grep -q "^ALL_TASKS_COMPLETED$" "$PROGRESS_FILE"; then
        echo "🎉 All tasks completed! Exiting loop."
        break
    fi

    sleep 3
done

echo ""
echo "============================================================"
echo " Ralph loop session finished after $iteration iteration(s)."
echo "============================================================"
