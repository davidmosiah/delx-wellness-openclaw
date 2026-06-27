<h1 align="center">Delx Wellness for OpenClaw</h1>

<div align="center">
  <img src="assets/banner.png" alt="Delx Wellness for OpenClaw — One-command local-first wellness profile pack" width="85%" />
</div>

<h3 align="center">
  Turn <a href="https://github.com/openclaw/openclaw">OpenClaw</a> into your personal wellness agent in <strong>one command</strong>.<br>
  WHOOP · Oura · Garmin · Strava · Fitbit · Google Health · Withings · Apple Health · Samsung Health · Polar · Nutrition &mdash; all local, all read-only.
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/delx-wellness-openclaw"><img src="https://img.shields.io/npm/v/delx-wellness-openclaw?style=for-the-badge&labelColor=0F172A&color=10B981&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/delx-wellness-openclaw"><img src="https://img.shields.io/npm/dm/delx-wellness-openclaw?style=for-the-badge&labelColor=0F172A&color=0EA5A3&logo=npm&logoColor=white" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-22C55E?style=for-the-badge&labelColor=0F172A" alt="License MIT" /></a>
  <a href="https://wellness.delx.ai/openclaw"><img src="https://img.shields.io/badge/SITE-wellness.delx.ai/openclaw-0EA5A3?style=for-the-badge&labelColor=0F172A" alt="Site" /></a>
</p>

<p align="center">
  <a href="https://github.com/davidmosiah/delx-wellness"><img src="https://img.shields.io/badge/REGISTRY-delx--wellness-7C3AED?style=for-the-badge&labelColor=0F172A&logo=github&logoColor=white" alt="Connector registry" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/BUILT_FOR-MCP-7C3AED?style=for-the-badge&labelColor=0F172A" alt="Built for MCP" /></a>
  <a href="https://github.com/openclaw/openclaw"><img src="https://img.shields.io/badge/RUNS_ON-OpenClaw-FF6B35?style=for-the-badge&labelColor=0F172A" alt="Runs on OpenClaw" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness-openclaw/stargazers"><img src="https://img.shields.io/github/stars/davidmosiah/delx-wellness-openclaw?style=for-the-badge&labelColor=0F172A&logo=github&color=FBBF24" alt="GitHub stars" /></a>
</p>

<p align="center">
  <strong>What is this?</strong> A one-command installer and daily wellness operator that wires <strong>11 wellness MCP connectors</strong> + a recovery-aware <code>SOUL.md</code> + onboarding + skills into a dedicated OpenClaw profile. No fork, no hosted vault, no token leaves your machine.
</p>

---

## ⚡ Quick Start

If OpenClaw is already installed:

```bash
npx -y delx-wellness-openclaw setup
openclaw --profile delx-wellness agent --local --message "Open Delx Wellness onboarding"
```

That's it. The installer creates `~/.openclaw-delx-wellness`, installs the wellness skills, writes OpenClaw-native MCP presets for all 11 connectors, validates the profile when `openclaw` is available, checks the Nourish preset (no OAuth required), and prints the next commands for model setup and per-provider auth.

If this profile does not have a model configured yet:

```bash
openclaw --profile delx-wellness models
npx -y delx-wellness-openclaw doctor --profile delx-wellness --run-openclaw --test-chat
```

Run the first useful workflow:

```bash
openclaw --profile delx-wellness agent --local --message "$(npx -y delx-wellness-openclaw operator --prompt-only)"
```

That launches the **Daily Operator**: setup check, available data, one daily read, one recovery/training action, one nutrition action, and a missing-setup checklist. No OAuth tokens or secrets are collected in chat.

If you are new to OpenClaw, install OpenClaw first:

```bash
npm install -g openclaw
npx -y delx-wellness-openclaw setup
openclaw --profile delx-wellness agent --local --message "Open Delx Wellness onboarding"
```

---

## 🎯 Why use it

- **🚀 One profile, not ten configs.** Stop wiring connectors by hand &mdash; one command sets up the whole stack in a OpenClaw profile.
- **💬 Built for daily use.** Real on OpenClaw terminal, Telegram and other MCP clients &mdash; not a one-off demo.
- **🧭 Daily Operator included.** One prompt turns available MCP data into a compact daily plan with evidence, actions and setup gaps.
- **🥗 Works immediately.** Nourish (local nutrition) is wired without OAuth, so you can chat about food the moment setup finishes.
- **⌚ Ten wearable/API/export sources ready.** WHOOP, Garmin, Oura, Strava, Fitbit, Google Health, Withings, Apple Health, Samsung Health and Polar presets included.
- **🧠 Onboarding-aware.** The agent gets your goals, schedule, equipment, dietary restrictions and conservative-decision rules **before** it gives advice.
- **🔒 Local-first credentials.** Each provider's tokens live inside its own connector's local setup &mdash; nothing routed through a hosted vault.

