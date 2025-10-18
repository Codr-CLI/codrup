/**
 * @fileoverview Codr CLI Update Module
 * Manages the update process for Codr CLI by checking for new versions,
 * downloading updated files, and refreshing the global npm installation.
 * Performs intelligent version comparison to avoid unnecessary updates.
 * @module commands/update
 */

import { intro, outro, spinner } from "@clack/prompts";
import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import color from "picocolors";

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
 * @returns The complete download URL for the release binary
 */
const RELEASE_FILE_URL = (version: string) => 
  `https://github.com/${GITHUB_REPO}/releases/download/${version}/index.js`;

/**
 * URL for fetching the latest package.json from the main branch
 */
const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;

/**
 * Installation metadata structure stored in meta.json
 * Contains version information and installation details
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
 * Custom error class for update-related failures
 * Provides context about what went wrong during the update process
 */
class UpdateError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "UpdateError";
  }
}

/**
 * Main update orchestrator function that manages the entire update workflow
 * Checks current version, fetches latest version, compares them, and performs
 * update if needed. Handles all file downloads and global npm reinstallation.
 * 
 * @throws {UpdateError} When any step of the update process fails
 * @returns Promise that resolves when update completes or is skipped
 */
export async function runUpdate(): Promise<void> {
  intro(`${color.bgBlue(color.black(" codr update "))}`);

  const metadata = await validateInstallation();
  const currentVersion = metadata.version;

  try {
    const latestVersion = await fetchLatestVersion();
    
    if (currentVersion === latestVersion) {
      outro(`${color.green("Already up to date!")} Running version ${color.cyan(currentVersion)}`);
      return;
    }

    await updateCodrFiles(metadata.installPath, latestVersion);
    await reinstallGlobally(metadata.installPath);
    await persistVersionUpdate(metadata, latestVersion);

    outro(`${color.green("codr updated successfully!")} ${color.dim(`v${currentVersion}`)} → ${color.cyan(`v${latestVersion}`)}

You can now run:
  ${color.cyan("codr")} — from anywhere ✨
`);
  } catch (error) {
    throw new UpdateError("Update process failed", error);
  }
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
    outro("✕ codr is not installed. Run setup first.");
    process.exit(1);
  }

  return readMetadata();
}

/**
 * Reads and parses installation metadata from constant location
 * Always reads from ~/.codr/.metadata.json regardless of install path
 * Exits process if metadata file is missing or corrupted
 * 
 * @returns Parsed metadata object containing installation details
 * @throws {UpdateError} If .metadata.json is missing
 */
function readMetadata(): SetupMetadata {
  try {
    if (!fs.existsSync(METADATA_PATH)) {
      throw new UpdateError("Missing .metadata.json file");
    }

    const raw = fs.readFileSync(METADATA_PATH, "utf-8");
    return JSON.parse(raw) as SetupMetadata;
  } catch (error) {
    outro("✕ Failed to read installation metadata.");
    console.error(formatError(error));
    process.exit(1);
  }
}

/**
 * Fetches the latest version number from GitHub repository
 * Downloads package.json from main branch to determine current release version
 * 
 * @returns Promise resolving to the latest version string
 * @throws {UpdateError} If version fetch fails or response is invalid
 */
async function fetchLatestVersion(): Promise<string> {
  const s = spinner();
  s.start("Checking for updates...");

  try {
    const response = await fetch(PACKAGE_JSON_URL);
    
    if (!response.ok) {
      throw new UpdateError(
        `Failed to fetch version info (${response.status} ${response.statusText})`
      );
    }

    const packageJson = await response.json() as PackageJson;
    s.stop("Version check complete.");
    
    return packageJson.version;
  } catch (error) {
    s.stop("✕ Failed to check for updates.");
    throw new UpdateError("Failed to fetch latest version", error);
  }
}

/**
 * Coordinates the download of all required updated files
 * Downloads binary and package.json concurrently for efficiency
 * 
 * @param installPath - Installation directory path
 * @param version - Target version to download
 * @returns Promise that resolves when all downloads complete
 * @throws {UpdateError} If any download fails
 */
async function updateCodrFiles(installPath: string, version: string): Promise<void> {
  await Promise.all([
    downloadLatestBinary(installPath, version),
    downloadLatestPackageJson(installPath),
  ]);
}

