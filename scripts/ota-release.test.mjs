#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  COMPATIBILITY_PLATFORMS,
  REQUIRED_PLATFORMS,
  expectedAssets,
  isMatchingRun,
  parseArgs,
  sourceVersions,
  validateChecksumsIndex,
  validateManifest,
  validateTag,
  workflowSafety,
} from "./ota-release.mjs";

const version = "1.2.3-beta.1";
const tag = `v${version}`;
const baseUrl = `https://github.com/llw2011/snow-shot/releases/download/${tag}`;

function manifestFixture() {
  const archives = {
    "darwin-aarch64": `Snow.Shot_${version}_darwin-aarch64.app.tar.gz`,
    "darwin-x86_64": `Snow.Shot_${version}_darwin-x64.app.tar.gz`,
    "windows-x86_64": `Snow.Shot_${version}_windows-x64_setup.exe`,
  };
  const platforms = Object.fromEntries(
    Object.entries(archives).map(([platform, archive]) => [platform, {
      signature: `${platform}-signature`,
      url: `${baseUrl}/${encodeURIComponent(archive)}`,
    }]),
  );
  return {
    version,
    pub_date: "2026-08-20T00:00:00.000Z",
    notes: "test",
    platforms,
  };
}

function checksumFixture() {
  const names = expectedAssets(version).filter((name) => name !== "latest.json");
  return Object.fromEntries(names.map((name) => [name, "a".repeat(64)]));
}

function testArgsAndTags() {
  const parsed = parseArgs(["plan", "--tag", tag, "--retry-failed", "--max-retries=2"]);
  assert.equal(parsed.command, "plan");
  assert.equal(parsed.options.get("tag"), tag);
  assert.equal(parsed.options.get("retry-failed"), "true");
  assert.equal(parsed.options.get("max-retries"), "2");
  assert.equal(validateTag(tag), version);
  assert.throws(() => validateTag("1.2.3"), /Invalid release tag/);
  assert.throws(() => validateTag("v1.2"), /Invalid release tag/);
}

function testAssetsAndManifest() {
  assert.equal(expectedAssets(version).length, 11);
  assert.equal(expectedAssets(version, { includeChecksums: true }).length, 12);
  const manifest = manifestFixture();
  assert.doesNotThrow(() => validateManifest(manifest, tag, version, baseUrl));
  const aliasTargets = {
    "darwin-aarch64-app": "darwin-aarch64",
    "darwin-x86_64-app": "darwin-x86_64",
    "windows-x86_64-nsis": "windows-x86_64",
  };
  for (const alias of COMPATIBILITY_PLATFORMS) manifest.platforms[alias] = manifest.platforms[aliasTargets[alias]];
  assert.doesNotThrow(() => validateManifest(manifest, tag, version, baseUrl));
  const badUrl = structuredClone(manifest);
  badUrl.platforms["windows-x86_64"].url = "https://example.invalid/installer.exe";
  assert.throws(() => validateManifest(badUrl, tag, version, baseUrl), /Manifest URL/);
  const badSignature = structuredClone(manifest);
  badSignature.platforms["darwin-aarch64"].signature = "";
  assert.throws(() => validateManifest(badSignature, tag, version, baseUrl), /signature is empty/);
}

function testChecksums() {
  const checksums = checksumFixture();
  const assetNames = new Set(expectedAssets(version));
  assert.doesNotThrow(() => validateChecksumsIndex(checksums, assetNames, version));
  const missing = { ...checksums };
  delete missing[Object.keys(missing)[0]];
  assert.throws(() => validateChecksumsIndex(missing, assetNames, version), /asset set mismatch/);
  const badDigest = { ...checksums, [Object.keys(checksums)[0]]: "bad" };
  assert.throws(() => validateChecksumsIndex(badDigest, assetNames, version), /invalid SHA-256/);
}

function testWorkflowSafety() {
  const safe = workflowSafety(`
    run-name: Release \${{ inputs.version }}
    on:
      workflow_dispatch:
        inputs:
          version:
            required: true
    jobs:
      publish-release:
        permissions:
          contents: write
  `);
  assert.equal(safe.safe, true);
  const legacy = workflowSafety(`
    run-name: Release \${{ inputs.version }}
    on:
      workflow_dispatch:
        inputs:
          version: { required: true }
    jobs:
      create-release:
        run: git tag -a "$TAG" && git push origin "$TAG"
  `);
  assert.equal(legacy.safe, false);
  assert.match(legacy.reason, /git tag\/push/);
  const commented = workflowSafety(`
    # publish-release: this is documentation only
    on:
      workflow_dispatch:
        inputs:
          version: { required: true }
    jobs:
      build:
        run: echo build
  `);
  assert.equal(commented.safe, false);
}

function testRunMatching() {
  const common = {
    path: ".github/workflows/release.yml",
    head_branch: "main",
    event: "workflow_dispatch",
    created_at: "2026-08-20T00:00:00.000Z",
  };
  const since = new Date("2026-08-19T23:00:00.000Z");
  assert.equal(isMatchingRun({ ...common, run_name: `Release ${tag}` }, { tag, workflow: "release.yml", branch: "main", since }), true);
  assert.equal(isMatchingRun({ ...common, run_name: "Release v1.2.30" }, { tag, workflow: "release.yml", branch: "main", since }), false);
  assert.equal(isMatchingRun(common, { tag, workflow: "release.yml", branch: "main", since }), false);
  assert.equal(isMatchingRun(common, { tag, workflow: "release.yml", branch: "main", since, allowAnonymousDispatch: true }), false);
  assert.equal(isMatchingRun({ ...common, path: ".github/workflows/old-release.yml", run_name: `Release ${tag}` }, { tag, workflow: "release.yml" }), false);
  assert.equal(isMatchingRun({ ...common, path: undefined, run_name: `Release ${tag}` }, { tag, workflow: "release.yml" }), false);
  assert.equal(isMatchingRun({ ...common, path: ".github/workflows/other.yml" }, { tag, workflow: "release.yml", branch: "main", since }), false);
}

function testSourceVersions() {
  const files = {
    tauri: JSON.stringify({ version }),
    cargo: `[package]\nname = "snow-shot"\nversion = "${version}"\n`,
    lock: `[[package]]\nname = "snow-shot"\nversion = "${version}"\n`,
  };
  assert.equal(sourceVersions(files), version);
  assert.throws(() => sourceVersions({ ...files, lock: files.lock.replace(version, "1.2.4") }), /do not match/);
}

testArgsAndTags();
testAssetsAndManifest();
testChecksums();
testWorkflowSafety();
testRunMatching();
testSourceVersions();
console.log("ota release tests: ok");
