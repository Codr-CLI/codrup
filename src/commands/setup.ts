/**
 * @fileoverview Codr CLI Setup Module
 * Handles the complete installation process for the Codr CLI tool including
 * dependency validation, file downloads, configuration, and global npm linking.
 * @module commands/setup
 */

import { intro, outro, spinner, confirm, text } from "@clack/prompts";
import color from "picocolors";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "stream/promises";
import { execa } from "execa";
import { checkDependencies } from "../utils/checkSystem";
import { runConfig } from "./config";
import { welcomeScreen } from "../utils/welcomeScreen";
import { cleanupPackageJson } from "../utils/cleanupPackageJson";

/**
 * Default installation directory for Codr CLI
 */
const DEFAULT_INSTALL_PATH = path.join(os.homedir(), ".codr");

/**
 * Constant path for storing metadata regardless of installation location
 * Always stored at ~/.codr/.metadata.json for consistency
 */
const METADATA_DIR = path.join(os.homedir(), ".codr");
const METADATA_PATH = path.join(METADATA_DIR, ".metadata.json");

/**
 * GitHub repository identifier
 */
const GITHUB_REPO = "Codr-CLI/cli";

/**
 * Constructs the URL for downloading a specific version of the Codr binary
 * @param version - The version string to download
 * @returns The complete download URL
 */
const RELEASE_FILE_URL = (version: string) =>
  `https://github.com/${GITHUB_REPO}/releases/download/${version}/index.js`;

/**
 * URL for the latest package.json from the main branch
 */
const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;

/**
 * Metadata structure stored in meta.json after installation
 */
interface SetupMetadata {
  installPath: string;
  installDate: string;
  lastUpdated: string;
  platform: NodeJS.Platform;
  version: string;
  userConfig: Record<string, unknown>;
}

/**
 * Package.json structure with version information
 */
interface PackageJson {
  version: string;
  [key: string]: unknown;
}

/**
 * Custom error class for setup-related failures
 */
class SetupError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "SetupError";
  }
}

/**
 * Main setup orchestrator function that coordinates the entire installation process
 * Handles dependency validation, directory setup, file downloads, configuration,
 * and global npm linking with proper error handling and cleanup
 * 
 * @throws {SetupError} When any step of the setup process fails
 * @returns Promise that resolves when setup is complete
 */
export async function runSetup(): Promise<void> {
  intro(`${color.bgCyan(color.black(" codr setup "))}`);

  await validateDependencies();
  const installPath = await getInstallPath();

  try {
    await ensureCleanDirectory(installPath);
    const version = await downloadRequiredFiles(installPath);
    const configInfo = await setupConfiguration(installPath);
    await installGlobally(installPath);
    persistMetadata(installPath, version, configInfo);

    outro(
      `${color.green("Codr is ready!")} You can now run ${color.cyan("codr")} anywhere in your terminal.`
    );
  } catch (error) {
    await cleanup(installPath);
    throw error;
  }
}

/**
 * Validates that all required system dependencies are installed
 * Currently checks for Node.js availability
 * Exits the process if dependencies are missing
 * 
 * @returns Promise that resolves when validation completes
 */
async function validateDependencies(): Promise<void> {
  const hasRequiredDeps = await checkDependencies(["node"]);

  if (!hasRequiredDeps) {
    outro("Setup aborted due to missing dependencies.");
    process.exit(1);
  }
}

/**
 * Prompts user for installation directory path
 * Defaults to ~/.codr if no input provided
 * Exits gracefully if user cancels
 * 
 * @returns Promise resolving to the chosen installation path
 */
async function getInstallPath(): Promise<string> {
  const targetPath = await text({
    message: "Where should codr be installed?",
    placeholder: DEFAULT_INSTALL_PATH,
    initialValue: DEFAULT_INSTALL_PATH,
  });

  if (!targetPath || typeof targetPath === "symbol") {
    outro("Setup cancelled.");
    process.exit(0);
  }

  return targetPath;
}

/**
 * Ensures the target directory exists and is empty
 * Creates directory if it doesn't exist
 * Prompts for confirmation before overwriting existing directory
 * 
 * @param targetPath - Path to prepare for installation
 * @returns Promise that resolves when directory is ready
 */
async function ensureCleanDirectory(targetPath: string): Promise<void> {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }

  const shouldOverwrite = await confirm({
    message: "Directory already exists. Overwrite?",
    initialValue: false,
  });

  if (!shouldOverwrite || typeof shouldOverwrite === "symbol") {
    outro("Setup cancelled.");
    process.exit(0);
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.mkdirSync(targetPath, { recursive: true });
}

/**
 * Downloads and prepares all required files for installation
 * Downloads package.json to determine version, then downloads matching binary
 * Cleans up package.json after download
 * 
 * @param installPath - Target installation directory
 * @returns Promise resolving to the downloaded version string
 * @throws {SetupError} If any download fails
 */
async function downloadRequiredFiles(installPath: string): Promise<string> {
  const packageJsonPath = path.join(installPath, "package.json");
  const indexPath = path.join(installPath, "index.js");

  const packageJson = await downloadPackageJson(packageJsonPath);
  await downloadBinary(indexPath, packageJson.version);
  await cleanupPackageJson(packageJsonPath);

  return packageJson.version;
}

/**
 * Downloads package.json from GitHub repository
 * Fetches from main branch and writes to destination path
 * 
 * @param destPath - Destination file path for package.json
 * @returns Promise resolving to parsed package.json content
 * @throws {SetupError} If download or write fails
 */
