import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { CONNECTOR_PRESETS } from "./connector-presets.js";
import { parseOpenClawConfig } from "./config-generator.js";
import { DEFAULT_PROFILE_NAME, resolveOpenClawHome, resolveOpenClawWorkspace, resolveProfileSkillsDir } from "./paths.js";

const execFileAsync = promisify(execFile);
const DEFAULT_OPENCLAW_CHECK_TIMEOUT_MS = 30_000;
const CHAT_RUNTIME_TIMEOUT_MS = 90_000;

export type DoctorOptions = {
  profileName?: string;
  openclawHome?: string;
  skillsDir?: string;
  packageRoot?: string;
  runOpenClaw?: boolean;
  openclawBinary?: string | undefined;
  testConnectors?: string[] | undefined;
  testChat?: boolean | undefined;
};

export type DoctorCheck = {
  id: string;
  ok: boolean;
  message: string;
};

export type DoctorReport = {
  profileName: string;
  openclawHome: string;
  ready: boolean;
  checks: DoctorCheck[];
  configuredConnectors: string[];
  missingDefaultConnectors: string[];
  connectorMode: string;
};

export async function doctorDelxWellnessOpenClawProfile(options: DoctorOptions = {}): Promise<DoctorReport> {
  const profileName = options.profileName ?? DEFAULT_PROFILE_NAME;
  const openclawHome = options.openclawHome ?? resolveOpenClawHome(profileName);
  const workspaceDir = resolveOpenClawWorkspace(openclawHome);
  const configPath = path.join(openclawHome, "openclaw.json");
  const metadataPath = path.join(workspaceDir, ".openclaw", "delx-wellness.json");
  const expectedSkillsDir = options.skillsDir ?? resolveProfileSkillsDir(openclawHome);
  const checks: DoctorCheck[] = [];

  const profileExists = await exists(openclawHome);
  checks.push({
    id: "profile_home",
    ok: profileExists,
    message: profileExists ? `OpenClaw profile home exists at ${openclawHome}` : `OpenClaw profile home is missing at ${openclawHome}`
  });

  const workspaceExists = await exists(workspaceDir);
  checks.push({
    id: "workspace",
    ok: workspaceExists,
    message: workspaceExists ? `OpenClaw workspace exists at ${workspaceDir}` : `OpenClaw workspace is missing at ${workspaceDir}`
  });

  const soulExists = await exists(path.join(workspaceDir, "SOUL.md"));
  checks.push({
    id: "soul",
    ok: soulExists,
    message: soulExists ? "SOUL.md is installed" : "SOUL.md is missing"
  });

  const onboardingExists = await exists(path.join(workspaceDir, "ONBOARDING.md"));
  checks.push({
    id: "onboarding",
    ok: onboardingExists,
    message: onboardingExists ? "ONBOARDING.md is installed" : "ONBOARDING.md is missing"
  });

  const wellnessProfileExists = await exists(path.join(workspaceDir, "wellness-profile.json"));
  checks.push({
    id: "wellness_profile",
    ok: wellnessProfileExists,
    message: wellnessProfileExists ? "wellness-profile.json is installed" : "wellness-profile.json is missing"
  });

  const config = await readConfigIfPresent(configPath);
  checks.push({
    id: "config",
    ok: Boolean(config),
    message: config ? "openclaw.json is readable" : "openclaw.json is missing or unreadable"
  });

  const metadata = await readConfigIfPresent(metadataPath);
  checks.push({
    id: "metadata",
    ok: Boolean(metadata),
    message: metadata ? "Delx Wellness metadata is installed" : "Delx Wellness metadata is missing"
  });

  if (options.runOpenClaw) {
    const openclawBinary = options.openclawBinary ?? "openclaw";
    checks.push(await runOpenClawCheck("openclaw_version", openclawBinary, ["--version"]));
    checks.push(await runOpenClawCheck("openclaw_config_validate", openclawBinary, ["--profile", profileName, "config", "validate"]));
    checks.push(await runOpenClawCheck("openclaw_mcp_list", openclawBinary, ["--profile", profileName, "mcp", "list"]));
    if (options.testChat) {
      checks.push(await runOpenClawCheck("openclaw_chat_runtime", openclawBinary, [
        "--profile",
        profileName,
        "agent",
        "--local",
        "--message",
        "Reply with exactly: delx-wellness-openclaw-ok"
      ]));
    }
    for (const connector of options.testConnectors ?? []) {
      checks.push(await runOpenClawCheck(`openclaw_mcp_show_${connector}`, openclawBinary, ["--profile", profileName, "mcp", "show", connector, "--json"]));
    }
  }

  const delxConfig = asPlainObject(metadata?.delx_wellness);
  const connectorMode = asString(delxConfig.connector_mode) ?? "full";
  const configuredServers = Object.keys(asPlainObject(asPlainObject(config?.mcp).servers));
  const configuredConnectors = configuredServers.filter((id) => id !== "delx_wellness_hub");
  const externalDirs = asStringArray(asPlainObject(asPlainObject(config?.skills).load).extraDirs);
  checks.push({
    id: "skills_external_dir",
    ok: externalDirs.includes(expectedSkillsDir),
    message: externalDirs.includes(expectedSkillsDir)
      ? "Delx Wellness skills directory is registered"
      : `Delx Wellness skills directory is not registered: ${expectedSkillsDir}`
  });

  const defaultConnectors = CONNECTOR_PRESETS
    .filter((preset) => preset.enabledByDefault)
    .map((preset) => preset.id);
  const expectedConnectors = configuredServers.includes("delx_wellness_hub")
    ? []
    : enabledDelxConnectors(delxConfig, defaultConnectors);
  const missingDefaultConnectors = expectedConnectors.filter((id) => !configuredConnectors.includes(id));
  checks.push({
    id: "mcp_connectors",
    ok: missingDefaultConnectors.length === 0,
    message: missingDefaultConnectors.length === 0
      ? connectorSummary(connectorMode, configuredServers, configuredConnectors)
      : `Missing default MCP connectors: ${missingDefaultConnectors.join(", ")}`
  });

  return {
    profileName,
    openclawHome,
    ready: checks.every((check) => check.ok),
    checks,
    configuredConnectors,
    missingDefaultConnectors,
    connectorMode
  };
}

