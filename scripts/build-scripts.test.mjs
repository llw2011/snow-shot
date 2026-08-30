#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildRoot,
	frontendOutputDirectory,
	repositoryRoot,
	stagingDirectory,
	targetBundleDirectory,
	tauriTargetDirectory,
} from "./build-config.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const buildScript = resolve(scriptDirectory, "build.mjs");
const configScript = resolve(scriptDirectory, "build-config.mjs");

function cli(script, args, env = process.env) {
	return new Promise((resolveResult, reject) => {
		const child = spawn(process.execPath, [script, ...args], {
			cwd: tmpdir(),
			env,
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

async function main() {
	assert.equal(stagingDirectory("1.2.3", "windows-standard"), join(buildRoot, "staging", "1.2.3", "windows-standard"));
	assert.equal(
		stagingDirectory("1.2.3+build.7", "windows-standard"),
		join(buildRoot, "staging", "1.2.3+build.7", "windows-standard"),
	);
	assert.equal(
		targetBundleDirectory("x86_64-pc-windows-msvc"),
		join(tauriTargetDirectory, "x86_64-pc-windows-msvc", "release", "bundle"),
	);
	assert.throws(() => stagingDirectory("..", "windows-standard"), /Invalid version/);

	const paths = await cli(configScript, ["json"]);
	assert.equal(paths.status, 0, paths.output);
	const pathPayload = JSON.parse(paths.stdout);
	assert.equal(pathPayload.repositoryRoot, repositoryRoot);
	assert.equal(pathPayload.frontendOutputDirectory, frontendOutputDirectory);
	assert.equal(pathPayload.tauriTargetDirectory, tauriTargetDirectory);

	const frontend = await cli(buildScript, ["frontend", "--dry-run"]);
	assert.equal(frontend.status, 0, frontend.output);
	const frontendPayload = JSON.parse(frontend.stdout);
	assert.equal(frontendPayload.cwd, repositoryRoot);
	assert.deepEqual(frontendPayload.args.slice(-3), ["exec", "rsbuild", "build"]);
	assert.equal(frontendPayload.env.CARGO_TARGET_DIR, tauriTargetDirectory);
	assert.equal(frontendPayload.env.RSDOCTOR, undefined);
	assert.equal(frontendPayload.env.BUNDLE_ANALYZE, undefined);

	const preview = await cli(buildScript, ["preview", "--dry-run"]);
	assert.equal(preview.status, 0, preview.output);
	const previewPayload = JSON.parse(preview.stdout);
	assert.equal(previewPayload.cwd, repositoryRoot);
	assert.deepEqual(previewPayload.args.slice(-3), ["exec", "rsbuild", "preview"]);

	const dev = await cli(buildScript, ["dev", "--dry-run", "--port", "9010"]);
	assert.equal(dev.status, 0, dev.output);
	const devPayload = JSON.parse(dev.stdout);
	assert.equal(devPayload.args.filter((argument) => argument === "--port").length, 1);
	assert.ok(devPayload.args.includes("9010"));

	const packageSeparator = await cli(buildScript, ["preview", "--dry-run", "--", "--help"]);
	assert.equal(packageSeparator.status, 0, packageSeparator.output);
	const packageSeparatorPayload = JSON.parse(packageSeparator.stdout);
	assert.deepEqual(packageSeparatorPayload.args.slice(-1), ["--help"]);

	const rsdoctor = await cli(buildScript, ["frontend", "--rsdoctor", "--dry-run"]);
	assert.equal(rsdoctor.status, 0, rsdoctor.output);
	assert.equal(JSON.parse(rsdoctor.stdout).env.RSDOCTOR, "true");

	const analyze = await cli(buildScript, ["frontend", "--diagnostics=analyze", "--dry-run"]);
	assert.equal(analyze.status, 0, analyze.output);
	assert.equal(JSON.parse(analyze.stdout).env.BUNDLE_ANALYZE, "true");

	const conflictingDiagnostics = await cli(buildScript, ["frontend", "--rsdoctor", "--analyze", "--dry-run"]);
	assert.notEqual(conflictingDiagnostics.status, 0, conflictingDiagnostics.output);
	assert.match(conflictingDiagnostics.output, /cannot be combined/);

	if (process.platform === "win32") {
		const fakeNpmCli = join(tmpdir(), `snow-shot-not-pnpm-${process.pid}.js`);
		await writeFile(fakeNpmCli, "// fixture\n", "utf8");
		try {
			const wrongNpmExecPath = await cli(buildScript, ["frontend", "--dry-run"], {
				...process.env,
				npm_execpath: fakeNpmCli,
				PNPM_CLI_PATH: "",
			});
			assert.equal(wrongNpmExecPath.status, 0, wrongNpmExecPath.output);
			assert.notEqual(JSON.parse(wrongNpmExecPath.stdout).args[0], fakeNpmCli);
		} finally {
			await rm(fakeNpmCli, { force: true });
		}
	}

	const custom = await cli(buildScript, ["tauri", "--flavor", "custom", "--dry-run"]);
	assert.equal(custom.status, 0, custom.output);
	const customPayload = JSON.parse(custom.stdout);
	assert.equal(customPayload.cwd, repositoryRoot);
	assert.equal(customPayload.env.PUBLIC_BUILD_FLAVOR, "custom");
	assert.ok(customPayload.args.includes("src-tauri/tauri.custom-network.conf.json"));

	const cargoConfig = await cli(buildScript, ["tauri", "--flavor", "custom", "--dry-run", "--", "--config", "cargo.toml"]);
	assert.equal(cargoConfig.status, 0, cargoConfig.output);
	const cargoConfigPayload = JSON.parse(cargoConfig.stdout);
	assert.equal(cargoConfigPayload.args.filter((argument) => argument === "src-tauri/tauri.custom-network.conf.json").length, 1);
	assert.deepEqual(cargoConfigPayload.args.slice(-3), ["--", "--config", "cargo.toml"]);

	console.log("build scripts tests: ok");
}

main().catch((error) => {
	console.error(`build scripts tests: ${error instanceof Error ? error.stack : String(error)}`);
	process.exitCode = 1;
});
