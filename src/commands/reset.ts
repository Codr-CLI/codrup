import { intro, confirm, spinner, outro } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import color from "picocolors";
import { runSetup } from "./setup";

const CODR_ROOT = path.join(os.homedir(), ".codr");

export async function runReset() {
  intro(`${color.bgRed(color.white(" codr reset "))}`);

  if (!fs.existsSync(CODR_ROOT)) {
    outro("⚠️ codr is not installed. Nothing to reset.");
    process.exit(0);
  }

  const confirmWipe = await confirm({
    message: `This will permanently delete ${color.yellow(CODR_ROOT)}. Continue?`,
    initialValue: false,
  });

  if (!confirmWipe) {
    outro("❌ Reset cancelled.");
    process.exit(0);
  }

  const s = spinner();
  s.start(`Deleting ${CODR_ROOT}...`);
  try {
    fs.rmSync(CODR_ROOT, { recursive: true, force: true });
    s.stop("✅ codr installation deleted.");
  } catch (err) {
    s.stop("❌ Failed to delete codr.");
    outro(getMsg(err));
    process.exit(1);
  }

  // Ask if user wants to reinstall
  const reinstall = await confirm({
    message: "Do you want to re-install codr now?",
    initialValue: true,
  });

  if (reinstall) {
    await runSetup();
  } else {
    outro("🧹 codr has been reset. You can re-install later using:");
    console.log(color.cyan("codr-installer --setup"));
  }
}

function getMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
