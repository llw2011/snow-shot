#!/usr/bin/env node

/**
 * Generate and verify the public Tauri updater manifest.
 *
 * This file intentionally uses only Node's standard library so the publish job
 * does not depend on jq, gh, Python, or a platform-specific shell.
 */

import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REPOSITORY = "llw2011/snow-shot";
const REQUIRED_PLATFORMS = ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"];
// Older tauri-action releases published these aliases alongside the canonical
// keys. They are harmless compatibility fields; new manifests never generate
// them, and any other unexpected key remains a hard failure.
const COMPATIBILITY_PLATFORMS = new Set([
  "darwin-aarch64-app",
  "darwin-x86_64-app",
  "windows-x86_64-nsis",
]);
const METADATA_ASSETS = new Set(["latest.json", "checksums.json"]);

function fail(message) {
  throw new Error(message);
}

function projectPath(value) {
  return resolve(repositoryRoot, value);
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = new Map();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }
    const equals = token.indexOf("=");
    if (equals >= 0) {
      options.set(token.slice(2, equals), token.slice(equals + 1));
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(key, next);
      index += 1;
    } else {
      options.set(key, "true");
    }
  }
  return { command, options };
}

function option(options, name, { required = false } = {}) {
  const value = options.get(name);
  if (required && (!value || value === "true")) {
    fail(`Missing required option --${name}`);
  }
  return value;
}

function validateTag(tag) {
  if (!/^v\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$/.test(tag)) {
    fail(`Invalid release tag: ${tag}`);
  }
}

function versionFor(tag, explicitVersion) {
  const version = explicitVersion || tag.slice(1);
  if (!/^\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`Invalid release version: ${version}`);
  }
  if (version !== tag.slice(1)) {
    fail(`Version ${version} does not match tag ${tag}`);
  }
  return version;
}

function defaultBaseUrl(tag) {
  return `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(tag)}`;
}

function normalizeBaseUrl(value) {
  const baseUrl = value.replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    fail(`Invalid base URL: ${value}`);
  }
  if (parsed.protocol !== "https:" || parsed.search || parsed.hash) {
    fail(`Base URL must be an HTTPS URL without query or fragment: ${value}`);
  }
  return baseUrl;
}

async function filesUnder(directory) {
  const result = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        result.push(path);
      }
    }
  }
  await visit(directory);
  return result;
}

function uniqueFile(files, name, description) {
  const matches = files.filter((path) => basename(path) === name);
  if (matches.length !== 1) {
    fail(`Expected exactly one ${description} named ${name}, found ${matches.length}`);
  }
  return matches[0];
}

function expectedNames(version) {
  return {
    "darwin-aarch64": {
      archive: `Snow.Shot_${version}_darwin-aarch64.app.tar.gz`,
      signature: `Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`,
    },
    "darwin-x86_64": {
      archive: `Snow.Shot_${version}_darwin-x64.app.tar.gz`,
      signature: `Snow.Shot_${version}_darwin-x64.app.tar.gz.sig`,
    },
    "windows-x86_64": {
      archive: `Snow.Shot_${version}_windows-x64_setup.exe`,
      signature: `Snow.Shot_${version}_windows-x64_setup.exe.sig`,
    },
  };
}

function allowedReleaseAssetNames(version) {
  const expected = expectedNames(version);
  return new Set([
    expected["darwin-aarch64"].archive,
    expected["darwin-aarch64"].signature,
    `Snow.Shot_${version}_darwin-aarch64.dmg`,
    expected["darwin-x86_64"].archive,
    expected["darwin-x86_64"].signature,
    `Snow.Shot_${version}_darwin-x64.dmg`,
    expected["windows-x86_64"].archive,
    expected["windows-x86_64"].signature,
    `Snow.Shot_${version}_windows-x64_webview_setup.exe`,
    `Snow.Shot_${version}_windows-x64_offline_setup.exe`,
  ]);
}

function rejectUnknownAssets(files, version) {
  const allowed = allowedReleaseAssetNames(version);
  const unknown = [...new Set(releaseAssetFiles(files).map((path) => basename(path)))].filter(
    (name) => !allowed.has(name),
  );
  if (unknown.length > 0) {
    fail(`Unexpected staged release assets: ${unknown.join(", ")}`);
  }
}

async function sha256(path) {
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex");
}

function releaseAssetFiles(files) {
  return files.filter((path) => !METADATA_ASSETS.has(basename(path)));
}

