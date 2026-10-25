#!/usr/bin/env node

/**
 * Snow Shot OTA release state machine.
 *
 * This is intentionally a local operator tool. It never creates or moves a
 * git tag, pushes a ref, pulls a branch, creates a branch, or cancels a remote
 * run. A remote write requires --confirm. Build artifacts are still produced
 * by GitHub Actions; this tool coordinates and verifies that run.
 */

import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const DEFAULT_REPOSITORY = "llw2011/snow-shot";
const DEFAULT_BRANCH = "main";
const DEFAULT_WORKFLOW = "release.yml";
const DEFAULT_STATE_DIR = join(homedir(), ".snow-shot", "ota-release");
const API_BASE = "https://api.github.com";
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$/;
const TAG_PATTERN = /^v\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$/;
const ACTIVE_STATES = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);
const RETRYABLE_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure"]);
const REQUIRED_PLATFORMS = ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"];
const COMPATIBILITY_PLATFORMS = new Set([
  "darwin-aarch64-app",
  "darwin-x86_64-app",
  "windows-x86_64-nsis",
]);
const COMPATIBILITY_PLATFORM_TARGETS = {
  "darwin-aarch64-app": "darwin-aarch64",
  "darwin-x86_64-app": "darwin-x86_64",
  "windows-x86_64-nsis": "windows-x86_64",
};
const DISCOVERY_DELAYS_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000];
const RERUN_DISCOVERY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

class ReleaseError extends Error {
  constructor(message, status = undefined, { uncertain = false } = {}) {
    super(message);
    this.name = "ReleaseError";
    this.status = status;
    this.uncertain = uncertain;
  }
}

function fail(message) {
  throw new ReleaseError(message);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function parseArgs(argv) {
  const values = [...argv];
  const command = values[0] && !values[0].startsWith("--") ? values.shift() : "help";
  const options = new Map();
  while (values.length > 0) {
    const token = values.shift();
    if (!token.startsWith("--")) fail(`Unexpected argument: ${token}`);
    const equals = token.indexOf("=");
    if (equals >= 0) {
      options.set(token.slice(2, equals), token.slice(equals + 1));
      continue;
    }
    const name = token.slice(2);
    const next = values[0];
    if (next && !next.startsWith("--")) options.set(name, values.shift());
    else options.set(name, "true");
  }
  return { command, options };
}

function option(options, name, fallback = undefined) {
  return options.has(name) ? options.get(name) : fallback;
}

function flag(options, name) {
  const value = option(options, name, undefined);
  if (value === undefined) return false;
  if (value === "false") return false;
  return true;
}

function requiredOption(options, name) {
  const value = option(options, name, undefined);
  if (!value || value === "true") fail(`Missing required option --${name}`);
  return value;
}

function parsePositiveInt(value, name, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) fail(`--${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) fail(`--${name} must be a positive integer`);
  return parsed;
}

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail(`Invalid GitHub repository: ${repository}`);
  return repository;
}

function validateWorkflow(workflow) {
  if (!/^[A-Za-z0-9_.-]+$/.test(workflow) || workflow.includes("..")) {
    fail(`Invalid workflow filename: ${workflow}`);
  }
  return workflow;
}

function validateTag(tag) {
  if (!TAG_PATTERN.test(tag)) fail(`Invalid release tag: ${tag}`);
  return tag.slice(1);
}

function defaultStateFile(tag) {
  const version = validateTag(tag);
  return join(DEFAULT_STATE_DIR, `v${version}.json`);
}

function assertSafeTokenFile(path) {
  if (basename(path).toLowerCase() === "github.txt") {
    fail("Refusing to read github.txt. Use gh auth or an environment token instead.");
  }
}

async function readState(path) {
  try {
    const value = JSON.parse(await readFile(resolve(path), "utf8"));
    if (!value || typeof value !== "object" || value.schema !== 1) {
      fail(`Invalid OTA state file: ${path}`);
    }
    return value;
  } catch (error) {
    if (error instanceof ReleaseError) throw error;
    fail(`Cannot read OTA state file ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeState(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ schema: 1, ...value }, null, 2)}\n`, "utf8");
  try {
    await rm(target, { force: true });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw new ReleaseError(`Cannot write OTA state file ${target}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return target;
}

function statePathFor(args) {
  return resolve(option(args.options || new Map(), "state-file", defaultStateFile(args.tag)));
}

