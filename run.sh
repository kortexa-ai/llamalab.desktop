#!/bin/bash
# Llama Lab — run script
# Usage: ./run.sh [dev|hmr|build|clean]
#   dev   — quick dev (electrobun watch, no HMR)
#   hmr   — full dev with Vite HMR (default)
#   build — production build (canary)
#   clean — nuke dist/ and node_modules/.vite

set -e
cd "$(dirname "$0")"

# Install deps if needed
[ -d node_modules ] || bun install

case "${1:-hmr}" in
    dev)
        echo "→ vite build + electrobun dev --watch"
        bun run start
        ;;
    hmr)
        echo "→ vite HMR + electrobun dev (hot reload)"
        bun run dev:hmr
        ;;
    build)
        echo "→ production build (canary)"
        bun run build:canary
        ;;
    clean)
        echo "→ cleaning build artifacts"
        rm -rf dist node_modules/.vite
        echo "done"
        ;;
    *)
        echo "Usage: ./run.sh [dev|hmr|build|clean]"
        echo "  dev   — vite build + electrobun watch"
        echo "  hmr   — vite HMR + electrobun (default)"
        echo "  build — production canary build"
        echo "  clean — nuke caches"
        exit 1
        ;;
esac
