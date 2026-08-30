#!/usr/bin/env node

/** Shared build entry point with explicit tools, environment, and cwd. */

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
	frontendOutputDirectory,
	repositoryRoot,
	targetBundleDirectory,
	tauriTargetDirectory,
} from "./build-config.mjs";

const tauriRoot = resolve(repositoryRoot, "src-tauri");
const customConfig = "src-tauri/tauri.custom-network.conf.json";
const cargo = process.platform === "win32" ? "cargo.exe" : "cargo";
let pnpmRunner;

function resolvePnpmCli(candidate) {
	if (!candidate || basename(candidate).toLowerCase() !== "pnpm.cjs") return null;
	const resolved = resolve(repositoryRoot, candidate);
	return existsSync(resolved) ? resolved : null;
}

function getPnpmRunner() {
	if (pnpmRunner) return pnpmRunner;
	if (process.platform !== "win32") {
		pnpmRunner = { command: "pnpm", args: [] };
		return pnpmRunner;
	}

	const candidates = [process.env.npm_execpath, process.env.PNPM_CLI_PATH]
		.map(resolvePnpmCli)
		.filter(Boolean);
	candidates.push(resolve(dirname(process.execPath), "node_modules", "pnpm", "bin", "pnpm.cjs"));
	if (process.env.PNPM_HOME) {
		candidates.push(resolve(process.env.PNPM_HOME, "node_modules", "pnpm", "bin", "pnpm.cjs"));
	}
	try {
		const wrappers = execFileSync("where.exe", ["pnpm.cmd"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		for (const wrapper of wrappers.split(/\r?\n/).filter(Boolean)) {
			candidates.push(resolve(dirname(wrapper), "node_modules", "pnpm", "bin", "pnpm.cjs"));
		}
	} catch {
		// The deterministic Node-prefix and PNPM_HOME candidates are sufficient
		// for standard Node and pnpm/action-setup installations.
	}
	const cli = candidates.find((candidate) => existsSync(candidate));
	if (!cli) {
		throw new Error("Could not locate pnpm's Node CLI on Windows; set PNPM_CLI_PATH to pnpm.cjs.");
	}
	pnpmRunner = { command: process.execPath, args: [cli] };
	return pnpmRunner;
}

function fail(message) {
	console.error(`build: ${message}`);
	process.exitCode = 1;
}

function parseArgs(argv) {
	const [mode = "help", ...rest] = argv;
	let flavor = "public";
	let diagnostics = "none";
	let dryRun = false;
	const passthrough = [];
	let hasTauriConfig = false;
	let afterSeparator = false;

	for (let index = 0; index < rest.length; index += 1) {
		const token = rest[index];
		if (!afterSeparator && token === "--") {
			afterSeparator = true;
			// pnpm uses `--` to delimit arguments for a package script.  The
			// frontend tools should receive the actual arguments, while Tauri
			// needs its separator to forward trailing Cargo arguments.
			if (["frontend", "dev", "preview"].includes(mode)) {
				passthrough.push(...rest.slice(index + 1));
			} else {
				passthrough.push(token, ...rest.slice(index + 1));
			}
			break;
		}
		if (!afterSeparator && token === "--dry-run") {
			dryRun = true;
			continue;
		}
		if (!afterSeparator && token === "--rsdoctor") {
			if (diagnostics === "analyze") throw new Error("--rsdoctor and --analyze cannot be combined");
			diagnostics = "rsdoctor";
			continue;
		}
		if (!afterSeparator && token === "--analyze") {
			if (diagnostics === "rsdoctor") throw new Error("--rsdoctor and --analyze cannot be combined");
			diagnostics = "analyze";
			continue;
		}
		if (!afterSeparator && token === "--diagnostics") {
			const value = rest[index + 1];
			if (!value || value.startsWith("--")) throw new Error("Missing value for --diagnostics");
			if (!["none", "rsdoctor", "analyze"].includes(value)) {
				throw new Error(`Unsupported diagnostics mode: ${value}`);
			}
			if (diagnostics !== "none" && diagnostics !== value) {
				throw new Error("Only one diagnostics mode can be selected");
			}
			diagnostics = value;
			index += 1;
			continue;
		}
		if (!afterSeparator && token.startsWith("--diagnostics=")) {
			const value = token.slice("--diagnostics=".length);
			if (!["none", "rsdoctor", "analyze"].includes(value)) {
				throw new Error(`Unsupported diagnostics mode: ${value}`);
			}
			if (diagnostics !== "none" && diagnostics !== value) {
				throw new Error("Only one diagnostics mode can be selected");
			}
			diagnostics = value;
			continue;
		}
		if (!afterSeparator && token === "--flavor") {
			const value = rest[index + 1];
			if (!value || value.startsWith("--")) throw new Error("Missing value for --flavor");
			flavor = value;
			index += 1;
			continue;
		}
		if (!afterSeparator && token.startsWith("--flavor=")) {
			flavor = token.slice("--flavor=".length);
			continue;
		}
		if (!afterSeparator && (token === "--config" || token.startsWith("--config="))) {
			hasTauriConfig = true;
		}
		passthrough.push(token);
	}

	if (flavor !== "public" && flavor !== "custom") throw new Error(`Unsupported build flavor: ${flavor}`);
	if (diagnostics !== "none" && !["frontend", "dev"].includes(mode)) {
		throw new Error(`${diagnostics} diagnostics are supported only for frontend and dev modes`);
	}
	return { mode, flavor, diagnostics, dryRun, passthrough, hasTauriConfig };
}

function hasFlag(args, flag) {
	return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

function withDefaultFlag(args, flag, value) {
	return hasFlag(args, flag) ? args : [flag, value, ...args];
}

function commandFor({ mode, flavor, diagnostics, passthrough, hasTauriConfig }) {
	const env = { ...process.env, CARGO_TARGET_DIR: tauriTargetDirectory };
	if (flavor === "custom") env.PUBLIC_BUILD_FLAVOR = "custom";
	else delete env.PUBLIC_BUILD_FLAVOR;
	delete env.RSDOCTOR;
	delete env.BUNDLE_ANALYZE;
	if (diagnostics === "rsdoctor") env.RSDOCTOR = "true";
	if (diagnostics === "analyze") env.BUNDLE_ANALYZE = "true";
	const pnpm = ["frontend", "dev", "preview", "tauri", "tauri-dev"].includes(mode) ? getPnpmRunner() : null;

	if (mode === "frontend") {
		return { command: pnpm.command, args: [...pnpm.args, "exec", "rsbuild", "build", ...passthrough], cwd: repositoryRoot, env };
	}
	if (mode === "dev") {
		return {
			command: pnpm.command,
			args: [...pnpm.args, "exec", "rsbuild", "dev", ...withDefaultFlag(passthrough, "--port", "8083")],
			cwd: repositoryRoot,
			env,
		};
	}
	if (mode === "preview") {
		return {
			command: pnpm.command,
			args: [...pnpm.args, "exec", "rsbuild", "preview", ...passthrough],
			cwd: repositoryRoot,
			env,
		};
	}
	if (mode === "tauri" || mode === "tauri-dev") {
		const action = mode === "tauri" ? "build" : "dev";
		const args = ["exec", "tauri", action];
		if (flavor === "custom" && !hasTauriConfig) {
			args.push("--config", customConfig);
		}
		return { command: pnpm.command, args: [...pnpm.args, ...args, ...passthrough], cwd: repositoryRoot, env };
	}
	if (mode === "cargo-check") {
		return { command: cargo, args: ["check", "--locked", ...passthrough], cwd: tauriRoot, env };
	}
	return null;
}

function usage() {
	console.log(`Snow Shot build entry point

Usage:
  node scripts/build.mjs frontend [--flavor custom]
  node scripts/build.mjs dev [--flavor custom] [--rsdoctor]
  node scripts/build.mjs preview [preview args]
  node scripts/build.mjs tauri [--flavor custom] [tauri args]
  node scripts/build.mjs tauri-dev [--flavor custom] [tauri args]
  node scripts/build.mjs cargo-check [cargo args]
  node scripts/build.mjs paths

Diagnostics:
  --rsdoctor       enable Rsdoctor for frontend build/dev
  --analyze        write a static bundle analysis report

Build outputs:
  frontend: ${frontendOutputDirectory}
  tauri:    ${tauriTargetDirectory}
`);
}

let parsed;
try {
	parsed = parseArgs(process.argv.slice(2));
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
}

if (process.exitCode) {
	// Parsing failed; avoid starting a child process.
} else if (parsed.mode === "help" || parsed.mode === "--help" || parsed.mode === "-h") {
	usage();
} else if (parsed.mode === "paths") {
	console.log(JSON.stringify({ frontendOutputDirectory, tauriTargetDirectory }, null, 2));
} else if (parsed.mode === "bundle-path") {
	const target = parsed.passthrough[0];
	if (!target) fail("bundle-path requires a target triple");
	else console.log(targetBundleDirectory(target));
} else {
	try {
		const command = commandFor(parsed);
		if (!command) {
			fail(`Unknown build mode: ${parsed.mode}`);
		} else if (parsed.dryRun) {
			console.log(
				JSON.stringify(
					{
						...command,
						env: {
							CARGO_TARGET_DIR: command.env.CARGO_TARGET_DIR,
							PUBLIC_BUILD_FLAVOR: command.env.PUBLIC_BUILD_FLAVOR,
							RSDOCTOR: command.env.RSDOCTOR,
							BUNDLE_ANALYZE: command.env.BUNDLE_ANALYZE,
						},
					},
					null,
				),
			);
		} else {
			const child = spawn(command.command, command.args, {
				cwd: command.cwd,
				env: command.env,
				stdio: "inherit",
				windowsHide: true,
				shell: false,
			});
			child.once("error", (error) => {
				fail(`could not start ${command.command}: ${error.message}`);
			});
			child.once("exit", (code, signal) => {
				if (signal) {
					fail(`${command.command} terminated by ${signal}`);
				} else if (code !== 0) {
					process.exitCode = code ?? 1;
				}
			});
		}
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
}