async function acquireReleaseLock(args) {
  const lockPath = `${statePathFor(args)}.lock`;
  await mkdir(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFile(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, { encoding: "utf8", flag: "wx" });
      break;
    } catch (error) {
      if (!error || error.code !== "EEXIST") {
        fail(`Cannot acquire OTA operation lock ${lockPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      let lockInfo = null;
      try {
        lockInfo = JSON.parse(await readFile(lockPath, "utf8"));
      } catch {
        // A partially written lock is treated as active; do not race it.
      }
      const pid = Number(lockInfo?.pid);
      let alive = true;
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, 0);
        } catch (probeError) {
          if (probeError?.code === "ESRCH") alive = false;
        }
      }
      if (!alive && attempt === 0) {
        await rm(lockPath, { force: true });
        continue;
      }
      const owner = lockInfo ? `pid=${lockInfo.pid}, started=${lockInfo.startedAt}` : "owner unknown";
      fail(`Another OTA operation appears to be active (${lockPath}; ${owner}). Stop it or remove the stale lock deliberately before retrying.`);
    }
  }
  return async () => {
    await rm(lockPath, { force: true });
  };
}

function expectedAssets(version, { includeChecksums = false } = {}) {
  const assets = [
    `Snow.Shot_${version}_darwin-aarch64.app.tar.gz`,
    `Snow.Shot_${version}_darwin-aarch64.app.tar.gz.sig`,
    `Snow.Shot_${version}_darwin-aarch64.dmg`,
    `Snow.Shot_${version}_darwin-x64.app.tar.gz`,
    `Snow.Shot_${version}_darwin-x64.app.tar.gz.sig`,
    `Snow.Shot_${version}_darwin-x64.dmg`,
    `Snow.Shot_${version}_windows-x64_setup.exe`,
    `Snow.Shot_${version}_windows-x64_setup.exe.sig`,
    `Snow.Shot_${version}_windows-x64_webview_setup.exe`,
    `Snow.Shot_${version}_windows-x64_offline_setup.exe`,
    "latest.json",
  ];
  if (includeChecksums) assets.push("checksums.json");
  return assets;
}

function updaterAssetNames(version) {
  return {
    "darwin-aarch64": `Snow.Shot_${version}_darwin-aarch64.app.tar.gz`,
    "darwin-x86_64": `Snow.Shot_${version}_darwin-x64.app.tar.gz`,
    "windows-x86_64": `Snow.Shot_${version}_windows-x64_setup.exe`,
  };
}

function encodePath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function githubUrl(repository, path) {
  return `${API_BASE}/repos/${repository}${path}`;
}

let authToken = null;

async function loadToken(tokenFile) {
  if (tokenFile) {
    const path = resolve(tokenFile);
    assertSafeTokenFile(path);
    const fileInfo = await lstat(path).catch((error) => fail(`Cannot inspect token file: ${error instanceof Error ? error.message : String(error)}`));
    if (fileInfo.isSymbolicLink()) fail("Refusing to read a symbolic-link token file.");
    const rootProbe = spawnSync("git", ["-C", REPOSITORY_ROOT, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (rootProbe.status !== 0 || !rootProbe.stdout.trim()) fail("Cannot determine the repository root while checking the token file.");
    const root = resolve(rootProbe.stdout.trim());
    const relativePath = relative(root, path);
    const insideRepository = relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath);
    if (insideRepository) {
      const tracked = spawnSync("git", ["-C", root, "ls-files", "--error-unmatch", "--", relativePath.replaceAll("\\", "/")], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (tracked.status === 0) fail("Refusing to read a tracked token file.");
    }
    const contents = await readFile(path, "utf8");
    const token = contents.trim();
    if (!token || /\s/.test(token)) fail("The explicit token file is empty or contains whitespace.");
    authToken = token;
    return authToken;
  }

  const environmentToken = process.env.SNOWSHOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (environmentToken) {
    if (!environmentToken.trim() || /\s/.test(environmentToken.trim())) fail("The GitHub token environment variable contains whitespace.");
    authToken = environmentToken.trim();
    return authToken;
  }

  // gh auth token keeps credentials in the OS credential store and does not
  // require putting a token in a command-line argument.
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (gh.status === 0 && gh.stdout.trim()) {
    if (/\s/.test(gh.stdout.trim())) fail("gh auth token returned unexpected whitespace.");
    authToken = gh.stdout.trim();
  }
  return authToken;
}

function headers(bodyPresent = false) {
  const result = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "snow-shot-ota-release",
  };
  if (bodyPresent) result["Content-Type"] = "application/json";
  if (authToken) result.Authorization = `Bearer ${authToken}`;
  return result;
}

function retryAfterMs(response, fallbackMs) {
  const value = response.headers.get("retry-after");
  if (!value) return fallbackMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(seconds * 1_000, 60_000));
  const date = Date.parse(value);
  return Number.isNaN(date) ? fallbackMs : Math.max(0, Math.min(date - Date.now(), 60_000));
}

async function request(method, url, { body = undefined, allow404 = false, authRequired = false, text = false } = {}) {
  if (authRequired && !authToken) {
    fail("This operation writes GitHub state. Authenticate gh or pass --token-file explicitly.");
  }
  const retries = method === "GET" ? 4 : 1;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        method,
        headers: headers(body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 404 && allow404) return null;
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 400).replace(/\s+/g, " ");
        const retryable = method === "GET" && (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500);
        if (retryable && attempt < retries) {
          await sleep(retryAfterMs(response, 1_000 * attempt));
          continue;
        }
        throw new ReleaseError(`GitHub API ${method} ${url} failed with HTTP ${response.status}: ${detail}`, response.status, {
          uncertain: method !== "GET" && response.status >= 500,
        });
      }
      return text ? await response.text() : response.status === 204 ? null : await response.json();
    } catch (error) {
      if (error instanceof ReleaseError) throw error;
      if (method === "GET" && attempt < retries) {
        await sleep(1000 * attempt);
        continue;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ReleaseError(`Request timed out: ${url}`, undefined, { uncertain: method !== "GET" });
      }
      throw new ReleaseError(`Request failed: ${url}: ${error instanceof Error ? error.message : String(error)}`, undefined, {
        uncertain: method !== "GET",
      });
    } finally {
      clearTimeout(timer);
    }
  }
  fail(`Request failed after retries: ${url}`);
}

function apiPath(repository, path) {
  return githubUrl(repository, path);
}

async function getRef(repository, kind, name) {
  return request("GET", apiPath(repository, `/git/ref/${kind}/${encodeURIComponent(name)}`));
}

async function resolveAnnotatedTag(repository, tag) {
  const ref = await getRef(repository, "tags", tag);
  if (ref.object?.type !== "tag") fail(`Remote tag ${tag} is lightweight; an annotated tag is required.`);
  let sha = ref.object.sha;
  for (let depth = 0; depth < 5; depth += 1) {
    const tagObject = await request("GET", apiPath(repository, `/git/tags/${sha}`));
    if (tagObject.object?.type === "commit") return tagObject.object.sha;
    if (tagObject.object?.type !== "tag") fail(`Remote tag ${tag} did not resolve to a commit.`);
    sha = tagObject.object.sha;
  }
  fail(`Remote tag ${tag} has too many tag indirections.`);
}

async function getRemoteText(repository, path, ref, { allow404 = false } = {}) {
  const content = await request("GET", apiPath(repository, `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`), { allow404 });
  if (!content && allow404) return null;
  if (!content || Array.isArray(content) || content.encoding !== "base64") fail(`Cannot read remote file ${path}.`);
  return Buffer.from(content.content.replace(/\s/g, ""), "base64").toString("utf8");
}

function sourceVersions(files) {
  let tauri;
  try {
    tauri = JSON.parse(files.tauri);
  } catch {
    fail("Remote src-tauri/tauri.conf.json is invalid JSON.");
  }
  const cargoMatch = files.cargo.match(/^\[package\].*?^version\s*=\s*"([^"]+)"/ms);
  const lockMatch = files.lock.match(/^\[\[package\]\]\s*\r?\nname\s*=\s*"snow-shot"\s*\r?\nversion\s*=\s*"([^"]+)"/ms);
  if (!cargoMatch || !lockMatch) fail("Could not read remote Cargo versions.");
  const versions = [String(tauri.version), cargoMatch[1], lockMatch[1]];
  if (versions.some((value) => !VERSION_PATTERN.test(value)) || new Set(versions).size !== 1) {
    fail(`Remote source versions do not match: ${versions.join(", ")}`);
  }
  return versions[0];
}

function parseRemoteJson(value, name) {
  try {
    return JSON.parse(value);
  } catch {
    fail(`Remote ${name} is invalid JSON.`);
  }
}

function validateUpdaterConfiguration(files, repository, { strict = true } = {}) {
  const expectedEndpoint = `https://github.com/${repository}/releases/latest/download/latest.json`;
  const publicKeys = new Map();
  for (const [name, value] of [["windows", files.windows], ["macOS", files.macos], ["WebView2", files.webview2]]) {
    if (!value) {
      if (strict) fail(`Remote ${name} updater configuration is missing.`);
      continue;
    }
    const config = parseRemoteJson(value, `${name} updater configuration`);
    const updater = config.plugins?.updater;
    if (!updater || typeof updater !== "object") fail(`Remote ${name} updater configuration is missing.`);
    const pubkey = typeof updater.pubkey === "string" ? updater.pubkey.trim() : "";
    if (!pubkey) fail(`Remote ${name} updater public key is empty.`);
    publicKeys.set(name, pubkey);
    const endpoints = Array.isArray(updater.endpoints) ? updater.endpoints : [];
    if (name === "WebView2") {
      if (endpoints.length !== 0) fail("Remote WebView2 updater endpoint must be empty for the no-OTA installer.");
    } else if (endpoints.length !== 1 || endpoints[0] !== expectedEndpoint) {
      fail(`${name} updater endpoint is not ${expectedEndpoint}.`);
    }
  }
  if (new Set(publicKeys.values()).size > 1) fail("Remote updater public keys differ; refusing to release.");
  if (strict) {
    const noOta = parseRemoteJson(files.noOta, "tauri.no-ota.conf.json");
    const release = parseRemoteJson(files.release, "tauri.release.conf.json");
    if (noOta.plugins?.updater?.endpoints?.length !== 0 || noOta.bundle?.createUpdaterArtifacts !== false) {
      fail("No-OTA configuration must disable updater endpoints and artifacts.");
    }
    if (release.bundle?.createUpdaterArtifacts !== true) {
      fail("Release configuration must enable updater artifacts.");
    }
  }
  return { updaterPublicKey: [...publicKeys.values()][0] || null };
}

function workflowSafety(workflowText) {
  if (!workflowText) return { safe: false, reason: "workflow file is unavailable" };
  const executable = workflowText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => !line.startsWith("#"))
    .filter(Boolean)
    .join("\n");
  if (/\bgit\s+(tag|push)\b/i.test(executable)) {
    return { safe: false, reason: "workflow contains git tag/push commands" };
  }
  if (!/^publish-release:\s*$/m.test(executable)) {
    return { safe: false, reason: "legacy workflow has no single publish-release job" };
  }
  if (!/workflow_dispatch\s*:/i.test(executable)) {
    return { safe: false, reason: "workflow has no workflow_dispatch trigger" };
  }
  if (!/inputs:\s*[\s\S]*?version\s*:/i.test(executable)) {
    return { safe: false, reason: "workflow_dispatch has no version input" };
  }
  if (!/run-name:\s*[^\n]*inputs\.version/i.test(executable)) {
    return { safe: false, reason: "workflow run-name does not include inputs.version" };
  }
  return { safe: true, reason: null };
}

async function preflightRemote({
  repository,
  branch,
  workflow,
  tag,
  strictBranch = true,
  strictSource = strictBranch,
  requireWorkflowDispatch = true,
}) {
  const version = validateTag(tag);
  const mainRef = await getRef(repository, "heads", branch);
  const mainSha = mainRef.object?.sha;
  if (!mainSha) fail(`Could not resolve ${repository}/${branch}.`);
  const tagSha = await resolveAnnotatedTag(repository, tag);
  if (strictBranch && tagSha !== mainSha) {
    fail(`Tag ${tag} points to ${tagSha}, but ${repository}/${branch} is ${mainSha}. No dispatch was sent.`);
  }
  const sourceSha = strictBranch ? mainSha : tagSha;

  const files = {
    tauri: await getRemoteText(repository, "src-tauri/tauri.conf.json", sourceSha),
    cargo: await getRemoteText(repository, "src-tauri/Cargo.toml", sourceSha),
    lock: await getRemoteText(repository, "src-tauri/Cargo.lock", sourceSha),
    windows: await getRemoteText(repository, "src-tauri/tauri.windows.conf.json", sourceSha),
    macos: await getRemoteText(repository, "src-tauri/tauri.macos.conf.json", sourceSha),
    webview2: await getRemoteText(repository, "src-tauri/webview2.x64.json", sourceSha, { allow404: !strictSource }),
    noOta: await getRemoteText(repository, "src-tauri/tauri.no-ota.conf.json", sourceSha, { allow404: !strictSource }),
    release: await getRemoteText(repository, "src-tauri/tauri.release.conf.json", sourceSha, { allow404: !strictSource }),
    workflow: await getRemoteText(repository, `.github/workflows/${workflow}`, sourceSha, { allow404: !strictSource }),
  };
  const sourceVersion = sourceVersions(files);
  if (sourceVersion !== version) fail(`Tag ${tag} does not match remote source version ${sourceVersion}.`);
  const updater = validateUpdaterConfiguration(files, repository, { strict: strictSource });
  const safety = workflowSafety(files.workflow);
  if (requireWorkflowDispatch && (!files.workflow || !/workflow_dispatch\s*:/.test(files.workflow))) {
    fail(`Remote workflow ${workflow} has no workflow_dispatch trigger; cannot safely resume it.`);
  }
  const helperNames = ["release-manifest.mjs", "stage-release-assets.mjs", "release-scripts.test.mjs"];
  const missingHelpers = [];
  if (strictSource && files.workflow) for (const helper of helperNames) {
    if (files.workflow.includes(`scripts/${helper}`)) {
      try {
        await getRemoteText(repository, `scripts/${helper}`, sourceSha);
      } catch (error) {
        if (error instanceof ReleaseError && error.status === 404) missingHelpers.push(helper);
        else throw error;
      }
    }
  }
  if (missingHelpers.length > 0) {
    fail(`Remote workflow references missing scripts: ${missingHelpers.join(", ")}. Commit the helpers or use the older workflow.`);
  }

  return {
    tag,
    version,
    mainSha,
    tagSha,
    sourceSha,
    workflow,
    updaterPublicKey: updater.updaterPublicKey,
    dispatchSafe: safety.safe,
    dispatchSafetyReason: safety.reason,
    parallel: Boolean(files.workflow && /max-parallel:\s*5/.test(files.workflow)),
    checksums: Boolean(files.workflow && /checksums\.json/.test(files.workflow)),
    workflowKind: files.workflow && /^\s*publish-release:\s*$/m.test(files.workflow) ? "staged-publish" : "legacy-matrix",
  };
}

async function listReleases(repository) {
  const releases = [];
  for (let page = 1; page <= 3; page += 1) {
    const result = await request("GET", apiPath(repository, `/releases?per_page=100&page=${page}`));
    if (!Array.isArray(result)) break;
    releases.push(...result);
    if (result.length < 100) break;
  }
  return releases;
}

async function getRelease(repository, tag) {
  // Draft releases are intermittently invisible through /releases/tags/:tag.
  // Listing releases first is slower by one request but avoids the 404 race
  // that caused duplicate drafts during earlier releases.
  const matches = (await listReleases(repository)).filter((release) => release.tag_name === tag);
  if (matches.length > 1) {
    fail(`Multiple GitHub Releases use tag ${tag}: ${matches.map((release) => release.id).join(", ")}.`);
  }
  if (matches.length === 1) return matches[0];
  return request("GET", apiPath(repository, `/releases/tags/${encodeURIComponent(tag)}`), { allow404: true });
}

async function listRuns(repository, headSha) {
  const runs = [];
  for (let page = 1; page <= 3; page += 1) {
    const result = await request("GET", apiPath(repository, `/actions/runs?per_page=100&page=${page}&head_sha=${encodeURIComponent(headSha)}`));
    if (!Array.isArray(result.workflow_runs)) break;
    runs.push(...result.workflow_runs);
    if (result.workflow_runs.length < 100) break;
  }
  return runs;
}

function runText(run) {
  return [run.head_branch, run.display_title, run.name, run.run_name, run.path].filter(Boolean).join(" ");
}

function containsExactTag(text, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^0-9A-Za-z.+-])${escaped}(?:$|[^0-9A-Za-z.+-])`).test(text);
}

function workflowPathMatches(path, workflow) {
  if (typeof path !== "string" || !path) return false;
  const normalized = path.replaceAll("\\", "/");
  const expected = `.github/workflows/${workflow}`;
  return normalized === expected || normalized.endsWith(`/${expected}`);
}

function isMatchingRun(run, { tag, workflow }) {
  const normalizedWorkflow = String(workflow).replaceAll("\\", "/");
  if (!workflowPathMatches(run.path, normalizedWorkflow)) return false;
  if (!["push", "workflow_dispatch"].includes(run.event)) return false;
  const text = runText(run);
  const tagMatch = containsExactTag(text, tag) || run.head_branch === tag;
  return tagMatch;
}

async function findRun(repository, headSha, args) {
  const runs = (await listRuns(repository, headSha))
    .filter((run) => isMatchingRun(run, { tag: args.tag, workflow: args.workflow }))
    .sort((a, b) => {
      const activeDelta = Number(ACTIVE_STATES.has(b.status)) - Number(ACTIVE_STATES.has(a.status));
      return activeDelta || new Date(b.created_at) - new Date(a.created_at);
    });
  const activeRuns = runs.filter((run) => ACTIVE_STATES.has(run.status));
  if (activeRuns.length > 1) {
    fail(`Multiple active Actions runs match ${args.tag}: ${activeRuns.map((run) => run.id).join(", ")}. Refusing to choose one.`);
  }
  return runs[0] || null;
}

async function waitForRun(repository, headSha, args) {
  const delays = args.discoveryDelaysMs || DISCOVERY_DELAYS_MS;
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const run = await findRun(repository, headSha, args);
    if (run) return run;
  }
  return null;
}

async function getRun(repository, runId) {
  return request("GET", apiPath(repository, `/actions/runs/${runId}`));
}

async function listRunJobs(repository, runId) {
  const jobs = [];
  for (let page = 1; page <= 3; page += 1) {
    const result = await request("GET", apiPath(repository, `/actions/runs/${runId}/jobs?per_page=100&page=${page}`));
    if (!Array.isArray(result.jobs)) break;
    jobs.push(...result.jobs);
    if (result.jobs.length < 100) break;
  }
  return jobs;
}

function isPublishJob(job) {
  const name = String(job?.name || "").toLowerCase().replaceAll("_", "-");
  return name === "publish-release" || (name.includes("publish") && name.includes("release"));
}

async function assertPublishJobSucceeded(repository, runId) {
  const jobs = await listRunJobs(repository, runId);
  const publishJobs = jobs.filter(isPublishJob);
  if (publishJobs.length !== 1) {
    fail(`Actions run ${runId} did not expose exactly one publish-release job (found ${publishJobs.length}). Refusing to treat it as a successful release.`);
  }
  const publishJob = publishJobs[0];
  if (publishJob.conclusion !== "success") {
    if (publishJob.conclusion === "skipped") {
      fail(`Actions run ${runId} succeeded without running publish-release. rerun-failed-jobs cannot repair a skipped publish job; start a reviewed full workflow run.`);
    }
    fail(`publish-release job ended with ${publishJob.status}/${publishJob.conclusion}: ${publishJob.html_url || runId}`);
  }
  return publishJob;
}

async function saveReleaseState(args, patch = {}) {
  const path = statePathFor(args);
  const previous = await (async () => {
    try {
      return await readState(path);
    } catch (error) {
      if (error instanceof ReleaseError && /Cannot read OTA state file/.test(error.message)) return {};
      throw error;
    }
  })();
  const state = {
    ...previous,
    repository: args.repository,
    branch: args.branch,
    workflow: args.workflow,
    tag: args.tag,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  await writeState(path, state);
  return state;
}

async function existingReleaseState(args) {
  const path = statePathFor(args);
  try {
    return await readState(path);
  } catch (error) {
    if (error instanceof ReleaseError && /Cannot read OTA state file/.test(error.message)) return null;
    throw error;
  }
}

async function dispatchWorkflow(repository, args) {
  try {
    await request("POST", apiPath(repository, `/actions/workflows/${encodeURIComponent(args.workflow)}/dispatches`), {
      body: { ref: args.branch, inputs: { version: args.tag } },
      authRequired: true,
    });
    console.log(`Dispatch accepted for ${args.tag} on ${repository}/${args.branch}.`);
    return { accepted: true, uncertain: false };
  } catch (error) {
    if (error instanceof ReleaseError && error.uncertain) {
      console.warn(`[ota] Dispatch request was interrupted; checking for an existing run before doing anything else.`);
      return { accepted: false, uncertain: true };
    }
    throw error;
  }
}

async function rerunFailedJobs(repository, runId) {
  await request("POST", apiPath(repository, `/actions/runs/${runId}/rerun-failed-jobs`), { authRequired: true });
  console.log(`Requested rerun of failed jobs for Actions run ${runId}.`);
}

function ghEnvironment() {
  const env = { ...process.env };
  if (authToken) env.GH_TOKEN = authToken;
  return env;
}

function requireGitHubCli() {
  const probe = spawnSync("gh", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
    windowsHide: true,
  });
  if (probe.status !== 0) fail("GitHub CLI (gh) is required for Actions monitoring. Install/configure it before publishing.");
}

async function watchRun(repository, runId, timeoutMinutes) {
  const gh = spawn("gh", ["run", "watch", String(runId), "--repo", repository, "--interval", "30", "--exit-status"], {
    env: ghEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  gh.stdout.on("data", (chunk) => process.stdout.write(chunk));
  gh.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      resolvePromise(value);
    };
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const timer = setTimeout(() => {
      try {
        gh.kill();
      } catch {
        // The local watcher may already have exited. Never cancel the remote run.
      }
      rejectOnce(new ReleaseError(`Local watcher timed out after ${timeoutMinutes} minutes; remote run ${runId} remains active.`));
    }, timeoutMinutes * 60_000);
    gh.once("error", (error) => {
      clearTimeout(timer);
      rejectOnce(new ReleaseError(`Unable to start gh run watch: ${error.message}`));
    });
    gh.once("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolveOnce(code ?? 1);
    });
  });
}

async function runToSuccess(repository, run, args) {
  const persisted = await existingReleaseState(args);
  let retries = Number.isSafeInteger(Number(persisted?.retryCount)) ? Number(persisted.retryCount) : 0;
  let current = run;
  while (true) {
    console.log(`Actions run ${current.id} (attempt ${current.run_attempt || 1}): ${current.html_url}`);
    await saveReleaseState(args, {
      stage: ACTIVE_STATES.has(current.status) ? "watching" : "run-found",
      mainSha: args.mainSha,
      version: args.version,
      runId: current.id,
      runAttempt: Number(current.run_attempt || 1),
      runUrl: current.html_url,
    });
    if (ACTIVE_STATES.has(current.status)) {
      await watchRun(repository, current.id, args.timeoutMinutes);
      current = await getRun(repository, current.id);
    } else {
      current = await getRun(repository, current.id);
    }
    if (current.conclusion === "success") {
      await assertPublishJobSucceeded(repository, current.id);
      await saveReleaseState(args, {
        stage: "run-success",
        runId: current.id,
        runAttempt: Number(current.run_attempt || 1),
        runConclusion: current.conclusion,
      });
      return current;
    }
    if (ACTIVE_STATES.has(current.status)) {
      fail(`Actions watcher ended while run ${current.id} is still ${current.status}; resume with --state-file ${statePathFor(args)}.`);
    }
    if (!RETRYABLE_CONCLUSIONS.has(current.conclusion)) {
      fail(`Actions run ended with ${current.status}/${current.conclusion}: ${current.html_url}`);
    }
    if (!args.retryFailed || retries >= args.maxRetries) {
      fail(`Actions run failed after ${retries} automatic retries: ${current.html_url}. Re-run with --retry-failed after reviewing the failed job.`);
    }
    retries += 1;
    const previousAttempt = Number(current.run_attempt || 1);
    await saveReleaseState(args, { stage: "rerun-requested", retryCount: retries });
    try {
      await rerunFailedJobs(repository, current.id);
    } catch (error) {
      if (error instanceof ReleaseError && !error.uncertain) {
        await saveReleaseState(args, {
          stage: "rerun-rejected",
          retryCount: retries - 1,
          rerunError: error.message,
        });
      }
      throw error;
    }
    let next = null;
    for (const delay of RERUN_DISCOVERY_DELAYS_MS) {
      await sleep(delay);
      const candidate = await getRun(repository, current.id);
      if (Number(candidate.run_attempt || 1) > previousAttempt || ACTIVE_STATES.has(candidate.status)) {
        next = candidate;
        break;
      }
    }
    if (!next) fail(`GitHub accepted the rerun but did not expose a new attempt for ${current.html_url}.`);
    current = next;
  }
}

async function fetchJson(url) {
  const response = await request("GET", url, { text: true });
  try {
    return JSON.parse(response);
  } catch (error) {
    fail(`Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateManifest(manifest, tag, version, baseUrl) {
  if (!manifest || typeof manifest !== "object") fail("OTA manifest is not an object.");
  if (manifest.version !== version) fail(`Manifest version ${manifest.version} does not match ${version}.`);
  if (typeof manifest.pub_date !== "string" || Number.isNaN(Date.parse(manifest.pub_date))) fail("Manifest pub_date is invalid.");
  if (typeof manifest.notes !== "string") fail("Manifest notes must be a string.");
  if (!manifest.platforms || typeof manifest.platforms !== "object" || Array.isArray(manifest.platforms)) fail("Manifest platforms are missing.");
  const expected = updaterAssetNames(version);
  for (const platform of REQUIRED_PLATFORMS) {
    const entry = manifest.platforms[platform];
    if (!entry || typeof entry !== "object") fail(`Manifest platform is missing: ${platform}.`);
    if (typeof entry.signature !== "string" || entry.signature.trim() === "") fail(`Manifest signature is empty: ${platform}.`);
    const expectedUrl = `${baseUrl}/${encodeURIComponent(expected[platform])}`;
    if (entry.url !== expectedUrl) fail(`Manifest URL for ${platform} is not ${expectedUrl}.`);
  }
  const unexpected = Object.keys(manifest.platforms).filter(
    (key) => !REQUIRED_PLATFORMS.includes(key) && !COMPATIBILITY_PLATFORMS.has(key),
  );
  if (unexpected.length > 0) fail(`Manifest has unexpected platform keys: ${unexpected.join(", ")}.`);
  for (const [alias, canonical] of Object.entries(COMPATIBILITY_PLATFORM_TARGETS)) {
    const entry = manifest.platforms[alias];
    if (!entry) continue;
    const canonicalEntry = manifest.platforms[canonical];
    if (entry.url !== canonicalEntry.url || entry.signature !== canonicalEntry.signature) {
      fail(`Manifest compatibility platform ${alias} does not match ${canonical}.`);
    }
  }
}

function validateChecksumsIndex(value, assetNames, version) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("checksums.json must be a JSON object.");
  const entries = Object.entries(value);
  if (entries.length === 0) fail("checksums.json is empty.");
  for (const [name, digest] of entries) {
    if (!name || basename(name) !== name || name === "latest.json" || name === "checksums.json") {
      fail(`checksums.json contains an invalid asset name: ${name}.`);
    }
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/i.test(digest)) {
      fail(`checksums.json contains an invalid SHA-256 for ${name}.`);
    }
  }
  const expectedNames = [...assetNames].filter((name) => name !== "latest.json" && name !== "checksums.json").sort();
  const actualNames = Object.keys(value).sort();
  if (expectedNames.join("\n") !== actualNames.join("\n")) {
    const missing = expectedNames.filter((name) => !actualNames.includes(name));
    const unexpected = actualNames.filter((name) => !expectedNames.includes(name));
    const details = [];
    if (missing.length) details.push(`missing: ${missing.join(", ")}`);
    if (unexpected.length) details.push(`unexpected: ${unexpected.join(", ")}`);
    fail(`checksums.json asset set mismatch (${details.join("; ")}).`);
  }
  const expected = updaterAssetNames(version);
  for (const platform of REQUIRED_PLATFORMS) {
    const archive = expected[platform];
    const signature = `${archive}.sig`;
    if (!value[archive] || !value[signature]) fail(`checksums.json is missing updater assets for ${platform}.`);
  }
  return value;
}

