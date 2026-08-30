import { defineConfig } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/rspack";
import { frontendOutputDirectory } from "./scripts/build-config.mjs";

export default defineConfig({
	plugins: [pluginReact(), pluginNodePolyfill()],
	resolve: {
		alias: {
			"@": "./src",
		},
	},
	output: {
		cleanDistPath: true,
		distPath: {
			root: frontendOutputDirectory,
		},
	},
	performance: {
		chunkSplit: {
			strategy: "split-by-module",
		},
	},
	html: {
		tags: [
			{
				tag: "script",
				attrs: {
					src:
						import.meta.env.PUBLIC_ONLINE_STATUS === "true"
							? "/scripts/excalidraw.js"
							: "/scripts/excalidraw.offline.js",
				},
			},
			{
				tag: "script",
				attrs: {
					src: "/scripts/markdownItFix.js",
				},
			},
		],
	},
	tools: {
		swc: {
			jsc: {
				experimental: {
					plugins: [["@swc/plugin-styled-jsx", {}]],
				},
			},
		},
		rspack: {
			plugins: [
				tanstackRouter({
					target: "react",
					autoCodeSplitting: true,
				}),
			],
			optimization: {},
		},
	},
});
