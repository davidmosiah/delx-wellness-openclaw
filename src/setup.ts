import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ConnectorId } from "./connector-presets.js";
import { doctorDelxWellnessOpenClawProfile, type DoctorReport } from "./doctor.js";
import { installDelxWellnessOpenClawProfile, type InstallResult } from "./install.js";
import { ONBOARDING_QUESTIONS } from "./onboarding.js";
import { DEFAULT_PROFILE_NAME } from "./paths.js";

const execFileAsync = promisify(execFile);

export type SetupOptions = {
  profileName?: string;
  mode?: "local" | "hosted";
  connectorMode?: "full" | "lite";
  connectorIds?: ConnectorId[];
  hubUrl?: string | undefined;
  openclawHome?: string | undefined;
  packageRoot?: string | undefined;
  dryRun?: boolean | undefined;
  openclawBinary?: string | undefined;
  skipSmoke?: boolean | undefined;
  testChat?: boolean | undefined;
};

export type SetupResult = {
  profileName: string;
  dryRun: boolean;
  openclawDetected: boolean;
  install: InstallResult;
  doctor?: DoctorReport;
  nextSteps: string[];
};

export async function setupDelxWellnessOpenClaw(options: SetupOptions = {}): Promise<SetupResult> {
  const profileName = options.profileName ?? DEFAULT_PROFILE_NAME;
  const openclawBinary = options.openclawBinary ?? "openclaw";
  const dryRun = Boolean(options.dryRun);
  const installOptions: Parameters<typeof installDelxWellnessOpenClawProfile>[0] = {
    profileName,
    write: !dryRun
  };
  if (options.mode !== undefined) installOptions.mode = options.mode;
  if (options.connectorMode !== undefined) installOptions.connectorMode = options.connectorMode;
  if (options.connectorIds !== undefined) installOptions.connectorIds = options.connectorIds;
  if (options.hubUrl !== undefined) installOptions.hubUrl = options.hubUrl;
  if (options.openclawHome !== undefined) installOptions.openclawHome = options.openclawHome;
  if (options.packageRoot !== undefined) installOptions.packageRoot = options.packageRoot;
  const install = await installDelxWellnessOpenClawProfile(installOptions);

  if (dryRun) {
    return {
      profileName,
      dryRun,
      openclawDetected: false,
      install,
      nextSteps: [
        `Review the config preview, then run: npx -y delx-wellness-openclaw setup --profile ${profileName}`,
        "Nothing was written in dry-run mode."
      ]
    };
  }

  const openclawDetected = await isOpenClawAvailable(openclawBinary);
  const doctorOptions: Parameters<typeof doctorDelxWellnessOpenClawProfile>[0] = {
    profileName,
    runOpenClaw: openclawDetected,
    openclawBinary,
    testConnectors: openclawDetected && !options.skipSmoke ? ["nourish"] : []
  };
  if (options.openclawHome !== undefined) doctorOptions.openclawHome = options.openclawHome;
  if (options.packageRoot !== undefined) doctorOptions.packageRoot = options.packageRoot;
  if (options.testChat !== undefined) doctorOptions.testChat = options.testChat;
  const doctor = await doctorDelxWellnessOpenClawProfile(doctorOptions);

  return {
    profileName,
    dryRun,
    openclawDetected,
    install,
    doctor,
    nextSteps: nextStepsFor({
      profileName,
      openclawDetected,
      testChat: Boolean(options.testChat)
    })
  };
}

export function formatSetupResult(result: SetupResult): string {
  const lines: string[] = [];
  lines.push(`Delx Wellness for OpenClaw ${result.dryRun ? "dry run" : "setup"}`);
  lines.push("");
  lines.push(`Profile: ${result.profileName}`);
  lines.push(`Path: ${result.install.openclawHome}`);
  lines.push("");

  if (result.dryRun) {
    lines.push("No files were written.");
    lines.push("");
    lines.push("--- redacted config preview ---");
    lines.push(result.install.renderedConfig.trimEnd());
  } else {
    lines.push("Installed:");
    for (const filePath of result.install.changedFiles) {
      lines.push(`- ${filePath}`);
    }

    if (result.doctor) {
      lines.push("");
      lines.push("Checks:");
      for (const check of result.doctor.checks) {
        lines.push(`- ${check.ok ? "ok" : "needs attention"} ${check.id}: ${check.message}`);
      }
    }

    lines.push("");
    lines.push("Onboarding:");
    lines.push(`- ${ONBOARDING_QUESTIONS.filter((question) => question.required).length} required questions`);
    lines.push(`- ${ONBOARDING_QUESTIONS.length} total context prompts`);
  }

  lines.push("");
  lines.push("Next steps:");
  for (const step of result.nextSteps) {
    lines.push(`- ${step}`);
  }

  return lines.join("\n");
}

async function isOpenClawAvailable(openclawBinary: string): Promise<boolean> {
  try {
    await execFileAsync(openclawBinary, ["--version"], { timeout: 15_000, maxBuffer: 16_000 });
    return true;
  } catch {
    return false;
  }
}

function nextStepsFor(options: {
  profileName: string;
  openclawDetected: boolean;
  testChat: boolean;
}): string[] {
  if (!options.openclawDetected) {
    return [
      "Install OpenClaw from https://docs.openclaw.ai/cli or with: npm install -g openclaw",
      `Then run: npx -y delx-wellness-openclaw doctor --profile ${options.profileName} --run-openclaw`,
      `Preview the daily operator prompt: npx -y delx-wellness-openclaw operator --profile ${options.profileName}`,
      `Start OpenClaw with: openclaw --profile ${options.profileName} agent --local --message "Open Delx Wellness onboarding"`
    ];
  }

  const steps = [
    `Configure a model/provider if this profile does not have one yet: openclaw --profile ${options.profileName} models`,
    `Run the daily operator: openclaw --profile ${options.profileName} agent --local --message "$(npx -y delx-wellness-openclaw operator --prompt-only)"`,
    `Start the wellness agent: openclaw --profile ${options.profileName} agent --local --message "Open Delx Wellness onboarding"`,
    "Connect provider credentials only through each connector's setup flow; never paste OAuth tokens into chat."
  ];

  if (!options.testChat) {
    steps.splice(
      1,
      0,
      `Optional full chat check: npx -y delx-wellness-openclaw doctor --profile ${options.profileName} --run-openclaw --test-chat`
    );
  }

  return steps;
}
