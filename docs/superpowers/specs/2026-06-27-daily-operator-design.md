# Delx Wellness Operator for OpenClaw Design

## Goal

Turn `delx-wellness-openclaw` from a setup/profile pack into a daily wellness operator that a real OpenClaw user can run immediately after setup.

## Product Shape

The first shipped version is a "Daily Operator" recipe:

- A new OpenClaw skill, `delx-wellness-daily-operator`.
- A workspace template, `DAILY_OPERATOR.md`, copied during install/setup.
- A CLI command, `delx-wellness-openclaw operator`, that prints the daily operator prompt and the exact OpenClaw command to run it.
- README and setup next steps that point users to the daily operator as the first useful workflow after onboarding.

## Behavior

The operator must produce a concise daily plan:

1. Check setup/data availability first.
2. Prefer `delx-living-body` when available because it composes multiple connectors.
3. Fall back to direct connector/status tools when the unified surface is unavailable.
4. Use `wellness-nourish` as the immediate no-OAuth value path.
5. Return one recommendation, evidence bullets, one nutrition action, one training/recovery action, and a missing-setup checklist.

## Safety and Privacy

- The operator never asks for OAuth tokens, passwords, cookies, API keys, or refresh tokens in chat.
- It must cite stale/missing data instead of inventing health context.
- It must avoid diagnosis, prescription, extreme dieting, dehydration, unsafe supplementation, or training through concerning symptoms.
- It must recommend professional care for high-risk symptoms, injuries, medication conflicts, disordered eating signals, or abnormal readings.

## Packaging

The skill and template must be included in npm package output through the existing `files` entries for `skills` and `templates`. The installer must copy `DAILY_OPERATOR.md` into the OpenClaw workspace next to `SOUL.md`, `AGENTS.md`, and `ONBOARDING.md`.

## Verification

- Unit tests must prove the installer writes `DAILY_OPERATOR.md`, copies the new skill, and the CLI command prints the operator prompt.
- `npm test` and `npm pack --dry-run` must pass.
- Because this is a public feature, bump the npm package minor version and publish after tests pass.