---

## 🏗️ How it fits together

```mermaid
flowchart LR
    User[👤 You]
    H[OpenClaw CLI<br/>or Telegram bridge]

    subgraph Profile[" delx-wellness profile (~/.openclaw-delx-wellness) "]
      direction TB
      SOUL[SOUL.md<br/>Recovery-aware operating model]
      AGENTS[AGENTS.md]
      ONB[ONBOARDING.md]
      SK[Skills:<br/>onboarding · daily-brief<br/>training · sleep · nutrition]
    end

    subgraph MCP[" Local MCP presets "]
      direction TB
      W[whoop-mcp]
      O[oura-mcp]
      G[garmin-mcp]
      S[strava-mcp]
      F[fitbit-mcp]
      GH[google-health-mcp]
      Wi[withings-mcp]
      AH[apple-health-mcp]
      SH[samsung-health-mcp]
      P[polar-mcp]
      N[nourish 🟢]
    end

    User --> H
    H --> Profile
    Profile --> MCP
    MCP --> Providers[(Provider APIs<br/>or local files)]

    style Profile fill:#0F172A,stroke:#10B981,color:#fff
    style MCP fill:#0F172A,stroke:#0EA5A3,color:#fff
    style H fill:#0F172A,stroke:#7C3AED,color:#fff
```

<p align="center"><em>One profile · 11 connectors · zero hosted vault. <strong>Nourish works immediately</strong>; OAuth providers are one <code>auth</code> command away, and export connectors need a local file path.</em></p>

---

## 🔧 What `setup` does

`setup` is the guided path. It:

- creates or updates `~/.openclaw-delx-wellness/openclaw.json`
- creates `~/.openclaw-delx-wellness/workspace`
- installs `SOUL.md`, `AGENTS.md` and `ONBOARDING.md` into the OpenClaw workspace
- installs `DAILY_OPERATOR.md` with the copyable daily operator prompt
- installs Delx Wellness skills for **onboarding · daily brief · daily operator · training · sleep · nutrition · setup**
- writes local MCP presets under OpenClaw's `mcp.servers` config for WHOOP, Garmin, Oura, Strava, Fitbit, Google Health, Withings, Apple Health, Samsung Health, Polar and Nourish
- runs OpenClaw profile checks when `openclaw` is available
- checks that OpenClaw can see the `nourish` MCP server preset (it does not require OAuth)
- prints the next commands for model setup, chat verification and connector auth

Preview before writing:

```bash
npx -y delx-wellness-openclaw setup --dry-run
```

Preview the operator prompt:

```bash
npx -y delx-wellness-openclaw operator
npx -y delx-wellness-openclaw operator --prompt-only
```

Copy `DAILY_OPERATOR.md` into the active workspace without running setup again:

```bash
npx -y delx-wellness-openclaw operator --write
```

Skip the Nourish smoke test:

```bash
npx -y delx-wellness-openclaw setup --skip-smoke
```

---

## 🛠️ Manual flow

Use the manual commands when you want to inspect each step:

```bash
npx -y delx-wellness-openclaw install    --profile delx-wellness --dry-run
npx -y delx-wellness-openclaw install    --profile delx-wellness --write
npx -y delx-wellness-openclaw onboarding --profile delx-wellness --write
npx -y delx-wellness-openclaw doctor     --profile delx-wellness --run-openclaw
```

---

## ✅ Validate MCP and chat

MCP-only checks verify profile files, skills and connector presets:

```bash
npx -y delx-wellness-openclaw doctor --profile delx-wellness --run-openclaw
openclaw --profile delx-wellness mcp list
openclaw --profile delx-wellness mcp show nourish --json
```

Full chat readiness requires a model/provider configured for the profile:

```bash
openclaw --profile delx-wellness models
npx -y delx-wellness-openclaw doctor --profile delx-wellness --run-openclaw --test-chat
```

> `--test-chat` makes a short OpenClaw model call, so it may use provider quota. MCP-only checks do not require model access.

---

## 📋 Onboarding worksheet

