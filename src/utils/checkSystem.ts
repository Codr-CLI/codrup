import { spinner, outro, confirm } from "@clack/prompts";
import { execaCommand } from "execa";
import os from "node:os";
import color from "picocolors";

type DependencyName = string;
type InstallCommand = () => Promise<void>;

interface DependencyCheckResult {
  dependency: string;
  installed: boolean;
}

class DependencyError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "DependencyError";
  }
}

const INSTALL_COMMANDS: Record<DependencyName, InstallCommand> = {
  bun: async () => {
    const platform = os.platform();
    const command = platform === "win32"
      ? 'powershell -Command "iwr https://bun.sh/install.ps1 -UseBasicParsing | iex"'
      : "curl -fsSL https://bun.sh/install | bash";

    await execaCommand(command, { shell: true });
  },
};

export async function checkDependencies(required: DependencyName[]): Promise<boolean> {
  const checkResults = await scanDependencies(required);
  const missing = checkResults.filter(result => !result.installed);

  if (missing.length === 0) {
    displayAllInstalled();
    return true;
  }

  displayMissingDependencies(missing);
  return await handleMissingDependencies(missing);
}

async function scanDependencies(dependencies: DependencyName[]): Promise<DependencyCheckResult[]> {
  const s = spinner();
  s.start("🔍 Checking system dependencies...");

  const results = await Promise.all(
    dependencies.map(async (dep) => ({
      dependency: dep,
      installed: await isDependencyInstalled(dep),
    }))
  );

  s.stop();
  return results;
}

async function isDependencyInstalled(dependency: DependencyName): Promise<boolean> {
  try {
    await execaCommand(`${dependency} --version`, {
      shell: true,
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function displayAllInstalled(): void {
  console.log(`${color.green("✓")} All dependencies are installed.`);
}

function displayMissingDependencies(missing: DependencyCheckResult[]): void {
  console.log(`${color.yellow("⚠️")} Missing dependencies detected:\n`);
  missing.forEach(({ dependency }) => {
    console.log(`  ${color.red("✗")} ${dependency}`);
  });
  console.log();
}

async function handleMissingDependencies(
  missing: DependencyCheckResult[]
): Promise<boolean> {
  for (const { dependency } of missing) {
    const installed = await processMissingDependency(dependency);

    if (!installed) {
      return false;
    }
  }

  return true;
}

async function processMissingDependency(dependency: DependencyName): Promise<boolean> {
  if (!isAutoInstallable(dependency)) {
    displayManualInstallRequired(dependency);
    return false;
  }

  const shouldInstall = await confirmInstallation(dependency);

  if (!shouldInstall) {
    displaySetupAborted(dependency);
    return false;
  }

  return await installDependency(dependency);
}

function isAutoInstallable(dependency: DependencyName): boolean {
  return dependency in INSTALL_COMMANDS;
}

function displayManualInstallRequired(dependency: DependencyName): void {
  outro(
    `${color.red(dependency)} is required but cannot be auto-installed.\nPlease install it manually and try again.`
  );
}

async function confirmInstallation(dependency: DependencyName): Promise<boolean> {
  const response = await confirm({
    message: `${color.yellow(dependency)} is missing. Install it now?`,
    initialValue: true,
  });

  return response === true;
}

function displaySetupAborted(dependency: DependencyName): void {
  outro(`❌ Setup aborted. ${color.cyan(dependency)} is required to continue.`);
}

async function installDependency(dependency: DependencyName): Promise<boolean> {
  const s = spinner();
  s.start(`Installing ${dependency}...`);

  try {
    // @ts-ignore
    await INSTALL_COMMANDS[dependency]();
    await verifyInstallation(dependency);

    s.stop(`${color.green("✓")} ${dependency} installed successfully.`);
    return true;
  } catch (error) {
    s.stop(`${color.red("❌")} Failed to install ${dependency}.`);
    displayInstallationError(dependency, error);
    return false;
  }
}

async function verifyInstallation(dependency: DependencyName): Promise<void> {
  const isInstalled = await isDependencyInstalled(dependency);

  if (!isInstalled) {
    throw new DependencyError(
      `Installation completed but ${dependency} is still not available in PATH`
    );
  }
}

function displayInstallationError(dependency: DependencyName, error: unknown): void {
  outro(`Failed to install ${color.cyan(dependency)}:\n${formatError(error)}`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}