async function runOpenClawCheck(id: string, command: string, args: string[]): Promise<DoctorCheck> {
  const timeout = openclawCheckTimeout(args);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout, maxBuffer: 256_000 });
    const output = `${stdout}${stderr}`.trim();
    return {
      id,
      ok: true,
      message: output ? redactOutput(output).split("\n")[0] ?? `${command} ${args.join(" ")} passed` : `${command} ${args.join(" ")} passed`
    };
  } catch (error) {
    return {
      id,
      ok: false,
      message: formatCommandError(error, timeout)
    };
  }
}

function openclawCheckTimeout(args: string[]): number {
  if (args.includes("agent")) return CHAT_RUNTIME_TIMEOUT_MS;
  return DEFAULT_OPENCLAW_CHECK_TIMEOUT_MS;
}

async function readConfigIfPresent(configPath: string): Promise<Record<string, unknown> | undefined> {
  try {
    return parseOpenClawConfig(await fs.readFile(configPath, "utf8"));
  } catch {
    return undefined;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function asPlainObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function enabledDelxConnectors(delxConfig: Record<string, unknown>, fallback: string[]): string[] {
  const connectors = delxConfig.connectors;
  if (!Array.isArray(connectors)) return fallback;
  const enabled = connectors
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    .filter((item) => item.enabled === true)
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string");
  return enabled.length > 0 ? enabled : fallback;
}

function connectorSummary(connectorMode: string, configuredServers: string[], configuredConnectors: string[]): string {
  if (configuredServers.includes("delx_wellness_hub")) {
    return "Configured hosted Delx Wellness hub";
  }
  const label = connectorMode === "custom" ? "custom" : connectorMode === "lite" ? "lite" : "full";
  return `Configured ${label} MCP connectors: ${configuredConnectors.join(", ")}`;
}

function redactOutput(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(token|secret|password|api[_-]?key)=\S+/gi, "$1=[redacted]");
}

function formatCommandError(error: unknown, timeoutMs: number): string {
  const message = error instanceof Error ? error.message : String(error);
  const stderr = getStringProperty(error, "stderr");
  const stdout = getStringProperty(error, "stdout");
  const output = redactOutput(`${stdout}\n${stderr}`.trim() || message);
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const timedOut = getBooleanProperty(error, "killed") || /timed out|timeout|SIGTERM/i.test(message);
  if (timedOut) {
    const lastOutput = lines.length > 0 ? ` Last output: ${lines.slice(-3).join(" | ")}` : "";
    return `Command timed out after ${Math.round(timeoutMs / 1000)}s.${lastOutput}`;
  }
  const important = findLast(lines, (line) => /AuthError|Error:|No inference provider configured|not configured/i.test(line));
  if (important) return important;
  if (lines.length > 0) return lines.slice(-3).join(" | ");
  return redactOutput(message);
}

function getStringProperty(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null || !(key in value)) return "";
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : "";
}

function getBooleanProperty(value: unknown, key: string): boolean {
  if (typeof value !== "object" || value === null || !(key in value)) return false;
  return (value as Record<string, unknown>)[key] === true;
}

function findLast<T>(items: T[], predicate: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return item;
  }
  return undefined;
}