async function verifyPublicLatest(repository, tag, version, attempts) {
  const url = `https://github.com/${repository}/releases/latest/download/latest.json`;
  const baseUrl = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}`;
  let lastVersion = null;
  for (const delay of [0, 5_000, 15_000, 30_000, 60_000].slice(0, attempts)) {
    if (delay > 0) await sleep(delay);
    let manifest;
    try {
      manifest = await fetchJson(url);
    } catch (error) {
      lastVersion = error instanceof Error ? error.message : String(error);
      continue;
    }
    lastVersion = manifest.version;
    if (lastVersion !== version) continue;
    // Once the version converges, a malformed URL/signature is a hard
    // release failure rather than CDN propagation delay.
    validateManifest(manifest, tag, version, baseUrl);
    console.log(`Public latest endpoint converged to ${version}.`);
    return manifest;
  }
  fail(`Public latest endpoint did not converge to ${version} (last value: ${lastVersion}). The Release may be public but CDN propagation is incomplete.`);
}

async function verifyRelease({
  repository,
  tag,
  version,
  expectedSha = undefined,
  requireChecksums = true,
  allowLegacy = false,
  allowDraft = false,
  verifyLatest = true,
  latestAttempts = 4,
}) {
  const resolvedSha = await resolveAnnotatedTag(repository, tag);
  if (expectedSha && resolvedSha !== expectedSha) {
    fail(`Tag ${tag} moved from expected commit ${expectedSha} to ${resolvedSha}; refusing to verify or publish it.`);
  }
  const release = await getRelease(repository, tag);
  if (!release) fail(`No GitHub Release exists for ${tag}.`);
  if (release.tag_name !== tag) fail(`Resolved Release ${release.id} has tag ${release.tag_name}, not ${tag}.`);
  if (release.prerelease) fail(`Release ${tag} is marked prerelease; refusing to promote or verify it as the public OTA.`);
  if (release.draft && !allowDraft) fail(`Release ${tag} is still a draft.`);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const names = new Set();
  for (const asset of assets) {
    if (!asset || typeof asset.name !== "string") fail(`Release ${tag} contains an invalid asset entry.`);
    if (names.has(asset.name)) fail(`Release ${tag} contains duplicate asset ${asset.name}.`);
    names.add(asset.name);
    if (asset.state && asset.state !== "uploaded") fail(`Release ${tag} asset ${asset.name} is not uploaded (state=${asset.state}).`);
    if (!Number.isFinite(Number(asset.size)) || Number(asset.size) <= 0) fail(`Release ${tag} contains an empty asset ${asset.name}.`);
  }
  for (const name of expectedAssets(version)) if (!names.has(name)) fail(`Release ${tag} is missing asset ${name}.`);
  const checksums = names.has("checksums.json");
  if (requireChecksums && !checksums && !allowLegacy) {
    fail(`Release ${tag} is missing checksums.json. Re-run with --allow-legacy only for a historical Release.`);
  }
  if (!checksums) console.warn("[ota] checksums.json is absent; legacy compatibility mode was explicitly enabled.");
  const allowed = new Set(expectedAssets(version, { includeChecksums: checksums }));
  const unexpected = [...names].filter((name) => !allowed.has(name));
  if (unexpected.length > 0) fail(`Release ${tag} contains unexpected assets: ${unexpected.join(", ")}.`);

  const baseUrl = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}`;
  const manifest = await fetchJson(`${baseUrl}/latest.json`);
  validateManifest(manifest, tag, version, baseUrl);
  let checksumIndex = null;
  if (checksums) {
    const checksumAsset = assets.find((asset) => asset.name === "checksums.json");
    const checksumUrl = checksumAsset?.browser_download_url || `${baseUrl}/checksums.json`;
    checksumIndex = validateChecksumsIndex(await fetchJson(checksumUrl), names, version);
  }
  const latest = verifyLatest ? await verifyPublicLatest(repository, tag, version, latestAttempts) : null;
  return { release, manifest, latest, checksums, checksumIndex };
}