The onboarding worksheet gives the agent the context a real wellness product should ask for &mdash; **before** it recommends training, sleep, recovery or nutrition decisions:

| Category | What gets captured |
|---|---|
| **Locale** | Language · timezone · units |
| **Body** | Optional age · height · weight · gender context |
| **Goals** | Primary goal · secondary goals |
| **Devices** | Connected wearables and apps |
| **Training** | Schedule · sports · upcoming events · equipment · workout duration |
| **Nutrition** | Habits · restrictions · macro goals |
| **Health** | Injuries · pain · medical constraints · conservative decision rules |
| **Style** | Response format for Telegram or terminal use |

The user **never** needs to paste tokens or secrets into chat.

---

## 🔌 Connector presets

Default local MCP presets installed by `setup`:

| Provider | Package | OAuth needed at setup |
|---|---|:---:|
| **WHOOP** | [`whoop-mcp-unofficial`](https://www.npmjs.com/package/whoop-mcp-unofficial) | ✅ |
| **Garmin** | [`garmin-mcp-unofficial`](https://www.npmjs.com/package/garmin-mcp-unofficial) | ✅ |
| **Oura** | [`oura-mcp-unofficial`](https://www.npmjs.com/package/oura-mcp-unofficial) | ✅ |
| **Strava** | [`strava-mcp-unofficial`](https://www.npmjs.com/package/strava-mcp-unofficial) | ✅ |
| **Fitbit** | [`fitbit-mcp-unofficial`](https://www.npmjs.com/package/fitbit-mcp-unofficial) | ✅ |
| **Google Health** | [`google-health-mcp-unofficial`](https://www.npmjs.com/package/google-health-mcp-unofficial) | ✅ |
| **Withings** | [`withings-mcp-unofficial`](https://www.npmjs.com/package/withings-mcp-unofficial) | ✅ |
| **Apple Health** | [`apple-health-mcp-unofficial`](https://www.npmjs.com/package/apple-health-mcp-unofficial) | ⛔ (uses local export.zip) |
| **Samsung Health** | [`samsung-health-mcp-unofficial`](https://www.npmjs.com/package/samsung-health-mcp-unofficial) | ⛔ (uses local CSV/ZIP export) |
| **Polar** | [`polar-mcp-unofficial`](https://www.npmjs.com/package/polar-mcp-unofficial) | ✅ |
| **Nourish** 🟢 | [`wellness-nourish`](https://www.npmjs.com/package/wellness-nourish) | ⛔ (works immediately) |

Exercise Catalog is kept disabled by default because private catalog access may depend on non-public data.

---

## 🌐 Hosted Hub mode

Hosted hub mode is explicit and has no default production URL:

```bash
npx -y delx-wellness-openclaw setup \
  --mode hosted \
  --hub-url https://your-private-hub.example/mcp \
  --dry-run
```

---

## 🛡️ Public-safe boundary

This package is **safe to publish** because it contains:

- ✅ profile templates
- ✅ public skills
- ✅ connector package presets
- ✅ config generation
- ✅ setup and doctor checks

It must **not** contain:

- ❌ real user tokens
- ❌ OAuth credentials
- ❌ personal `~/.openclaw` config
- ❌ Telegram gateway secrets
- ❌ private hosted hub API keys
- ❌ private Exercise Catalog data

---

## 🧪 Development

```bash
npm install
npm test
npm pack --dry-run
```

---

## 🔗 See also

- 🏠 **Connector registry** &mdash; [`delx-wellness`](https://github.com/davidmosiah/delx-wellness): the public map of all 11 wellness MCP connectors.
- 🌐 **Site** &mdash; [wellness.delx.ai/openclaw](https://wellness.delx.ai/openclaw): live demo, FAQ, and copy-paste configs.
- 🤖 **OpenClaw** &mdash; [`openclaw/openclaw`](https://github.com/openclaw/openclaw): the agent runtime this profile pack targets.

---

## 👤 Built by

[David Batista](https://github.com/davidmosiah) &mdash; founder of [Delx](https://delx.ai), building protocol layers for autonomous AI agents.

Follow on X: [@delx369](https://x.com/delx369)

---

## 📜 License

MIT &mdash; see [LICENSE](LICENSE).

<sub>OpenClaw, WHOOP, Oura, Garmin, Strava, Fitbit, Google Health, Withings, Apple Health, Samsung Health and Polar are trademarks of their respective owners. This profile pack is not affiliated with, endorsed by, or supported by any of them.</sub>
