#!/usr/bin/env node

/**
 * Black-box tests for the release staging and updater-manifest helpers.
 *
 * The test intentionally uses only Node's standard library.  It creates a
 * temporary bundle/assets tree, invokes each CLI in a child process, and
 * checks both successful output and the important fail-closed paths.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stageScript = join(repositoryRoot, "scripts", "stage-release-assets.mjs");
const manifestScript = join(repositoryRoot, "scripts", "release-manifest.mjs");
const version = "1.2.3-beta.1";
const tag = `v${version}`;

function cli(script, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
      resolveResult({ status, signal, stdout, stderr, output: `${stdout}${stderr}` });
    });
  });
}

async function writeFixture(path, contents) {
  await writeFile(path, contents);
}

async function makeBundle(root, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
}

async function assertSuccess(result, label) {
  assert.equal(result.status, 0, `${label} failed:\n${result.output}`);
}

async function assertFailure(result, message, label) {
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded:\n${result.output}`);
  assert.match(
    result.output,
    new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label}: ${result.output}`,
  );
}

async function fileNames(directory) {
  return (await readdir(directory)).sort();
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function runStage(kind, bundleRoot, stagingRoot) {
  const output = join(stagingRoot, kind);
  const result = await cli(stageScript, [
    "--bundle-dir",
    bundleRoot,
    "--output",
    output,
    "--kind",
    kind,
    "--version",
    version,
  ]);
  return { result, output };
}

async function testStage() {
  const root = await mkdtemp(join(tmpdir(), "snow-shot-stage-test-"));
  try {
    const stagingRoot = join(root, "staged");
    const fixtures = {
      "darwin-aarch64": {
        "nested/Snow.Shot_1.2.3-beta.1_aarch64.app.tar.gz": "arm archive",
        "nested/Snow.Shot_1.2.3-beta.1_aarch64.app.tar.gz.sig": "  arm signature\n",
        "nested/Snow.Shot_1.2.3-beta.1_aarch64.dmg": "arm dmg",
      },
      "darwin-x86_64": {
        "bundle/Snow.Shot_1.2.3-beta.1_x86_64.app.tar.gz": "intel archive",
        "bundle/Snow.Shot_1.2.3-beta.1_x86_64.app.tar.gz.sig": "intel signature",
        "bundle/Snow.Shot_1.2.3-beta.1_x86_64.dmg": "intel dmg",
      },
      "windows-standard": {
        [`release/Snow.Shot_${version}_x64-setup.exe`]: "windows installer",
        [`release/Snow.Shot_${version}_x64-setup.exe.sig`]: "windows signature",
      },
      "windows-fixed": {
        [`release/Snow.Shot_${version}_x64-fixed.exe`]: "fixed installer",
      },
      "windows-offline": {
        [`release/Snow.Shot_${version}_x64-offline.exe`]: "offline installer",
      },
    };

    for (const [kind, files] of Object.entries(fixtures)) {
      const bundle = join(root, "bundles", kind);
      await makeBundle(bundle, files);
      const { result, output } = await runStage(kind, bundle, stagingRoot);
      await assertSuccess(result, `stage ${kind}`);
      const names = await fileNames(output);
      if (kind === "darwin-aarch64") {
        assert.deepEqual(names, [
          `Snow.Shot_${version}_darwin-aarch64.app.tar.gz`,
          `Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`,
          `Snow.Shot_${version}_darwin-aarch64.dmg`,
        ]);
      } else if (kind === "darwin-x86_64") {
        assert.deepEqual(names, [
          `Snow.Shot_${version}_darwin-x64.app.tar.gz`,
          `Snow.Shot_${version}_darwin-x64.app.tar.gz.sig`,
          `Snow.Shot_${version}_darwin-x64.dmg`,
        ]);
      } else if (kind === "windows-standard") {
        assert.deepEqual(names, [
          `Snow.Shot_${version}_windows-x64_setup.exe`,
          `Snow.Shot_${version}_windows-x64_setup.exe.sig`,
        ]);
      } else if (kind === "windows-fixed") {
        assert.deepEqual(names, [`Snow.Shot_${version}_windows-x64_webview_setup.exe`]);
      } else {
        assert.deepEqual(names, [`Snow.Shot_${version}_windows-x64_offline_setup.exe`]);
      }
    }

    const existingBundle = join(root, "bundles", "windows-fixed");
    const existingOutput = join(stagingRoot, "windows-fixed");
    const existingResult = await cli(stageScript, [
      "--bundle-dir",
      existingBundle,
      "--output",
      existingOutput,
      "--kind",
      "windows-fixed",
      "--version",
      version,
    ]);
    await assertFailure(existingResult, "Output directory already exists", "stage existing output");

    const staleBundle = join(root, "bundles", "stale");
    await makeBundle(staleBundle, {
      "old/Snow.Shot_0.9.0_x64-fixed.exe": "old installer",
      [`current/Snow.Shot_${version}_x64-fixed.exe`]: "current installer",
    });
    const staleOutput = join(stagingRoot, "stale");
    const staleResult = await cli(stageScript, [
      "--bundle-dir",
      staleBundle,
      "--output",
      staleOutput,
      "--kind",
      "windows-fixed",
      "--version",
      version,
    ]);
    await assertSuccess(staleResult, "stage current version with stale bundle");
    assert.deepEqual(await fileNames(staleOutput), [`Snow.Shot_${version}_windows-x64_webview_setup.exe`]);

    const ambiguousBundle = join(root, "bundles", "ambiguous");
    await makeBundle(ambiguousBundle, {
      "one.exe": "one",
      "two.exe": "two",
    });
    const ambiguousResult = await cli(stageScript, [
      "--bundle-dir",
      ambiguousBundle,
      "--output",
      join(stagingRoot, "ambiguous"),
      "--kind",
      "windows-fixed",
      "--version",
      version,
    ]);
    await assertFailure(ambiguousResult, "Expected exactly one windows-fixed Windows installer", "stage ambiguous input");

    const badVersionResult = await cli(stageScript, [
      "--bundle-dir",
      existingBundle,
      "--output",
      join(stagingRoot, "bad-version"),
      "--kind",
      "windows-fixed",
      "--version",
      "1.2",
    ]);
    await assertFailure(badVersionResult, "Invalid version", "stage invalid version");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function testManifest() {
  const root = await mkdtemp(join(tmpdir(), "snow-shot-manifest-test-"));
  try {
    const assets = join(root, "assets");
    await makeBundle(assets, {
      [`Snow.Shot_${version}_darwin-aarch64.app.tar.gz`]: "arm archive",
      [`Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`]: "arm signature\n",
      [`Snow.Shot_${version}_darwin-x64.app.tar.gz`]: "intel archive",
      [`Snow.Shot_${version}_darwin-x64.app.tar.gz.sig`]: "intel signature",
      [`Snow.Shot_${version}_windows-x64_setup.exe`]: "windows installer",
      [`Snow.Shot_${version}_windows-x64_setup.exe.sig`]: "windows signature",
    });
    const manifestPath = join(root, "latest.json");
    const checksumsPath = join(root, "checksums.json");
    const baseUrl = "https://example.test/releases/v1";
    const generated = await cli(manifestScript, [
      "generate",
      "--tag",
      tag,
      "--assets-dir",
      assets,
      "--output",
      manifestPath,
      "--checksums",
      checksumsPath,
      "--base-url",
      baseUrl,
      "--pub-date",
      "2026-08-11T00:00:00.000Z",
      "--notes",
      "test release",
    ]);
    await assertSuccess(generated, "manifest generate");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const checksums = JSON.parse(await readFile(checksumsPath, "utf8"));
    assert.equal(manifest.version, version);
    assert.equal(manifest.notes, "test release");
    assert.equal(manifest.pub_date, "2026-08-11T00:00:00.000Z");
    assert.deepEqual(Object.keys(manifest.platforms).sort(), [
      "darwin-aarch64",
      "darwin-x86_64",
      "windows-x86_64",
    ]);
    assert.equal(
      manifest.platforms["darwin-aarch64"].url,
      `${baseUrl}/Snow.Shot_${version}_darwin-aarch64.app.tar.gz`,
    );
    assert.equal(manifest.platforms["darwin-aarch64"].signature, "arm signature");
    assert.equal(
      checksums[`Snow.Shot_${version}_darwin-aarch64.app.tar.gz`],
      await sha256(join(assets, `Snow.Shot_${version}_darwin-aarch64.app.tar.gz`)),
    );

    const verifiedWithChecksums = await cli(manifestScript, [
      "verify",
      "--tag",
      tag,
      "--manifest",
      manifestPath,
      "--assets-dir",
      assets,
      "--checksums",
      checksumsPath,
      "--base-url",
      baseUrl,
      "--json",
    ]);
    await assertSuccess(verifiedWithChecksums, "manifest verify with checksums");
    assert.equal(JSON.parse(verifiedWithChecksums.stdout).checksumsVerified, true);
    assert.deepEqual(Object.keys(checksums).sort(), [
      "Snow.Shot_1.2.3-beta.1_darwin-aarch64.app.tar.gz",
      "Snow.Shot_1.2.3-beta.1_darwin-aarch64.app.tar.gz.sig",
      "Snow.Shot_1.2.3-beta.1_darwin-x64.app.tar.gz",
      "Snow.Shot_1.2.3-beta.1_darwin-x64.app.tar.gz.sig",
      "Snow.Shot_1.2.3-beta.1_windows-x64_setup.exe",
      "Snow.Shot_1.2.3-beta.1_windows-x64_setup.exe.sig",
    ]);

    const verified = await cli(manifestScript, [
      "verify",
      "--tag",
      tag,
      "--manifest",
      manifestPath,
      "--assets-dir",
      assets,
      "--checksums",
      checksumsPath,
      "--base-url",
      baseUrl,
      "--json",
    ]);
    await assertSuccess(verified, "manifest verify");
    const summary = JSON.parse(verified.stdout);
    assert.deepEqual(summary.requiredPlatforms, ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]);
    assert.deepEqual(summary.extraPlatforms, []);
    assert.equal(summary.checksumsVerified, true);

    const compatibilityManifest = {
      ...manifest,
      platforms: {
        ...manifest.platforms,
        "darwin-aarch64-app": manifest.platforms["darwin-aarch64"],
        "darwin-x86_64-app": manifest.platforms["darwin-x86_64"],
        "windows-x86_64-nsis": manifest.platforms["windows-x86_64"],
      },
    };
    const compatibilityPath = join(root, "compatibility.json");
    await writeFile(compatibilityPath, `${JSON.stringify(compatibilityManifest)}\n`, "utf8");
    const compatibility = await cli(manifestScript, [
      "verify",
      "--tag",
      tag,
      "--manifest",
      compatibilityPath,
      "--base-url",
      baseUrl,
      "--json",
    ]);
    await assertSuccess(compatibility, "manifest compatibility aliases");
    assert.deepEqual(JSON.parse(compatibility.stdout).extraPlatforms.sort(), [
      "darwin-aarch64-app",
      "darwin-x86_64-app",
      "windows-x86_64-nsis",
    ]);

    const mismatchedTag = await cli(manifestScript, [
      "verify",
      "--tag",
      "v1.2.4",
      "--manifest",
      manifestPath,
      "--checksums",
      checksumsPath,
      "--base-url",
      baseUrl,
    ]);
    await assertFailure(mismatchedTag, "Manifest version 1.2.3-beta.1 does not match 1.2.4", "manifest version mismatch");

    const tamperedSignature = join(assets, `Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`);
    await writeFixture(tamperedSignature, "tampered signature\n");
    const tampered = await cli(manifestScript, [
      "verify",
      "--tag",
      tag,
      "--manifest",
      manifestPath,
      "--assets-dir",
      assets,
      "--base-url",
      baseUrl,
    ]);
    await assertFailure(tampered, "Signature mismatch for darwin-aarch64", "manifest tampered signature");

    const incomplete = join(root, "incomplete");
    await makeBundle(incomplete, {
      [`Snow.Shot_${version}_darwin-aarch64.app.tar.gz`]: "only one platform",
      [`Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`]: "signature",
    });
    const incompleteResult = await cli(manifestScript, [
      "generate",
      "--tag",
      tag,
      "--assets-dir",
      incomplete,
      "--output",
      join(root, "incomplete.json"),
    ]);
    await assertFailure(incompleteResult, "Missing darwin-x86_64 assets", "manifest incomplete assets");

    const badUrlManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    badUrlManifest.platforms["windows-x86_64"].url = "https://evil.example/installer.exe";
    const badUrlPath = join(root, "bad-url.json");
    await writeFile(badUrlPath, `${JSON.stringify(badUrlManifest)}\n`, "utf8");
    const badUrl = await cli(manifestScript, [
      "verify",
      "--tag",
      tag,
      "--manifest",
      badUrlPath,
      "--base-url",
      baseUrl,
    ]);
    await assertFailure(badUrl, "Unexpected URL for windows-x86_64", "manifest unexpected URL");

    const unexpectedKeyManifest = {
      ...manifest,
      platforms: { ...manifest.platforms, "windows-x86_64-fixed": manifest.platforms["windows-x86_64"] },
    };
    const unexpectedKeyPath = join(root, "unexpected-key.json");
    await writeFile(unexpectedKeyPath, `${JSON.stringify(unexpectedKeyManifest)}\n`, "utf8");
    const unexpectedKey = await cli(manifestScript, [
      "verify",
      "--tag",
      tag,
      "--manifest",
      unexpectedKeyPath,
      "--base-url",
      baseUrl,
    ]);
    await assertFailure(unexpectedKey, "unexpected keys", "manifest unexpected platform key");

    const unknownAssets = join(root, "unknown-assets");
    await makeBundle(unknownAssets, {
      [`Snow.Shot_${version}_darwin-aarch64.app.tar.gz`]: "arm archive",
      [`Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`]: "arm signature",
      [`Snow.Shot_${version}_darwin-x64.app.tar.gz`]: "intel archive",
      [`Snow.Shot_${version}_darwin-x64.app.tar.gz.sig`]: "intel signature",
      [`Snow.Shot_${version}_windows-x64_setup.exe`]: "windows installer",
      [`Snow.Shot_${version}_windows-x64_setup.exe.sig`]: "windows signature",
      "unexpected-secret.txt": "must not be published",
    });
    const unknownAsset = await cli(manifestScript, [
      "generate",
      "--tag",
      tag,
      "--assets-dir",
      unknownAssets,
      "--output",
      join(root, "unknown-assets.json"),
    ]);
    await assertFailure(unknownAsset, "Unexpected staged release assets", "manifest unknown staged asset");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function main() {
  await testStage();
  await testManifest();
  console.log("release scripts tests: ok");
}

main().catch((error) => {
  console.error(`release scripts tests: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