async function makeReleaseLatest(repository, releaseId) {
  const release = await request("PATCH", apiPath(repository, `/releases/${releaseId}`), {
    body: { draft: false, prerelease: false, make_latest: "true" },
    authRequired: true,
  });
  if (!release || release.id !== releaseId) fail(`GitHub returned an unexpected Release while updating ${releaseId}.`);
  return release;
}

async function waitForRelease(repository, tag, attempts = 6) {
  let release = null;
  for (const delay of [0, 2_000, 5_000, 10_000, 20_000, 30_000].slice(0, attempts)) {
    if (delay > 0) await sleep(delay);
    release = await getRelease(repository, tag);
    if (release) return release;
  }
  return null;
}

async function ensurePublicRelease(repository, tag, confirm) {
  let release = await waitForRelease(repository, tag);
  if (!release) fail(`Workflow completed without a Release for ${tag}.`);
  if (!release.draft) return release;
  if (release.prerelease) fail(`Release ${tag} is both draft and prerelease; refusing to repair ambiguous flags.`);
  if (!confirm) fail(`Release ${tag} is still a draft. Re-run publish with --confirm to make the already-verified Release public.`);
  console.log(`Publishing verified Release ${tag}: draft=false, prerelease=false, make_latest=true.`);
  release = await makeReleaseLatest(repository, release.id);
  if (release.tag_name !== tag) fail(`Resolved Release ${release.id} has tag ${release.tag_name}, not ${tag}.`);
  return release;
}

