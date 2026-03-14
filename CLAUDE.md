# Llama Lab Desktop

Electrobun-based macOS desktop app for managing AI research experiments.

## Architecture

- **Electrobun** (not Electron): BrowserWindow + WKWebView, bun backend, RPC between bun ↔ webview
- **Backend**: `src/bun/` — TypeScript running in bun (index.ts is entrypoint, agents.ts, research.ts, prompt-builder.ts, config.ts, preferences.ts)
- **Frontend**: `src/mainview/` — React + Tailwind rendered in WKWebView
- **Shared types**: `src/shared/types.ts` — RPC type definitions shared between bun and webview
- **RPC pattern**: Types in `src/shared/types.ts`, handlers in `src/bun/index.ts`, frontend calls via `rpcRequest` from `src/mainview/rpc.ts`

## Running the App

```bash
npm run start    # vite build + electrobun dev
npm run dev      # electrobun dev --watch
```

## Taking Screenshots

You can programmatically screenshot the running app:

```bash
# 1. Find the main window ID (the one that's onscreen with real dimensions)
cat > /tmp/find_window.swift << 'SWIFT'
import CoreGraphics
if let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] {
    for w in windows {
        let owner = w["kCGWindowOwnerName"] as? String ?? ""
        if owner.contains("Llama Lab") {
            let wid = w["kCGWindowNumber"] as? Int ?? 0
            let bounds = w["kCGWindowBounds"] as? [String: Any] ?? [:]
            let width = bounds["Width"] as? Double ?? 0
            let height = bounds["Height"] as? Double ?? 0
            let onscreen = w["kCGWindowIsOnscreen"] as? Bool ?? false
            print("WID=\(wid) \(Int(width))x\(Int(height)) onscreen=\(onscreen)")
        }
    }
}
SWIFT
swift /tmp/find_window.swift

# 2. Capture using the onscreen WID (the one with real dimensions like 1200x800)
screencapture -x -o -l<WID> /tmp/llamalab-screenshot.png

# 3. View it
# Use the Read tool on the .png file — Claude Code can view images natively
```

**Key gotchas:**
- `screencapture -l` needs NO space before the window ID (`-l15475`, not `-l 15475`)
- Electrobun creates multiple windows (menu bar strips etc); pick the one that's `onscreen=true` with real dimensions
- The app process name is "Llama Lab-dev" in dev mode, owner PID is the bun child process
- `-x` suppresses the screenshot sound, `-o` excludes window shadow

## Electrobun Specifics

- **Drag regions**: Electrobun does NOT use CSS `-webkit-app-region: drag`. It requires the class `.electrobun-webkit-app-region-drag` on elements.
- **Config**: `electrobun.config.ts` in project root
- **Icons**: `icon.iconset/` folder → `iconutil -c icns` → placed by build system

## Agent System

Agents are spawned in tmux sessions. Mission files (`AGENT_MISSION.md`) tell agents WHERE to find files, not what they contain. The agent reads files itself.

- Agent state: `~/.config/llamalab/agents/` (log, runs/)
- Claude CLI: `--dangerously-skip-permissions --verbose --output-format stream-json` piped through `stream-filter.py`
- Log capture: `tmux pipe-pane` writes to `~/.config/llamalab/agents/runs/{name}.log`