async function downloadPackageJson(destPath: string): Promise<PackageJson> {
  const s = spinner();
  s.start("Downloading package.json...");

  try {
    const response = await fetch(PACKAGE_JSON_URL);

    if (!response.ok) {
      throw new SetupError(
        `Failed to download package.json (${response.status} ${response.statusText})`
      );
    }

    const packageJson = await response.json() as PackageJson;
    await fs.promises.writeFile(destPath, JSON.stringify(packageJson, null, 2));

    s.stop("package.json downloaded.");
    return packageJson;
  } catch (error) {
    s.stop("package.json download failed.");
    throw new SetupError("Failed to download package.json", error);
  }
}

/**
 * Downloads the Codr CLI binary for a specific version
 * Uses streaming to handle large files efficiently
 * Downloads to temporary file first, then renames on success
 * 
 * @param destPath - Final destination path for the binary
 * @param version - Version string to download
 * @returns Promise that resolves when download completes
 * @throws {SetupError} If download fails or response is invalid
 */
async function downloadBinary(destPath: string, version: string): Promise<void> {
  const s = spinner();
  s.start("Downloading codr binary...");
  const tmpPath = `${destPath}.tmp`;

  try {
    const response = await fetch(RELEASE_FILE_URL(version));

    if (!response.ok) {
      throw new SetupError(
        `Failed to download binary (${response.status} ${response.statusText})`
      );
    }

    if (!response.body) {
      throw new SetupError("Response body is empty");
    }

    const fileStream = fs.createWriteStream(tmpPath);
    await pipeline(response.body, fileStream);

    fs.renameSync(tmpPath, destPath);
    s.stop("codr binary downloaded.");
  } catch (error) {
    await cleanup(tmpPath);
    s.stop("codr binary download failed.");
    throw new SetupError("Failed to download binary", error);
  }
}

/**
 * Runs the configuration setup process
 * Allows user to configure Codr CLI settings
 * Continues with empty config if configuration fails
 * 
 * @param installPath - Installation directory path
 * @returns Promise resolving to user configuration object
 */
async function setupConfiguration(installPath: string): Promise<Record<string, unknown>> {
  try {
    return await runConfig(installPath);
  } catch (error) {
    outro("Skipping config setup due to error:");
    console.error(formatError(error));
    return {};
  }
}

/**
 * Installs Codr CLI globally via npm link
 * Validates installation files exist before linking
 * Unlinks any existing installation first
 * Displays welcome screen on success
 * 
 * @param installPath - Installation directory path
 * @returns Promise that resolves when global installation completes
 * @throws {SetupError} If linking fails
 */
async function installGlobally(installPath: string): Promise<void> {
  const s = spinner();
  s.start("Linking codr globally...");

  try {
    await validateInstallationFiles(installPath);
    await unlinkExisting(installPath);
    await linkPackage(installPath);

    s.stop("Codr installed globally.");
    welcomeScreen();
  } catch (error) {
    s.stop("Global linking failed.");
    throw new SetupError("Failed to link globally", error);
  }
}

/**
 * Validates that required installation files exist and are readable
 * Checks for index.js and package.json
 * 
 * @param installPath - Installation directory path
 * @returns Promise that resolves if all files are valid
 * @throws Error if any file is missing or unreadable
 */
async function validateInstallationFiles(installPath: string): Promise<void> {
  const indexPath = path.join(installPath, "index.js");
  const pkgPath = path.join(installPath, "package.json");

  await Promise.all([
    fs.promises.access(indexPath, fs.constants.R_OK),
    fs.promises.access(pkgPath, fs.constants.R_OK),
  ]);
}

/**
 * Unlinks any existing global npm package at the installation path
 * Silently ignores errors if package is not currently linked
 * 
 * @param installPath - Installation directory path
 * @returns Promise that resolves when unlink completes or fails silently
 */
async function unlinkExisting(installPath: string): Promise<void> {
  try {
    await execa("npm", ["unlink", "-g", installPath]);
  } catch {
    // Ignore errors if package is not currently linked
  }
}

/**
 * Links the package globally using npm link
 * 
 * @param installPath - Installation directory path containing package.json
 * @returns Promise that resolves when linking completes
 * @throws Error if npm link command fails
 */
async function linkPackage(installPath: string): Promise<void> {
  await execa("npm", ["link"], { cwd: installPath });
}

/**
 * Persists installation metadata to a constant location
 * Always stores metadata at ~/.codr/.metadata.json regardless of install path
 * Creates metadata directory if it doesn't exist
 * 
 * @param installPath - Actual installation directory path chosen by user
 * @param version - Installed version string
 * @param userConfig - User configuration object from setup
 */
function persistMetadata(
  installPath: string,
  version: string,
  userConfig: Record<string, unknown>
): void {
  const metadata: SetupMetadata = {
    installPath,
    installDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    platform: process.platform,
    version,
    userConfig,
  };

  fs.mkdirSync(METADATA_DIR, { recursive: true });
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
}

/**
 * Cleans up files or directories after failed operations
 * Removes multiple paths concurrently
 * Ignores errors for paths that don't exist
 * 
 * @param paths - Variable number of paths to remove
 * @returns Promise that resolves when all cleanup attempts complete
 */
async function cleanup(...paths: string[]): Promise<void> {
  await Promise.allSettled(
    paths.map(p =>
      fs.promises.rm(p, { recursive: true, force: true })
    )
  );
}

/**
 * Formats error objects into readable string messages
 * Handles Error instances and unknown error types
 * 
 * @param error - Error object to format
 * @returns Formatted error message string
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}