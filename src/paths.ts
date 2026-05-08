import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PROFILE_NAME = "delx-wellness";

export function resolveOpenClawHome(profileName = DEFAULT_PROFILE_NAME, homeDir = process.env.HOME): string {
  if (!homeDir) throw new Error("HOME is required to resolve OpenClaw profile paths");
  if (profileName === "default") return path.join(homeDir, ".openclaw");
  return path.join(homeDir, `.openclaw-${profileName}`);
}

export function resolveOpenClawWorkspace(openclawHome: string): string {
  return path.join(openclawHome, "workspace");
}

export function resolvePackageRoot(): string {
  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(srcDir, "..");
}

export function resolvePackageSkillsDir(packageRoot = resolvePackageRoot()): string {
  return path.join(packageRoot, "skills");
}

export function resolveProfileSkillsDir(openclawHome: string): string {
  return path.join(openclawHome, "skills", "delx-wellness");
}

export function resolvePackageTemplatePath(name: "SOUL.md" | "AGENTS.md" | "ONBOARDING.md", packageRoot = resolvePackageRoot()): string {
  return path.join(packageRoot, "templates", name);
}
