import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDelxWellnessMetadata,
  buildOpenClawProfileConfig,
  createOnboardingFile,
  DEFAULT_WELLNESS_PROFILE,
  createDailyOperatorFile,
  doctorDelxWellnessOpenClawProfile,
  formatDailyOperatorPrompt,
  formatOnboardingQuestions,
  installDelxWellnessOpenClawProfile,
  liteConnectorIds,
  mergeOpenClawConfig,
  parseOpenClawConfig,
  renderDryRunConfig,
  runDelxWellnessE2E,
  setupDelxWellnessOpenClaw
} from "../src/index.ts";

const packageRoot = process.cwd();
const skillsDir = "/opt/delx-wellness-openclaw/skills";
const workspaceDir = "/opt/delx-wellness-openclaw/workspace";

test("OpenClaw profile config includes Delx Wellness skills, onboarding, and default local connectors", () => {
  const config = buildOpenClawProfileConfig({
    profileName: "delx-wellness",
    skillsDir,
    workspaceDir
  });
  const metadata = buildDelxWellnessMetadata({
    profileName: "delx-wellness",
    skillsDir,
    workspaceDir
  });

  const skills = config.skills as { load?: { extraDirs?: string[] } };
  const servers = (config.mcp as { servers?: Record<string, unknown> }).servers ?? {};
  const delx = (metadata.delx_wellness ?? {}) as { profile_name?: string; generated_by?: string; onboarding?: { required?: boolean } };

  assert.deepEqual(skills.load?.extraDirs, [skillsDir]);
  assert.deepEqual((config.agents as { defaults?: { workspace?: string } }).defaults?.workspace, workspaceDir);
  assert.deepEqual((config.commands as { mcp?: boolean }).mcp, true);
  assert.ok(servers.whoop);
  assert.ok(servers.garmin);
  assert.ok(servers.oura);
  assert.ok(servers.strava);
  assert.ok(servers.fitbit);
  assert.ok(servers.google_health);
  assert.ok(servers.withings);
  assert.ok(servers.apple_health);
  assert.ok(servers.samsung_health);
  assert.ok(servers.polar);
  assert.ok(servers.nourish);
  assert.equal(servers.exercise_catalog, undefined);
  assert.equal(delx.profile_name, "delx-wellness");
  assert.equal(delx.generated_by, "delx-wellness-openclaw");
  assert.equal(delx.onboarding?.required, true);
});

test("lite connector mode installs only the fast core connectors", () => {
  const config = buildOpenClawProfileConfig({
    profileName: "delx-wellness",
    skillsDir,
    workspaceDir,
    connectorMode: "lite"
  });
  const metadata = buildDelxWellnessMetadata({
    profileName: "delx-wellness",
    skillsDir,
    workspaceDir,
    connectorMode: "lite"
  });

  const servers = (config.mcp as { servers?: Record<string, unknown> }).servers ?? {};
  const delx = metadata.delx_wellness as {
    connector_mode?: string;
    connectors?: Array<{ id: string; enabled: boolean }>;
  };

  assert.deepEqual(Object.keys(servers), liteConnectorIds());
  assert.equal(delx.connector_mode, "lite");
  assert.equal(delx.connectors?.find((connector) => connector.id === "garmin")?.enabled, true);
  assert.equal(delx.connectors?.find((connector) => connector.id === "nourish")?.enabled, true);
  assert.equal(delx.connectors?.find((connector) => connector.id === "whoop")?.enabled, false);
});

test("explicit connector list overrides connector mode", () => {
  const config = buildOpenClawProfileConfig({
    skillsDir: "/opt/delx/skills",
    workspaceDir: "/opt/delx/workspace",
    connectorMode: "lite",
    connectorIds: ["whoop", "oura", "nourish"]
  });
  const metadata = buildDelxWellnessMetadata({
    skillsDir: "/opt/delx/skills",
    workspaceDir: "/opt/delx/workspace",
    connectorMode: "lite",
    connectorIds: ["whoop", "oura", "nourish"]
  });
  const servers = (config.mcp as { servers?: Record<string, unknown> }).servers ?? {};
  const delx = metadata.delx_wellness as { connector_mode?: string };

  assert.deepEqual(Object.keys(servers), ["whoop", "oura", "nourish"]);
  assert.equal(delx.connector_mode, "custom");
});