async function printPlan(args) {
  const { command, repository, branch, workflow, tag, retryFailed, maxRetries } = args;
  validateRepository(repository);
  validateWorkflow(workflow);
  const strictBranch = command !== "status";
  const info = await preflightRemote({
    repository,
    branch,
    workflow,
    tag,
    strictBranch,
    strictSource: true,
    requireWorkflowDispatch: true,
  });
  const release = await getRelease(repository, tag);
  const state = await existingReleaseState(args);
  let run = null;
  if (state?.runId) {
    try {
      const candidate = await getRun(repository, state.runId);
      if (candidate.head_sha === info.tagSha && isMatchingRun(candidate, { tag, workflow })) run = candidate;
    } catch (error) {
      if (!(error instanceof ReleaseError && error.status === 404)) throw error;
    }
  }
  if (!run) run = await findRun(repository, info.tagSha, { tag, workflow, branch });
  if (!info.dispatchSafe) console.warn(`[ota] Dispatch is blocked: ${info.dispatchSafetyReason}.`);
  console.log(JSON.stringify({
    repository,
    branch,
    workflow,
    tag,
    version: info.version,
    head: info.tagSha,
    workflow_kind: info.workflowKind,
    parallel_matrix: info.parallel,
    checksums_workflow: info.checksums,
    dispatch_safe: info.dispatchSafe,
    dispatch_safety_reason: info.dispatchSafetyReason,
    release: release ? { id: release.id, draft: release.draft, prerelease: release.prerelease, url: release.html_url } : null,
    run: run ? { id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url } : null,
    retry_failed: retryFailed,
    max_retries: maxRetries,
    state_file: statePathFor(args),
    state: state ? {
      stage: state.stage,
      run_id: state.runId || null,
      run_attempt: state.runAttempt || null,
      retry_count: state.retryCount || 0,
      updated_at: state.updatedAt,
    } : null,
    writes: false,
  }, null, 2));
}

