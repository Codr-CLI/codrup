import { spinner, outro, confirm } from "@clack/prompts";
import { execaCommand } from "execa";
import os from "node:os";
import color from "picocolors";

const installCommands: Record<string, () => Promise<void>> = {
  bun: async () => {
    const platform = os.platform();
    if (platform === "win32") {
      await execaCommand(
        'powershell -Command "iwr https://bun.sh/install.ps1 -UseBasicParsing | iex"',
        { shell: true }
      );
    } else {
      await execaCommand("curl -fsSL https://bun.sh/install | bash", {
        shell: true,
      });
    }
  },

  uv: async () => {
    const platform = os.platform();
    if (platform === "win32") {
      await execaCommand("pip install uv", { shell: true });
    } else {
      await execaCommand("curl -LsSf https://astral.sh/uv/install.sh | sh", {
        shell: true,
      });
    }
  },
};

export async function checkDependencies(required: string[]): Promise<boolean> {
  const s = spinner();
  s.start("🔍 Checking system dependencies...");

  const missing: string[] = [];

  for (const cmd of required) {
    try {
      await execaCommand(`${cmd} --version`, { shell: true });
    } catch {
      missing.push(cmd);
    }
  }

  if (missing.length === 0) {
    s.stop("✅ All dependencies are installed.");
    return true;
  }

  s.stop("⚠️ Some dependencies are missing.");

  for (const cmd of missing) {
    // Unsupported or unknown tool
    if (!(cmd in installCommands)) {
      outro(`${color.red(cmd)} is required but cannot be auto-installed. Please install it manually.`);
      continue;
    }

    const install = await confirm({
      message: `${color.yellow(cmd)} is missing. Do you want to install it now?`,
      initialValue: true,
    });

    if (!install) {
      outro(`❌ Setup aborted. ${cmd} is required.`);
      return false;
    }

    // Try install
    const s2 = spinner();
    s2.start(`Installing ${cmd}...`);

    try {
      await installCommands[cmd]();
      s2.stop(`✅ ${cmd} installed.`);
    } catch (err) {
      s2.stop(`❌ Failed to install ${cmd}.`);
      outro(getMsg(err));
      return false;
    }
  }

  return true;
}

// Utility to safely unwrap error messages
function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
