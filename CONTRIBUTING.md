# Contributing to Llama Lab

We welcome contributions! Whether it's bug fixes, new features, documentation, or ideas — all help is appreciated.

## Getting Set Up

```bash
git clone https://github.com/kortexa-ai/llamalab.desktop.git
cd llamalab.desktop
bun install
./run.sh hmr
```

This starts Vite (HMR) + Electrobun. Edit React components and see changes instantly.

Requires [Bun](https://bun.sh) and [Electrobun](https://electrobun.dev) (macOS only for now).

## Project Layout

- `src/bun/` — Backend modules (Bun process). Filesystem access, git, terminals, agents.
- `src/mainview/` — Frontend (React). Components, hooks, styles.
- `src/shared/types.ts` — RPC type definitions shared between backend and frontend.

All backend/frontend communication goes through typed RPC defined in `types.ts`. If you add a new feature that needs data from the backend, add the RPC type there first.

## How to Contribute

1. **Open an issue** describing what you want to work on. This avoids duplicate effort and lets us give early feedback.
2. **Fork and branch** from `main`.
3. **Keep changes focused.** One feature or fix per PR. Small PRs get reviewed faster.
4. **Test your changes.** Run the app, click around, make sure nothing broke.
5. **Submit a PR** with a clear description of what changed and why.

## Code Style

- TypeScript throughout. Tab indentation in backend, consistent with existing files.
- React components use functional style with hooks.
- Tailwind for styling — no CSS modules or styled-components.
- Keep it simple. We'd rather have 3 clear lines than 1 clever abstraction.

## Good First Issues

Look for issues tagged `good first issue`. Some areas that always need help:

- UI polish and accessibility
- Keyboard shortcuts
- New chart types or visualization improvements
- Better syntax highlighting in the file editor
- Linux/Windows support (currently macOS only via Electrobun)

## Questions?

Open an issue or start a discussion. We're friendly.

---

Thanks for helping make Llama Lab better.
