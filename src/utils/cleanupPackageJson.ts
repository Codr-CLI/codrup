import fs from "node:fs";

export async function cleanupPackageJson(packageJsonPath: string) {
    const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const minimalPkg = {
      name: "codr",
      version: pkgData.version ?? "1.0.0",
      type: "module",
      bin: {
        codr: "./index.js"
      }
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(minimalPkg, null, 2));
  }
  