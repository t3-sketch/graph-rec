# Agent Instructions

Before substantial work:

1. Read `PLAN.md`, including its execution mode and the linked Research master plan when the task crosses projects.
2. Read `.codex/IMPLEMENTATION_STATE.md` for current implementation state. Reuse this file; do not create a duplicate `docs/PROJECT_STATE.md`.
3. Follow the accepted plan. Astra is the architect; Sol is the implementer. Cursor and other implementation agents follow the same boundary.
4. Do not redesign unless technically blocked. Report evidence, impact, and the smallest alternative to the architect. Update the master plan before complex architectural implementation.
5. If PLAN says `PLANNING_ONLY`, do not modify implementation files. A user instruction to begin implementation enables only its stated scope; record that scope in PLAN.
6. Read only files necessary for the current task. Do not broadly scan the repository or create subagents without an explicit request.
7. After implementation and verification, and before interruption, update `.codex/IMPLEMENTATION_STATE.md` with completed changes, actual checks, remaining limits, and the next action. Update PLAN when its phase or authorization changes.

Canonical checkout is `/Users/macuser/dev/graph-rec`, recovered with user approval. The old Documents checkout and cache are preserved backups, not editing targets. Phase 4 and its review fixes are implemented; verify the recovered checkout before final acceptance. Read `docs/phase4-implementation.md` and `docs/research-export-v0.2.md`; retain the 0.1 contract. The 2026-09-14 PLAN section authorizes Sol to publish the free Public HF Static demo at `t3-sketch/sonder` and the scoped Engineering GitHub update. Phase 5 and paid services remain excluded. Preserve existing framework instructions below.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