test("OpenClaw profile config merges idempotently and preserves unrelated settings", () => {
  const existing = parseOpenClawConfig(JSON.stringify({
    models: { mode: "merge" },
    skills: { load: { extraDirs: ["/existing/skills"] } },
    mcp: { servers: { github: { command: "gh-mcp" } } }
  }));
  const generated = buildOpenClawProfileConfig({
    skillsDir: "/opt/delx/skills",
    workspaceDir: "/opt/delx/workspace",
    connectorIds: ["whoop", "nourish"]
  });

  const merged = mergeOpenClawConfig(existing, generated);
  const mergedAgain = mergeOpenClawConfig(merged, generated);
  const skills = mergedAgain.skills as { load?: { extraDirs?: string[] } };
  const servers = (mergedAgain.mcp as { servers?: Record<string, unknown> }).servers ?? {};

  assert.deepEqual(mergedAgain.models, { mode: "merge" });
  assert.deepEqual(skills.load?.extraDirs, ["/existing/skills", "/opt/delx/skills"]);
  assert.ok(servers.github);
  assert.ok(servers.whoop);
  assert.ok(servers.nourish);
});

test("dry-run output redacts secret-like fields", () => {
  const rendered = renderDryRunConfig({
    mcp: {
      servers: {
        delx_wellness_hub: {
          url: "https://example.test/mcp",
          headers: {
            Authorization: "Bearer secret-token-value"
          }
        }
      }
    },
    api_key: "secret-api-key"
  });

  assert.match(rendered, /redacted/);
  assert.equal(rendered.includes("secret-token-value"), false);
  assert.equal(rendered.includes("secret-api-key"), false);
});

test("hosted mode requires an explicit hub URL", () => {
  assert.throws(
    () => buildOpenClawProfileConfig({
      skillsDir,
      workspaceDir,
      mode: "hosted"
    }),
    /requires --hub-url/i
  );

  const config = buildOpenClawProfileConfig({
    skillsDir,
    workspaceDir,
    mode: "hosted",
    hubUrl: "https://private.example.test/mcp"
  });
  const servers = ((config.mcp as { servers?: Record<string, { url?: string }> }).servers ?? {});
  assert.equal(servers.delx_wellness_hub?.url, "https://private.example.test/mcp");
});

test("installer write creates public-safe OpenClaw profile files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-openclaw-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");
  const workspace = path.join(openclawHome, "workspace");

  await installDelxWellnessOpenClawProfile({ openclawHome, packageRoot, write: true });

  const config = JSON.parse(await fs.readFile(path.join(openclawHome, "openclaw.json"), "utf8")) as {
    skills?: { load?: { extraDirs?: string[] } };
    mcp?: { servers?: Record<string, unknown> };
  };
  const metadata = await fs.readFile(path.join(workspace, ".openclaw", "delx-wellness.json"), "utf8");
  const soul = await fs.readFile(path.join(workspace, "SOUL.md"), "utf8");
  const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
  const onboarding = await fs.readFile(path.join(workspace, "ONBOARDING.md"), "utf8");
  const dailyOperator = await fs.readFile(path.join(workspace, "DAILY_OPERATOR.md"), "utf8");
  const wellnessProfile = JSON.parse(await fs.readFile(path.join(workspace, "wellness-profile.json"), "utf8")) as typeof DEFAULT_WELLNESS_PROFILE;
  const copiedSkill = await fs.readFile(path.join(openclawHome, "skills", "delx-wellness", "delx-wellness-onboarding", "SKILL.md"), "utf8");
  const copiedOperatorSkill = await fs.readFile(path.join(openclawHome, "skills", "delx-wellness", "delx-wellness-daily-operator", "SKILL.md"), "utf8");

  assert.ok(config.mcp?.servers?.whoop);
  assert.ok(config.skills?.load?.extraDirs?.some((item) => item.includes("skills/delx-wellness")));
  assert.match(metadata, /delx-wellness-openclaw/);
  assert.match(soul, /not a doctor/i);
  assert.match(soul, /freshness/i);
  assert.match(agents, /Never print/i);
  assert.match(onboarding, /Devices and Data Sources/i);
  assert.match(dailyOperator, /Daily Operator Prompt/i);
  assert.equal(wellnessProfile.schema, "delx-wellness-profile/v1");
  assert.deepEqual(wellnessProfile.preferences.language_priority, ["en", "pt-BR"]);
  assert.match(copiedSkill, /Delx Wellness Onboarding/i);
  assert.match(copiedOperatorSkill, /Daily Operator loop/i);

  const doctor = await doctorDelxWellnessOpenClawProfile({ openclawHome, packageRoot });
  assert.equal(doctor.ready, true);
});

