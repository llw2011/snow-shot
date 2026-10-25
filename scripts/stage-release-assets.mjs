#!/usr/bin/env node

/** Normalize Tauri bundle output into the names consumed by release-manifest. */

import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const KINDS = new Set([
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-standard",
  "windows-fixed",
  "windows-offline",
]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) fail(`Missing value for --${key}`);
    options.set(key, next);
    index += 1;
  }
  return options;
}

function required(options, name) {
  const value = options.get(name);
  if (!value) fail(`Missing required option --${name}`);
  return value;
}

function projectPath(value) {
	return resolve(repositoryRoot, value);
}

async function filesUnder(directory) {
  const result = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) result.push(path);
    }
  }
  await visit(directory);
  return result;
}

function one(files, predicate, description) {
  const matches = files.filter(predicate);
  if (matches.length !== 1) {
    fail(`Expected exactly one ${description}, found ${matches.length}: ${matches.map((path) => basename(path)).join(", ")}`);
  }
  return matches[0];
}

function outputNames(kind, version) {
  if (kind === "darwin-aarch64" || kind === "darwin-x86_64") {
    const assetArch = kind === "darwin-x86_64" ? "darwin-x64" : kind;
    return {
      archive: `Snow.Shot_${version}_${assetArch}.app.tar.gz`,
      dmg: `Snow.Shot_${version}_${assetArch}.dmg`,
    };
  }
  const suffix = kind === "windows-standard" ? "setup" : kind === "windows-fixed" ? "webview_setup" : "offline_setup";
  return { installer: `Snow.Shot_${version}_windows-x64_${suffix}.exe` };
}

function hasVersion(path, version) {
	const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?:^|[_-])${escaped}(?:[_-]|$)`).test(basename(path));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
	const bundleDirectory = projectPath(required(options, "bundle-dir"));
	const outputDirectory = projectPath(required(options, "output"));
  const kind = required(options, "kind");
  const version = required(options, "version");
  if (!KINDS.has(kind)) fail(`Unsupported kind: ${kind}`);
  if (!/^\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$/.test(version)) fail(`Invalid version: ${version}`);
  if (!(await stat(bundleDirectory)).isDirectory()) fail(`Bundle directory is not a directory: ${bundleDirectory}`);
  if (await stat(outputDirectory).then(() => true, () => false)) {
    fail(`Output directory already exists; use a fresh staging directory: ${outputDirectory}`);
  }
  await mkdir(outputDirectory, { recursive: true });
  const files = await filesUnder(bundleDirectory);
  const names = outputNames(kind, version);
  const copied = [];
  const copy = async (source, targetName) => {
    const destination = join(outputDirectory, targetName);
    await copyFile(source, destination);
    copied.push(targetName);
  };

	if (kind.startsWith("darwin-")) {
		const archive = one(files, (path) => path.endsWith(".app.tar.gz") && hasVersion(path, version), "macOS updater archive");
		const signature = `${archive}.sig`;
		const signaturePath = one(files, (path) => path === signature, "macOS updater signature");
		const dmg = one(files, (path) => extname(path).toLowerCase() === ".dmg" && hasVersion(path, version), "macOS DMG");
    await copy(archive, names.archive);
    await copy(signaturePath, `${names.archive}.sig`);
    await copy(dmg, names.dmg);
  } else {
    // Each flavor builds in an isolated matrix job, so the source NSIS name is
    // intentionally generic. The flavor-specific name is assigned only here.
		const installer = one(
			files,
			(path) => extname(path).toLowerCase() === ".exe" && hasVersion(path, version),
			`${kind} Windows installer`,
		);
    await copy(installer, names.installer);
    if (kind === "windows-standard") {
      const signaturePath = one(files, (path) => path === `${installer}.sig`, "Windows updater signature");
      await copy(signaturePath, `${names.installer}.sig`);
    }
  }
  console.log(JSON.stringify({ kind, version, outputDirectory, assets: copied }, null, 2));
}

main().catch((error) => {
  console.error(`stage-release-assets: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
