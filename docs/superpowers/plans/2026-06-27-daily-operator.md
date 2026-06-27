# Daily Operator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily wellness operator workflow to `delx-wellness-openclaw` so OpenClaw users can run a useful daily brief immediately after setup.

**Architecture:** Add one skill and one workspace template, then expose them through a small CLI helper. Reuse the existing installer/template-copy path and keep the workflow text-only, local-first, and safe for npm packaging.

**Tech Stack:** TypeScript, Node.js CLI, OpenClaw skill markdown, npm package packaging, `node:test`.

---

### Task 1: Add Operator Artifacts

**Files:**
- Create: `skills/delx-wellness-daily-operator/SKILL.md`
- Create: `templates/DAILY_OPERATOR.md`
- Modify: `src/paths.ts`
- Modify: `src/install.ts`

- [ ] Add the new skill markdown with strict tool order, fallback behavior, output shape, and safety rules.
- [ ] Add the workspace template with a copyable daily operator prompt and Telegram/terminal variants.
- [ ] Expand the template path type in `src/paths.ts` to include `DAILY_OPERATOR.md`.
- [ ] Update the installer template loop to copy `DAILY_OPERATOR.md`.

### Task 2: Add CLI Operator Command

**Files:**
- Create: `src/operator.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`

- [ ] Implement `formatDailyOperatorPrompt()` and `createDailyOperatorFile()`.
- [ ] Add `delx-wellness-openclaw operator [--profile delx-wellness] [--write] [--prompt-only]`.
- [ ] Print the prompt, the OpenClaw command, and the destination path when writing.
- [ ] Export the operator helpers from `src/index.ts`.

### Task 3: Tests and Docs

**Files:**
- Modify: `tests/openclaw-profile.test.ts`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Test installer copies `DAILY_OPERATOR.md` and the new skill.
- [ ] Test the operator helper writes/prints the prompt and does not include secrets.
- [ ] Update README Quick Start, "Why use it", and validation docs to make Daily Operator the first real workflow.
- [ ] Bump package version to `0.2.0`.

### Task 4: Release Verification

**Commands:**
- `npm test`
- `npm pack --dry-run`
- `npm publish`
- `git tag v0.2.0`
- `git push && git push origin v0.2.0`

- [ ] Verify all local tests pass.
- [ ] Verify the npm tarball includes the new skill/template and no private data.
- [ ] Publish `delx-wellness-openclaw@0.2.0`.
- [ ] Create a GitHub release for `v0.2.0`.
- [ ] Update the `delx-wellness` registry npm version for the OpenClaw profile and run hub validators.