function validateChecksums(value, description = "checksums") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${description} must be a JSON object`);
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    fail(`${description} must contain at least one asset`);
  }
  for (const [name, digest] of entries) {
    if (!name || basename(name) !== name) {
      fail(`${description} contains an invalid asset name: ${name}`);
    }
    if (METADATA_ASSETS.has(name)) {
      fail(`${description} must not index metadata asset: ${name}`);
    }
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/i.test(digest)) {
      fail(`${description} contains an invalid SHA-256 for ${name}`);
    }
  }
  return value;
}

async function fetchJson(url, description) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      fail(`${description} request failed: HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch (error) {
      fail(`Invalid ${description} JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      fail(`${description} request timed out after 30 seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requireUpdaterChecksumEntries(checksums, expected) {
  const requiredNames = [];
  for (const platform of REQUIRED_PLATFORMS) {
    requiredNames.push(expected[platform].archive, expected[platform].signature);
  }
  const missing = requiredNames.filter((name) => !Object.prototype.hasOwnProperty.call(checksums, name));
  if (missing.length > 0) {
    fail(`Checksums are missing updater assets: ${missing.join(", ")}`);
  }
}

async function readJsonSource(path, url, description) {
  if ((path && url) || (!path && !url)) {
    fail(`Specify exactly one of --${description} or --${description}-url`);
  }
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail(`Invalid ${description} URL: ${url}`);
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
      fail(`${description} URL must be an HTTPS URL without credentials, query or fragment: ${url}`);
    }
    return fetchJson(url, description);
  }
  try {
    return JSON.parse(await readFile(projectPath(path), "utf8"));
  } catch (error) {
    fail(`Invalid ${description} JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function generate(options) {
  const tag = option(options, "tag", { required: true });
  validateTag(tag);
  const version = versionFor(tag, option(options, "version"));
  const assetsDirectory = projectPath(option(options, "assets-dir", { required: true }));
  if (!(await stat(assetsDirectory)).isDirectory()) {
    fail(`Assets directory is not a directory: ${assetsDirectory}`);
  }
  const output = projectPath(option(options, "output", { required: true }));
  const baseUrl = normalizeBaseUrl(option(options, "base-url") || defaultBaseUrl(tag));
  const pubDate = option(options, "pub-date") || new Date().toISOString();
  const notes = option(options, "notes") || "";
  if (Number.isNaN(Date.parse(pubDate))) {
    fail(`Invalid publication date: ${pubDate}`);
  }
  const allFiles = await filesUnder(assetsDirectory);
  rejectUnknownAssets(allFiles, version);
  const names = new Map();
  for (const path of allFiles) {
    const name = basename(path);
    names.set(name, (names.get(name) || 0) + 1);
  }
  const expected = expectedNames(version);
  const platforms = {};
  const checksums = {};

  for (const platform of REQUIRED_PLATFORMS) {
    const { archive, signature } = expected[platform];
    if (!names.has(archive) || !names.has(signature)) {
      fail(`Missing ${platform} assets: ${archive} and ${signature}`);
    }
    const archivePath = uniqueFile(allFiles, archive, `${platform} updater archive`);
    const signaturePath = uniqueFile(allFiles, signature, `${platform} updater signature`);
    const signatureText = (await readFile(signaturePath, "utf8")).trim();
    if (!signatureText) {
      fail(`Empty signature: ${signature}`);
    }
    platforms[platform] = {
      signature: signatureText,
      url: `${baseUrl}/${encodeURIComponent(archive)}`,
    };
  }

  // checksums.json is a release-level integrity index. Hash every staged
  // asset, including DMGs and the fixed/offline Windows installers, but not
  // the two metadata files generated below (which would be self-referential).
  for (const path of releaseAssetFiles(allFiles).sort()) {
    const name = basename(path);
    if (Object.prototype.hasOwnProperty.call(checksums, name)) {
      fail(`Duplicate staged asset filename: ${name}`);
    }
    checksums[name] = await sha256(path);
  }

  const manifest = {
    version,
    notes,
    pub_date: pubDate,
    platforms,
  };
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const checksumPath = option(options, "checksums");
  if (checksumPath) {
    await writeFile(projectPath(checksumPath), `${JSON.stringify(checksums, null, 2)}\n`, "utf8");
  }
  console.log(`Generated ${output} for ${tag}: ${REQUIRED_PLATFORMS.join(", ")}`);
}

async function readManifest(options) {
  return readJsonSource(option(options, "manifest"), option(options, "manifest-url"), "manifest");
}

async function verify(options) {
  const tag = option(options, "tag", { required: true });
  validateTag(tag);
  const version = versionFor(tag, option(options, "version"));
  const baseUrl = normalizeBaseUrl(option(options, "base-url") || defaultBaseUrl(tag));
  const manifest = await readManifest(options);
  if (!manifest || typeof manifest !== "object") {
    fail("Manifest is not an object");
  }
  if (manifest.version !== version) {
    fail(`Manifest version ${manifest.version} does not match ${version}`);
  }
  if (typeof manifest.pub_date !== "string" || Number.isNaN(Date.parse(manifest.pub_date))) {
    fail("Manifest pub_date must be a valid ISO date string");
  }
  if (typeof manifest.notes !== "string") {
    fail("Manifest notes must be a string");
  }
  if (!manifest.platforms || typeof manifest.platforms !== "object" || Array.isArray(manifest.platforms)) {
    fail("Manifest platforms is missing");
  }

  const platformKeys = Object.keys(manifest.platforms);
  const missingPlatforms = REQUIRED_PLATFORMS.filter((key) => !platformKeys.includes(key));
  const unexpectedPlatforms = platformKeys.filter(
    (key) => !REQUIRED_PLATFORMS.includes(key) && !COMPATIBILITY_PLATFORMS.has(key),
  );
  if (missingPlatforms.length > 0) {
    fail(`Manifest platforms missing: ${missingPlatforms.join(", ")}`);
  }
  if (unexpectedPlatforms.length > 0) {
    fail(`Manifest platforms contain unexpected keys: ${unexpectedPlatforms.join(", ")}`);
  }

  const expected = expectedNames(version);
  const assetsDirectory = option(options, "assets-dir");
  const localFiles = assetsDirectory ? await filesUnder(projectPath(assetsDirectory)) : undefined;
  if (localFiles) rejectUnknownAssets(localFiles, version);
  const localNames = localFiles ? new Set(localFiles.map((path) => basename(path))) : undefined;
  const seenUrls = new Set();
  for (const platform of REQUIRED_PLATFORMS) {
    const entry = manifest.platforms[platform];
    if (!entry || typeof entry !== "object") {
      fail(`Missing manifest platform: ${platform}`);
    }
    if (typeof entry.signature !== "string" || !entry.signature.trim()) {
      fail(`Missing signature for ${platform}`);
    }
    const expectedUrl = `${baseUrl}/${encodeURIComponent(expected[platform].archive)}`;
    if (typeof entry.url !== "string" || entry.url !== expectedUrl) {
      fail(`Unexpected URL for ${platform}: ${entry.url}`);
    }
    let assetName;
    try {
      const parsedUrl = new URL(entry.url);
      if (parsedUrl.protocol !== "https:") fail(`Unexpected URL protocol for ${platform}`);
      assetName = decodeURIComponent(parsedUrl.pathname.split("/").pop());
    } catch (error) {
      fail(`Invalid URL for ${platform}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (assetName !== expected[platform].archive || seenUrls.has(assetName)) {
      fail(`Unexpected or duplicate asset URL for ${platform}: ${assetName}`);
    }
    seenUrls.add(assetName);
    if (localNames) {
      if (!localNames.has(assetName) || !localNames.has(`${assetName}.sig`)) {
        fail(`Local assets missing for ${platform}: ${assetName}`);
      }
    const signaturePath = uniqueFile(await filesUnder(projectPath(assetsDirectory)), `${assetName}.sig`, `${platform} local signature`);
      const localSignature = (await readFile(signaturePath, "utf8")).trim();
      if (localSignature !== entry.signature.trim()) {
        fail(`Signature mismatch for ${platform}`);
      }
    }
  }

  const checksumsPath = option(options, "checksums");
  const checksumsUrl = option(options, "checksums-url");
  let checksums;
  if (checksumsPath || checksumsUrl) {
    checksums = validateChecksums(
      await readJsonSource(checksumsPath, checksumsUrl, "checksums"),
    );
    requireUpdaterChecksumEntries(checksums, expected);
  }
  if (checksums && localFiles) {
    const expectedAssets = releaseAssetFiles(localFiles).map((path) => basename(path)).sort();
    const duplicateLocalAssets = expectedAssets.filter((name, index) => index > 0 && name === expectedAssets[index - 1]);
    if (duplicateLocalAssets.length > 0) {
      fail(`Duplicate local asset filename: ${duplicateLocalAssets[0]}`);
    }
    const indexedAssets = Object.keys(checksums).sort();
    const missing = expectedAssets.filter((name) => !indexedAssets.includes(name));
    const unexpected = indexedAssets.filter((name) => !expectedAssets.includes(name));
    if (missing.length > 0 || unexpected.length > 0) {
      const details = [];
      if (missing.length > 0) details.push(`missing: ${missing.join(", ")}`);
      if (unexpected.length > 0) details.push(`unexpected: ${unexpected.join(", ")}`);
      fail(`Checksums asset set mismatch (${details.join("; ")})`);
    }
    for (const path of releaseAssetFiles(localFiles)) {
      const name = basename(path);
      const actual = await sha256(path);
      if (actual.toLowerCase() !== checksums[name].toLowerCase()) {
        fail(`Checksum mismatch for ${name}`);
      }
    }
  }
  const summary = {
    version,
    tag,
    requiredPlatforms: REQUIRED_PLATFORMS,
    extraPlatforms: platformKeys.filter((key) => !REQUIRED_PLATFORMS.includes(key)),
    checksumsVerified: Boolean(checksums && localFiles),
  };
  console.log(options.get("json") === "true" ? JSON.stringify(summary) : `Manifest OK: ${JSON.stringify(summary)}`);
}

function help() {
  console.log(`Usage:\n  node scripts/release-manifest.mjs generate --tag vX.Y.Z --assets-dir DIR --output FILE [--checksums FILE]\n  node scripts/release-manifest.mjs verify --tag vX.Y.Z (--manifest FILE | --manifest-url URL) [--assets-dir DIR] [--checksums FILE | --checksums-url URL]\n`);
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "generate") await generate(options);
  else if (command === "verify") await verify(options);
  else help();
} catch (error) {
  console.error(`release-manifest: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
