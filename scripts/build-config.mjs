#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const buildRoot = join(repositoryRoot, ".tmp", "build");
export const frontendOutputDirectory = join(buildRoot, "frontend");
export const tauriTargetDirectory = join(buildRoot, "tauri-target");
export const stagingRoot = join(buildRoot, "staging");

const SAFE_COMPONENT = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SAFE_VERSION = /^\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$/;

function component(value, name) {
	if (!value || !SAFE_COMPONENT.test(value)) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return value;
}

function safeVersion(value) {
	if (!value || !SAFE_VERSION.test(value)) {
		throw new Error(`Invalid version: ${value}`);
	}
	return value;
}

export function targetBundleDirectory(target, profile = "release") {
	return join(tauriTargetDirectory, component(target, "target"), component(profile, "profile"), "bundle");
}

export function stagingDirectory(version, kind) {
	return join(stagingRoot, safeVersion(version), component(kind, "kind"));
}

export function projectPath(value) {
	return resolve(repositoryRoot, value);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	const [command = "json", ...args] = process.argv.slice(2);
	if (command !== "json") {
		console.error(`Unknown build-config command: ${command}`);
		process.exitCode = 1;
	} else {
		const [target, version, kind] = args;
		const paths = {
			repositoryRoot,
			buildRoot,
			frontendOutputDirectory,
			tauriTargetDirectory,
			stagingRoot,
		};
		if (target) paths.targetBundleDirectory = targetBundleDirectory(target);
		if (version && kind) paths.stagingDirectory = stagingDirectory(version, kind);
		console.log(JSON.stringify(paths, null, 2));
	}
}
