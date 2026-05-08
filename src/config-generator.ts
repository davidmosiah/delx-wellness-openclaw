import {
  CONNECTOR_PRESETS,
  ConnectorId,
  OpenClawMcpServerConfig,
  buildLocalMcpServerConfig,
  defaultConnectorIds,
  liteConnectorIds
} from "./connector-presets.js";
import { DEFAULT_PROFILE_NAME } from "./paths.js";

export type PlainConfig = Record<string, unknown>;

export type ConnectorMode = "local" | "hosted";
export type ConnectorLoadMode = "full" | "lite";

export type BuildOpenClawProfileConfigOptions = {
  profileName?: string;
  skillsDir: string;
  workspaceDir: string;
  mode?: ConnectorMode;
  connectorMode?: ConnectorLoadMode;
  connectorIds?: ConnectorId[];
  hubUrl?: string | undefined;
};

export function buildOpenClawProfileConfig(options: BuildOpenClawProfileConfigOptions): PlainConfig {
  const profileName = options.profileName ?? DEFAULT_PROFILE_NAME;
  const mode = options.mode ?? "local";
  const connectorIds = options.connectorIds ?? (options.connectorMode === "lite" ? liteConnectorIds() : defaultConnectorIds());
  const connectorMode = options.connectorIds ? "custom" : options.connectorMode ?? "full";
  const mcpServers: Record<string, OpenClawMcpServerConfig> = {};

  if (mode === "hosted") {
    if (!options.hubUrl) {
      throw new Error("Hosted mode requires --hub-url. Do not point hosted mode at the public marketing site by default.");
    }
    mcpServers.delx_wellness_hub = {
      url: options.hubUrl,
      headers: {
        Authorization: "Bearer ${WELLNESS_MCP_API_KEY}"
      }
    };
  } else {
    for (const connectorId of connectorIds) {
      const preset = CONNECTOR_PRESETS.find((candidate) => candidate.id === connectorId);
      if (!preset) throw new Error(`Unknown connector id: ${connectorId}`);
      const serverConfig = buildLocalMcpServerConfig(preset);
      if (serverConfig) mcpServers[connectorId] = serverConfig;
    }
  }

  return {
    agents: {
      defaults: {
        workspace: options.workspaceDir
      }
    },
    commands: {
      mcp: true
    },
    skills: {
      load: {
        extraDirs: [options.skillsDir]
      }
    },
    mcp: {
      servers: mcpServers
    }
  };
}

export function buildDelxWellnessMetadata(options: BuildOpenClawProfileConfigOptions): PlainConfig {
  const profileName = options.profileName ?? DEFAULT_PROFILE_NAME;
  const mode = options.mode ?? "local";
  const connectorIds = options.connectorIds ?? (options.connectorMode === "lite" ? liteConnectorIds() : defaultConnectorIds());
  const connectorMode = options.connectorIds ? "custom" : options.connectorMode ?? "full";
  const enabled = new Set(mode === "hosted" ? defaultConnectorIds() : connectorIds);

  return {
    delx_wellness: {
      profile_name: profileName,
      mode,
      connector_mode: connectorMode,
      generated_by: "delx-wellness-openclaw",
      runtime: "openclaw",
      onboarding: {
        required: true,
        template: "ONBOARDING.md",
        profile_path: "wellness-profile.json",
        next_step: "Run `delx-wellness-openclaw onboarding --profile delx-wellness` or ask OpenClaw to use the delx-wellness-onboarding skill."
      },
      connectors: CONNECTOR_PRESETS.map((preset) => ({
        id: preset.id,
        display_name: preset.displayName,
        enabled: enabled.has(preset.id),
        category: preset.category,
        privacy: preset.privacy,
        notes: preset.notes
      }))
    }
  };
}

export function parseOpenClawConfig(source: string): PlainConfig {
  if (!source.trim()) return {};
  const parsed = JSON.parse(source);
  if (!isPlainObject(parsed)) throw new Error("OpenClaw config must be a JSON object");
  return parsed as PlainConfig;
}

export function stringifyOpenClawConfig(config: PlainConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function mergeOpenClawConfig(existing: PlainConfig, generated: PlainConfig): PlainConfig {
  return {
    ...existing,
    agents: mergeAgentsConfig(asPlainObject(existing.agents), asPlainObject(generated.agents)),
    commands: {
      ...asPlainObject(existing.commands),
      ...asPlainObject(generated.commands)
    },
    skills: mergeSkillsConfig(asPlainObject(existing.skills), asPlainObject(generated.skills)),
    mcp: mergeMcpConfig(asPlainObject(existing.mcp), asPlainObject(generated.mcp))
  };
}

export function renderDryRunConfig(config: PlainConfig): string {
  return stringifyOpenClawConfig(redactSecrets(config));
}

export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (!isPlainObject(value)) return value;

  const redacted: PlainConfig = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSecretLikeKey(key)) {
      redacted[key] = "[redacted]";
    } else {
      redacted[key] = redactSecrets(child);
    }
  }
  return redacted as T;
}

function mergeAgentsConfig(existing: PlainConfig, generated: PlainConfig): PlainConfig {
  return {
    ...existing,
    defaults: {
      ...asPlainObject(existing.defaults),
      ...asPlainObject(generated.defaults)
    }
  };
}

function mergeMcpConfig(existing: PlainConfig, generated: PlainConfig): PlainConfig {
  return {
    ...existing,
    servers: {
      ...asPlainObject(existing.servers),
      ...asPlainObject(generated.servers)
    }
  };
}

function mergeSkillsConfig(existing: PlainConfig, generated: PlainConfig): PlainConfig {
  const existingLoad = asPlainObject(existing.load);
  const generatedLoad = asPlainObject(generated.load);
  const existingDirs = asStringArray(existingLoad.extraDirs);
  const generatedDirs = asStringArray(generatedLoad.extraDirs);
  return {
    ...existing,
    ...generated,
    load: {
      ...existingLoad,
      ...generatedLoad,
      extraDirs: unique([...existingDirs, ...generatedDirs])
    }
  };
}

function asPlainObject(value: unknown): PlainConfig {
  return isPlainObject(value) ? value as PlainConfig : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSecretLikeKey(key: string): boolean {
  return /authorization|token|secret|password|api[_-]?key|bearer/i.test(key);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
