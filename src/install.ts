import fs from "node:fs/promises";
import path from "node:path";
import {
  BuildOpenClawProfileConfigOptions,
  buildDelxWellnessMetadata,
  buildOpenClawProfileConfig,
  mergeOpenClawConfig,
  parseOpenClawConfig,
  renderDryRunConfig,
  stringifyOpenClawConfig
} from "./config-generator.js";
import {
  DEFAULT_PROFILE_NAME,
  resolveOpenClawHome,
  resolveOpenClawWorkspace,
  resolvePackageSkillsDir,
  resolveProfileSkillsDir,
  resolvePackageTemplatePath
} from "./paths.js";
import { stringifyWellnessProfile } from "./wellness-profile.js";

export type InstallOptions = Omit<BuildOpenClawProfileConfigOptions, "skillsDir" | "workspaceDir"> & {
  profileName?: string;
  openclawHome?: string;
  skillsDir?: string;
  packageRoot?: string;
  write?: boolean;
};

export type InstallResult = {
  profileName: string;
  openclawHome: string;
  configPath: string;
  dryRun: boolean;
  changedFiles: string[];
  renderedConfig: string;
};

export async function installDelxWellnessOpenClawProfile(options: InstallOptions = {}): Promise<InstallResult> {
  const profileName = options.profileName ?? DEFAULT_PROFILE_NAME;
  if (profileName === "default" && options.write) {
    throw new Error("Refusing to write into the default OpenClaw profile. Use --profile delx-wellness.");
  }

  const openclawHome = options.openclawHome ?? resolveOpenClawHome(profileName);
  const workspaceDir = resolveOpenClawWorkspace(openclawHome);
  const configPath = path.join(openclawHome, "openclaw.json");
  const metadataPath = path.join(workspaceDir, ".openclaw", "delx-wellness.json");
  const wellnessProfilePath = path.join(workspaceDir, "wellness-profile.json");
  const packageSkillsDir = resolvePackageSkillsDir(options.packageRoot);
  const skillsDir = options.skillsDir ?? resolveProfileSkillsDir(openclawHome);
  const generated = buildOpenClawProfileConfig({
    ...options,
    profileName,
    skillsDir,
    workspaceDir
  });
  const metadata = buildDelxWellnessMetadata({
    ...options,
    profileName,
    skillsDir,
    workspaceDir
  });

  const existing = await readExistingConfig(configPath);
  const merged = mergeOpenClawConfig(existing, generated);
  const renderedConfig = options.write ? stringifyOpenClawConfig(merged) : renderDryRunConfig(merged);

  if (!options.write) {
    return {
      profileName,
      openclawHome,
      configPath,
      dryRun: true,
      changedFiles: [
        configPath,
        path.join(workspaceDir, "SOUL.md"),
        path.join(workspaceDir, "AGENTS.md"),
        path.join(workspaceDir, "ONBOARDING.md"),
        wellnessProfilePath,
        metadataPath,
        skillsDir
      ],
      renderedConfig
    };
  }

  await fs.mkdir(openclawHome, { recursive: true });
  await backupIfExists(configPath);
  await fs.writeFile(configPath, renderedConfig, "utf8");

  const changedFiles = [configPath];
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(metadataPath, stringifyOpenClawConfig(metadata), "utf8");
  changedFiles.push(metadataPath);

  if (!(await exists(wellnessProfilePath))) {
    await fs.mkdir(path.dirname(wellnessProfilePath), { recursive: true });
    await fs.writeFile(wellnessProfilePath, stringifyWellnessProfile(), "utf8");
    changedFiles.push(wellnessProfilePath);
  }

  await fs.rm(skillsDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(skillsDir), { recursive: true });
  await fs.cp(packageSkillsDir, skillsDir, { recursive: true });
  changedFiles.push(skillsDir);

  for (const templateName of ["SOUL.md", "AGENTS.md", "ONBOARDING.md", "DAILY_OPERATOR.md"] as const) {
    const destination = path.join(workspaceDir, templateName);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await backupIfExists(destination);
    await fs.copyFile(resolvePackageTemplatePath(templateName, options.packageRoot), destination);
    changedFiles.push(destination);
  }

  return {
    profileName,
    openclawHome,
    configPath,
    dryRun: false,
    changedFiles,
    renderedConfig: renderDryRunConfig(merged)
  };
}

async function readExistingConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    return parseOpenClawConfig(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    if (isNotFound(error)) return {};
    throw error;
  }
}

async function backupIfExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  const backupPath = `${filePath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await fs.copyFile(filePath, backupPath);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