/**
 * Downloads the latest Codr CLI binary for the specified version
 * Uses temporary file for atomic replacement to prevent corruption
 * Downloads to .tmp file first, then renames on success
 * 
 * @param installPath - Installation directory path
 * @param version - Version string to download
 * @returns Promise that resolves when download and replacement complete
 * @throws {UpdateError} If download fails or response is invalid
 */
async function downloadLatestBinary(installPath: string, version: string): Promise<void> {
  const s = spinner();
  s.start("Downloading latest binary...");
  const indexPath = path.join(installPath, "index.js");
  const tmpPath = `${indexPath}.tmp`;

  try {
    const response = await fetch(RELEASE_FILE_URL(version));
    
    if (!response.ok) {
      throw new UpdateError(
        `Failed to download binary (${response.status} ${response.statusText})`
      );
    }

    if (!response.body) {
      throw new UpdateError("Response body is empty");
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(tmpPath, Buffer.from(arrayBuffer));
    
    fs.renameSync(tmpPath, indexPath);
    s.stop("Binary updated.");
  } catch (error) {
    await cleanup(tmpPath);
    s.stop("✕ Binary download failed.");
    throw new UpdateError("Failed to download binary", error);
  }
}

/**
 * Downloads the latest package.json from GitHub repository
 * Fetches from main branch and overwrites existing package.json
 * 
 * @param installPath - Installation directory path
 * @returns Promise that resolves when download and write complete
 * @throws {UpdateError} If download or write fails
 */
async function downloadLatestPackageJson(installPath: string): Promise<void> {
  const s = spinner();
  s.start("Updating package.json...");
  const pkgPath = path.join(installPath, "package.json");

  try {
    const response = await fetch(PACKAGE_JSON_URL);
    
    if (!response.ok) {
      throw new UpdateError(
        `Failed to download package.json (${response.status} ${response.statusText})`
      );
    }

    const packageJson = await response.json() as PackageJson;
    await fs.promises.writeFile(pkgPath, JSON.stringify(packageJson, null, 2));
    
    s.stop("package.json updated.");
  } catch (error) {
    s.stop("✕ package.json update failed.");
    throw new UpdateError("Failed to update package.json", error);
  }
}

/**
 * Reinstalls the package globally after update
 * Unlinks old installation and creates fresh npm link
 * Ensures the updated version is available globally
 * 
 * @param installPath - Installation directory path
 * @returns Promise that resolves when reinstallation completes
 * @throws {UpdateError} If global reinstallation fails
 */
async function reinstallGlobally(installPath: string): Promise<void> {
  const s = spinner();
  s.start("Refreshing global installation...");

  try {
    await unlinkExisting(installPath);
    await linkPackage(installPath);
    
    s.stop("Global installation refreshed.");
  } catch (error) {
    s.stop("✕ Global reinstall failed.");
    throw new UpdateError("Failed to reinstall globally", error);
  }
}

/**
 * Unlinks existing global npm package installation
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
 * Creates a global npm link for the package
 * Makes the codr command available system-wide
 * 
 * @param installPath - Installation directory path containing package.json
 * @returns Promise that resolves when linking completes
 * @throws Error if npm link command fails
 */
async function linkPackage(installPath: string): Promise<void> {
  await execa("npm", ["link"], { cwd: installPath });
}

/**
 * Updates the metadata file with new version and timestamp
 * Always writes to ~/.codr/.metadata.json regardless of install path
 * Preserves all other metadata fields while updating version info
 * Warns if metadata update fails but doesn't fail the entire update
 * 
 * @param metadata - Current metadata object
 * @param newVersion - New version string to persist
 * @returns Promise that resolves when metadata is written
 */
async function persistVersionUpdate(
  metadata: SetupMetadata,
  newVersion: string
): Promise<void> {
  try {
    const updatedMetadata: SetupMetadata = {
      ...metadata,
      version: newVersion,
      lastUpdated: new Date().toISOString(),
    };

    fs.mkdirSync(METADATA_DIR, { recursive: true });
    await fs.promises.writeFile(
      METADATA_PATH,
      JSON.stringify(updatedMetadata, null, 2)
    );
  } catch (error) {
    console.warn("⚠️ Failed to update metadata file");
    console.error(formatError(error));
  }
}

/**
 * Cleans up temporary files after failed operations
 * Removes multiple paths concurrently using Promise.allSettled
 * Ignores errors for paths that don't exist
 * 
 * @param paths - Variable number of file or directory paths to remove
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