test("daily operator helper writes the operator template and prints a safe prompt", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-operator-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");

  const result = await createDailyOperatorFile({ openclawHome, packageRoot, write: true });
  const written = await fs.readFile(result.operatorPath, "utf8");
  const prompt = formatDailyOperatorPrompt();

  assert.equal(result.written, true);
  assert.equal(result.profileName, "delx-wellness");
  assert.match(result.openclawCommand, /delx-wellness-openclaw operator --prompt-only/);
  assert.match(written, /OpenClaw Command/i);
  assert.match(prompt, /Prefer delx-living-body/i);
  assert.match(prompt, /Do not ask me to paste OAuth tokens/i);
  assert.equal(/refresh token|api key|password/i.test(prompt.replace(/Do not ask me to paste OAuth tokens, refresh tokens, cookies, passwords, API keys/i, "")), false);
});

test("doctor test-chat surfaces missing OpenClaw inference provider", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-openclaw-doctor-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");
  const openclawBinary = path.join(tempDir, "fake-openclaw");

  await installDelxWellnessOpenClawProfile({ openclawHome, packageRoot, write: true });
  await fs.writeFile(openclawBinary, `#!/usr/bin/env bash
if [[ "$*" == "--version" ]]; then
  echo "OpenClaw Agent v0.12.0"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness config validate" ]]; then
  echo "Config OK"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness mcp list" ]]; then
  echo "MCP Servers:"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness agent --local --message"* ]]; then
  echo "No inference provider configured" >&2
  exit 1
fi
exit 2
`, "utf8");
  await fs.chmod(openclawBinary, 0o755);

  const doctor = await doctorDelxWellnessOpenClawProfile({
    openclawHome,
    packageRoot,
    runOpenClaw: true,
    openclawBinary,
    testChat: true
  });

  assert.equal(doctor.ready, false);
  assert.equal(doctor.checks.find((check) => check.id === "openclaw_chat_runtime")?.ok, false);
  assert.match(doctor.checks.find((check) => check.id === "openclaw_chat_runtime")?.message ?? "", /No inference provider configured/i);
});

test("setup command writes the wellness profile and runs OpenClaw checks when available", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-openclaw-setup-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");
  const openclawBinary = path.join(tempDir, "fake-openclaw");

  await fs.writeFile(openclawBinary, `#!/usr/bin/env bash
if [[ "$*" == "--version" ]]; then
  echo "OpenClaw Agent v0.12.0"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness config validate" ]]; then
  echo "Config OK"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness mcp list" ]]; then
  echo "MCP Servers:"
  exit 0
fi
exit 2
`, "utf8");
  await fs.chmod(openclawBinary, 0o755);

  const setup = await setupDelxWellnessOpenClaw({
    openclawHome,
    packageRoot,
    openclawBinary,
    skipSmoke: true
  });

  assert.equal(setup.dryRun, false);
  assert.equal(setup.openclawDetected, true);
  assert.equal(setup.doctor?.ready, true);
  assert.match(setup.nextSteps.join("\n"), /openclaw --profile delx-wellness models/);
  assert.equal(await exists(path.join(openclawHome, "openclaw.json")), true);
});

test("onboarding command model covers profile, goals, devices, nutrition, exercise, and safety", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-onboarding-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");

  const result = await createOnboardingFile({ openclawHome, packageRoot, write: true });
  const prompts = formatOnboardingQuestions(result.questions);

  assert.equal(result.written, true);
  assert.equal(await exists(result.onboardingPath), true);
  assert.match(prompts, /WHOOP, Garmin, Oura/i);
  assert.match(prompts, /nutrition/i);
  assert.match(prompts, /injuries/i);
});