async function publish(args, resumeOnly = false) {
  if (!args.confirm) fail(`${args.command} performs remote writes; add --confirm after reviewing plan output.`);
  validateTag(args.tag);
  validateRepository(args.repository);
  validateWorkflow(args.workflow);
  if (args.repository !== DEFAULT_REPOSITORY || args.branch !== DEFAULT_BRANCH) {
    fail(`Remote writes are restricted to ${DEFAULT_REPOSITORY}/${DEFAULT_BRANCH}.`);
  }
  const releaseLock = await acquireReleaseLock(args);
  try {
    if (!(await loadToken(args.tokenFile))) {
      fail("Publishing requires GitHub authentication through gh auth, GH_TOKEN, GITHUB_TOKEN, or SNOWSHOT_GITHUB_TOKEN.");
    }
    requireGitHubCli();
    const priorState = await existingReleaseState(args);
    if (priorState && (
      priorState.tag !== args.tag
      || priorState.repository !== args.repository
      || priorState.branch !== args.branch
      || priorState.workflow !== args.workflow
    )) {
      fail(`OTA state file ${statePathFor(args)} belongs to another release target. Use --state-file for the intended release.`);
    }
    const info = await preflightRemote({
      ...args,
      strictBranch: !resumeOnly,
      strictSource: true,
      requireWorkflowDispatch: true,
    });
    args.mainSha = info.tagSha;
    args.version = info.version;
    if (!info.dispatchSafe) {
      fail(`Refusing to dispatch ${args.workflow}: ${info.dispatchSafetyReason}. Use the staged publish workflow; the legacy workflow may create or push tags.`);
    }
    if (!info.checksums) {
      fail("Refusing to dispatch a workflow that does not generate checksums.json. Use the staged workflow or verify an older Release separately.");
    }
    if (!info.parallel) {
      fail("Refusing to dispatch a serial release workflow; the five build variants must run in parallel.");
    }
    args.requireChecksums = true;
    await saveReleaseState(args, {
      stage: "preflight",
      version: info.version,
      mainSha: info.mainSha,
      releaseSha: info.tagSha,
      tagSha: info.tagSha,
      dispatchSafe: info.dispatchSafe,
      retryCount: Number.isSafeInteger(Number(priorState?.retryCount)) ? Number(priorState.retryCount) : 0,
    });

    let release = await getRelease(args.repository, args.tag);
    if (release && !release.draft) {
      if (release.prerelease) {
        fail(`Release ${args.tag} is already public but marked prerelease; refusing to change its channel automatically.`);
      }
      console.log(`A public Release already exists for ${args.tag}; no duplicate dispatch or latest promotion will be sent.`);
      await saveReleaseState(args, { stage: "public-existing", releaseId: release.id, releaseUrl: release.html_url });
      await verifyRelease({ ...args, version: info.version, expectedSha: info.tagSha });
      await saveReleaseState(args, { stage: "done", releaseId: release.id });
      return;
    }

    let run = null;
    if (priorState?.runId) {
      try {
        const candidate = await getRun(args.repository, priorState.runId);
        if (candidate.head_sha === info.tagSha && isMatchingRun(candidate, args)) run = candidate;
      } catch (error) {
        if (!(error instanceof ReleaseError && error.status === 404)) throw error;
        console.warn(`[ota] Saved run ${priorState.runId} is no longer available; searching by tag and commit.`);
      }
    }
    if (!run) run = await findRun(args.repository, info.tagSha, args);
    if (!run) {
      if (resumeOnly) fail(`No existing Actions run was found for ${args.tag}; resume will not dispatch a new run.`);
      if (priorState?.dispatchAt) {
        fail(`A previous dispatch for ${args.tag} is recorded at ${priorState.dispatchAt}, but no run is visible yet. Use resume later; no duplicate dispatch was sent.`);
      }
      const dispatchAt = new Date().toISOString();
      await saveReleaseState(args, { stage: "dispatching", dispatchAt, retryCount: 0 });
      let dispatch;
      try {
        dispatch = await dispatchWorkflow(args.repository, args);
      } catch (error) {
        await saveReleaseState(args, {
          stage: "dispatch-rejected",
          dispatchAt: null,
          dispatchUncertain: false,
          dispatchError: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      await saveReleaseState(args, {
        stage: dispatch.uncertain ? "dispatch-uncertain" : "dispatched",
        dispatchAt,
        dispatchUncertain: dispatch.uncertain,
      });
      run = await waitForRun(args.repository, info.tagSha, args);
      if (!run) fail(`Dispatch was accepted or may have succeeded, but no run appeared in the bounded discovery window. Resume with --tag ${args.tag}; no duplicate dispatch was sent.`);
    }
    await saveReleaseState(args, { stage: "run-adopted", runId: run.id, runUrl: run.html_url, runAttempt: Number(run.run_attempt || 1) });
    await runToSuccess(args.repository, run, args);
    await saveReleaseState(args, { stage: "verifying-draft" });
    await verifyRelease({
      ...args,
      version: info.version,
      expectedSha: info.tagSha,
      allowDraft: true,
      verifyLatest: false,
    });
    release = await ensurePublicRelease(args.repository, args.tag, true);
    await saveReleaseState(args, { stage: "verifying", releaseId: release.id, releaseUrl: release.html_url });
    await verifyRelease({ ...args, version: info.version, expectedSha: info.tagSha });
    await saveReleaseState(args, { stage: "done", releaseId: release.id });
    console.log(`OTA release verified: ${release.html_url}`);
  } finally {
    await releaseLock();
  }
}

function usage() {
  console.log(`Snow Shot OTA release operator

Read-only:
  node scripts/ota-release.mjs plan --tag vX.Y.Z
  node scripts/ota-release.mjs status --tag vX.Y.Z
  node scripts/ota-release.mjs verify --tag vX.Y.Z [--allow-legacy]

Remote workflow (requires explicit confirmation):
  node scripts/ota-release.mjs publish --tag vX.Y.Z --confirm --retry-failed
  node scripts/ota-release.mjs resume  --tag vX.Y.Z --confirm --retry-failed

The tool assumes the annotated tag already exists on origin/main. It never
creates/moves tags, commits, pushes, pulls, creates branches, or cancels runs.
It only dispatches the staged single-publish workflow; legacy workflows that
create or push tags are rejected. It adopts an existing run, records a local
state file, dispatches at most once, retries failed jobs only when
--retry-failed is supplied, repairs prerelease/latest flags, and waits for the
public latest.json CDN endpoint with a bounded retry window.

Options:
  --repo REPOSITORY       default: ${DEFAULT_REPOSITORY}
  --branch BRANCH         default: ${DEFAULT_BRANCH}
  --workflow FILE         default: ${DEFAULT_WORKFLOW}
  --timeout-minutes N     local gh watcher limit (default: 150)
  --max-retries N         failed-job retries (default: 1)
  --latest-attempts N     CDN convergence attempts (default: 4, maximum: 5)
  --state-file PATH       persistent local resume state (default: user profile)
  --allow-legacy          allow historical Releases without checksums.json
  --token-file PATH       optional untracked token file; github.txt is refused
`);
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.command === "help" || flag(parsed.options, "help")) {
    usage();
    return;
  }
  if (!["plan", "status", "publish", "resume", "verify"].includes(parsed.command)) fail(`Unknown command: ${parsed.command}`);
  const repository = validateRepository(option(parsed.options, "repo", DEFAULT_REPOSITORY));
  const workflow = validateWorkflow(option(parsed.options, "workflow", DEFAULT_WORKFLOW));
  const args = {
    command: parsed.command,
    options: parsed.options,
    repository,
    branch: option(parsed.options, "branch", DEFAULT_BRANCH),
    workflow,
    tag: requiredOption(parsed.options, "tag"),
    confirm: flag(parsed.options, "confirm"),
    retryFailed: flag(parsed.options, "retry-failed"),
    maxRetries: parsePositiveInt(option(parsed.options, "max-retries"), "max-retries", 1),
    timeoutMinutes: parsePositiveInt(option(parsed.options, "timeout-minutes"), "timeout-minutes", 150),
    latestAttempts: parsePositiveInt(option(parsed.options, "latest-attempts"), "latest-attempts", 4),
    requireChecksums: !flag(parsed.options, "allow-legacy"),
    allowLegacy: flag(parsed.options, "allow-legacy"),
    tokenFile: option(parsed.options, "token-file", undefined),
  };
  if (args.latestAttempts > 5) fail("--latest-attempts cannot exceed 5.");
  if (args.timeoutMinutes > 24 * 60) fail("--timeout-minutes cannot exceed 1440.");
  if (parsed.command === "plan" || parsed.command === "status") {
    await loadToken(args.tokenFile);
    await printPlan(args);
    return;
  }
  if (parsed.command === "verify") {
    await loadToken(args.tokenFile);
    const info = await preflightRemote({
      ...args,
      strictBranch: false,
      strictSource: false,
      requireWorkflowDispatch: false,
    });
    await verifyRelease({ ...args, version: info.version, expectedSha: info.tagSha });
    console.log(`Public OTA verified for ${args.tag}.`);
    return;
  }
  await publish(args, parsed.command === "resume");
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[ota] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export {
  COMPATIBILITY_PLATFORMS,
  REQUIRED_PLATFORMS,
  expectedAssets,
  sourceVersions,
  validateChecksumsIndex,
  workflowSafety,
  isMatchingRun,
  parseArgs,
  validateManifest,
  validateTag,
};
