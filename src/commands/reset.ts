/**
 * @fileoverview Codr CLI Reset Module
 * Handles the complete removal and cleanup of Codr CLI installations including
 * global npm unlinking, installation directory deletion, and metadata cleanup.
 * Provides option to reinstall immediately after reset.
 * @module commands/reset
 */

import { intro, confirm, spinner, outro } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import color from "picocolors";
import { runSetup } from "./setup";

/**
 * Constant path for storing metadata regardless of installation location
 * Always stored at ~/.codr/.metadata.json for consistency
 */
const METADATA_PATH = path.join(os.homedir(), ".codr", ".metadata.json");

/**
 * Installation metadata structure stored in .metadata.json
 * Contains version information and installation details
 */
interface SetupMetadata {
  installPath: string;
  pythonVenvPath: string;
  installDate: string;
  lastUpdated: string;
  platform: NodeJS.Platform;
  version: string;
  userConfig: Record<string, unknown>;
}

/**
 * Custom error class for reset-related failures
 * Provides context about what went wrong during the reset process
 */
class ResetError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "ResetError";
  }
}

/**
 * Main reset orchestrator function that manages the entire reset workflow
 * Validates installation, confirms with user, removes all Codr files including
 * metadata, and optionally triggers reinstallation
 * 
 * @throws {ResetError} When any step of the reset process fails
 * @returns Promise that resolves when reset completes
 */
export async function runReset(): Promise<void> {
  intro(`${color.bgRed(color.white(" codr reset "))}`);

  const metadata = await validateInstallation();
  const shouldProceed = await confirmReset(metadata.installPath);

  if (!shouldProceed) {
    outro("✕ Reset cancelled.");
    process.exit(0);
  }

  await removeInstallation(metadata.installPath);
  await handleReinstallation();
}

/**
 * Validates that Codr CLI is properly installed
 * Checks for metadata file at constant location ~/.codr/.metadata.json
 * Exits process if installation is not found
 * 
 * @returns Promise resolving to the current installation metadata
 */
async function validateInstallation(): Promise<SetupMetadata> {
  if (!fs.existsSync(METADATA_PATH)) {
    outro("⚠️ codr is not installed or metadata is missing.");
    process.exit(0);
  }

  return readMetadata();
}

/**
 * Reads and parses installation metadata from constant location
 * Always reads from ~/.codr/.metadata.json regardless of install path
 * Exits process if metadata file is missing or corrupted
 * 
 * @returns Parsed metadata object containing installation details
 * @throws {ResetError} If .metadata.json is corrupted
 */
function readMetadata(): SetupMetadata {
  try {
    const raw = fs.readFileSync(METADATA_PATH, "utf-8");
    return JSON.parse(raw) as SetupMetadata;
  } catch (error) {
    outro("✕ Failed to read metadata file.");
    console.error(formatError(error));
    process.exit(1);
  }
}

/**
 * Prompts user to confirm the reset operation
 * Displays the installation path that will be deleted
 * 
 * @param installPath - Installation directory path that will be removed
 * @returns Promise resolving to true if user confirms, false otherwise
 */
async function confirmReset(installPath: string): Promise<boolean> {
  const response = await confirm({
    message: `This will permanently delete codr at:\n  ${color.yellow(installPath)}\nContinue?`,
    initialValue: false,
  });

  return response === true;
}

/**
 * Removes the Codr installation and cleans up all related files
 * Unlinks global npm package, deletes installation directory,
 * and removes metadata file from constant location
 * 
 * @param installPath - Installation directory path to remove
 * @returns Promise that resolves when removal completes
 * @throws {ResetError} If removal fails
 */
async function removeInstallation(installPath: string): Promise<void> {
  const s = spinner();
  s.start(`Removing installation at ${installPath}...`);

  try {
    await unlinkGlobalPackage(installPath);
    await deleteInstallationDirectory(installPath);
    await deleteMetadataFile();
    
    s.stop("✓ codr installation removed.");
  } catch (error) {
    s.stop("✕ Failed to remove codr installation.");
    throw new ResetError("Installation removal failed", error);
  }
}

/**
 * Unlinks the global npm package installation
 * Uses dynamic import for execa to avoid loading it unnecessarily
 * Silently ignores errors if package is not currently linked
 * 
 * @param installPath - Installation directory path
 * @returns Promise that resolves when unlink completes or fails silently
 */
async function unlinkGlobalPackage(installPath: string): Promise<void> {
  try {
    const { execa } = await import("execa");
    await execa("npm", ["unlink", "-g", installPath]);
  } catch {
    // Ignore errors if package is not currently linked
  }
}

/**
 * Deletes the installation directory and all its contents
 * Recursively removes all files and subdirectories
 * 
 * @param installPath - Installation directory path to remove
 * @returns Promise that resolves when deletion completes
 * @throws {ResetError} If deletion fails
 */
async function deleteInstallationDirectory(installPath: string): Promise<void> {
  try {
    await fs.promises.rm(installPath, { recursive: true, force: true });
  } catch (error) {
    throw new ResetError("Failed to delete installation directory", error);
  }
}

/**
 * Deletes the metadata file from constant location
 * Removes ~/.codr/.metadata.json to clean up tracking information
 * Silently succeeds if file doesn't exist
 * 
 * @returns Promise that resolves when deletion completes
 * @throws {ResetError} If deletion fails for reasons other than file not existing
 */
async function deleteMetadataFile(): Promise<void> {
  try {
    if (fs.existsSync(METADATA_PATH)) {
      await fs.promises.rm(METADATA_PATH, { force: true });
    }
  } catch (error) {
    throw new ResetError("Failed to delete metadata file", error);
  }
}

/**
 * Handles the reinstallation workflow after reset
 * Prompts user to decide whether to reinstall immediately
 * Triggers setup process if confirmed, otherwise shows instructions
 * 
 * @returns Promise that resolves when user makes their choice
 */
async function handleReinstallation(): Promise<void> {
  const shouldReinstall = await confirmReinstallation();

  if (shouldReinstall) {
    await runSetup();
  } else {
    displayReinstallInstructions();
  }
}

/**
 * Prompts user to confirm immediate reinstallation
 * Defaults to true as most users want to reinstall after reset
 * 
 * @returns Promise resolving to true if user wants to reinstall, false otherwise
 */
async function confirmReinstallation(): Promise<boolean> {
  const response = await confirm({
    message: "Do you want to re-install codr now?",
    initialValue: true,
  });

  return response === true;
}

/**
 * Displays instructions for manual reinstallation
 * Shows the command user can run to reinstall Codr later
 */
function displayReinstallInstructions(): void {
  outro(`🧹 codr has been reset. You can re-install later using:
  ${color.cyan("codrup --setup")}`);
}

/**
 * Formats error objects into readable string messages
 * Extracts message from Error instances or converts unknown types to string
 * 
 * @param error - Error object or unknown type to format
 * @returns Formatted error message string
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}