test("onboarding supports global English default and pt-BR output", async () => {
  const english = formatOnboardingQuestions(undefined, { language: "en" });
  const portuguese = formatOnboardingQuestions(undefined, { language: "pt-BR" });

  assert.match(english, /What should the agent call you/i);
  assert.match(english, /WHOOP, Garmin, Oura/i);
  assert.match(portuguese, /Como o agente deve te chamar/i);
  assert.match(portuguese, /lesões/i);
});

test("doctor honors lite profiles and reports wellness profile presence", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-openclaw-lite-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");

  await installDelxWellnessOpenClawProfile({
    openclawHome,
    packageRoot,
    connectorMode: "lite",
    write: true
  });

  const doctor = await doctorDelxWellnessOpenClawProfile({ openclawHome, packageRoot });

  assert.equal(doctor.ready, true);
  assert.deepEqual(doctor.configuredConnectors, ["garmin", "nourish"]);
  assert.deepEqual(doctor.missingDefaultConnectors, []);
  assert.equal(doctor.checks.find((check) => check.id === "wellness_profile")?.ok, true);
  assert.match(doctor.checks.find((check) => check.id === "mcp_connectors")?.message ?? "", /lite/i);
});

test("E2E runner uses safe onboarding prompt through OpenClaw", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-openclaw-e2e-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");
  const openclawBinary = path.join(tempDir, "fake-openclaw");

  await installDelxWellnessOpenClawProfile({
    openclawHome,
    packageRoot,
    connectorMode: "lite",
    write: true
  });
  await fs.writeFile(openclawBinary, `#!/usr/bin/env bash
if [[ "$*" == "--version" ]]; then
  echo "OpenClaw Agent v0.12.0"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness config validate" ]]; then
  echo "Config OK"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness mcp list" ]]; then
  echo "MCP Servers:"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness mcp show nourish --json" ]]; then
  echo "Tools discovered: 23"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness agent --local --message"* ]]; then
  echo "E2E wellness answer: onboarding, connector status, training, nutrition, QA notes"
  exit 0
fi
exit 2
`, "utf8");
  await fs.chmod(openclawBinary, 0o755);

  const report = await runDelxWellnessE2E({
    openclawHome,
    packageRoot,
    openclawBinary,
    profileName: "delx-wellness",
    testConnectors: ["nourish"]
  });

  assert.equal(report.ready, true);
  assert.match(report.response, /E2E wellness answer/);
  assert.match(report.prompt, /Do not revoke/i);
  assert.match(report.prompt, /QA notes/i);
});

test("E2E runner keeps useful OpenClaw answers when the process exits non-zero", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delx-wellness-openclaw-e2e-partial-"));
  const openclawHome = path.join(tempDir, ".openclaw-delx-wellness");
  const openclawBinary = path.join(tempDir, "fake-openclaw");

  await installDelxWellnessOpenClawProfile({
    openclawHome,
    packageRoot,
    connectorMode: "lite",
    write: true
  });
  await fs.writeFile(openclawBinary, `#!/usr/bin/env bash
if [[ "$*" == "--version" ]]; then
  echo "OpenClaw Agent v0.12.0"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness config validate" ]]; then
  echo "Config OK"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness mcp list" ]]; then
  echo "MCP Servers:"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness mcp show nourish --json" ]]; then
  echo "Tools discovered: 23"
  exit 0
fi
if [[ "$*" == "--profile delx-wellness agent --local --message"* ]]; then
  echo "Connector status checked. Next safest setup step: fill wellness-profile.json."
  exit 1
fi
exit 2
`, "utf8");
  await fs.chmod(openclawBinary, 0o755);

  const report = await runDelxWellnessE2E({
    openclawHome,
    packageRoot,
    openclawBinary,
    profileName: "delx-wellness",
    testConnectors: ["nourish"]
  });

  assert.equal(report.ready, true);
  assert.match(report.response, /Next safest setup step/i);
  assert.match(report.error ?? "", /Next safest setup step/i);
});

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
