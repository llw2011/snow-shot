type TauriInvokeArgs = Record<string, unknown> | unknown[] | undefined;

type DevTauriWindow = Window & {
	__SNOW_SHOT_DEV_TAURI_SHIM__?: boolean;
	__TAURI_INTERNALS__?: {
		metadata: {
			currentWindow: {
				label: string;
			};
		};
		plugins: {
			path: {
				sep: string;
				delimiter: string;
			};
		};
		invoke: <T = unknown>(
			command: string,
			args?: TauriInvokeArgs,
			options?: unknown,
		) => Promise<T>;
		transformCallback: (callback: (...args: unknown[]) => unknown) => number;
		unregisterCallback: (id: number) => void;
		convertFileSrc: (filePath: string, protocol?: string) => string;
	};
	__TAURI_OS_PLUGIN_INTERNALS__?: {
		platform: "windows";
		version: string;
		family: "windows";
		os_type: "windows";
		arch: "x86_64";
		exe_extension: "exe";
		eol: "\r\n";
	};
	__TAURI_EVENT_PLUGIN_INTERNALS__?: {
		unregisterListener: (event: string, eventId: number) => void;
	};
	isTauri?: boolean;
};

type PluginStatus = {
	name: string;
	status: "Installed";
};

const isLocalDevHost = () => {
	if (typeof window === "undefined") {
		return false;
	}

	return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

const joinPath = (paths: unknown[]) => {
	return paths
		.map((item) => `${item ?? ""}`)
		.filter(Boolean)
		.join("\\")
		.replace(/\\{2,}/g, "\\");
};

const installTauriBrowserShim = () => {
	if (process.env.NODE_ENV !== "development" || !isLocalDevHost()) {
		return;
	}

	const devWindow = window as unknown as DevTauriWindow;
	if (devWindow.__TAURI_INTERNALS__ || devWindow.__SNOW_SHOT_DEV_TAURI_SHIM__) {
		return;
	}

	const callbacks = new Map<number, (...args: unknown[]) => unknown>();
	const textFiles = new Map<string, string>();
	const pluginStatus = new Map<string, PluginStatus>();
	let nextCallbackId = 1;
	let nextEventId = 1;
	let nextResourceId = 1000;
	const storesByPath = new Map<string, number>();
	const storeDataByRid = new Map<number, Map<string, unknown>>();

	const baseConfigDir = "C:\\SnowShotDev";
	const appConfigDir = `${baseConfigDir}\\config`;

	const invoke = async <T = unknown>(
		command: string,
		args?: TauriInvokeArgs,
	): Promise<T> => {
		switch (command) {
			case "plugin:window|theme":
				return "dark" as T;
			case "plugin:window|is_focused":
			case "plugin:window|is_visible":
			case "plugin:window|is_resizable":
			case "plugin:window|is_decorated":
			case "plugin:window|is_closable":
			case "plugin:window|is_minimizable":
			case "plugin:window|is_maximizable":
				return true as T;
			case "plugin:window|is_fullscreen":
			case "plugin:window|is_minimized":
			case "plugin:window|is_maximized":
				return false as T;
			case "plugin:window|title":
				return "Snow Shot" as T;
			case "plugin:window|inner_size":
			case "plugin:window|outer_size":
				return { width: window.innerWidth, height: window.innerHeight } as T;
			case "plugin:window|inner_position":
			case "plugin:window|outer_position":
			case "plugin:window|cursor_position":
				return { x: 0, y: 0 } as T;
			case "plugin:window|scale_factor":
				return window.devicePixelRatio as T;

			case "plugin:event|listen":
				return nextEventId++ as T;
			case "plugin:event|emit":
			case "plugin:event|emit_to":
			case "plugin:event|unlisten":
			case "plugin:log|log":
			case "plugin:resources|close":
				return undefined as T;

			case "plugin:path|resolve_directory":
				return baseConfigDir as T;
			case "plugin:path|join":
			case "plugin:path|resolve":
				return joinPath(
					Array.isArray((args as Record<string, unknown>)?.paths)
						? ((args as Record<string, unknown>).paths as unknown[])
						: [],
				) as T;
			case "plugin:path|normalize":
			case "plugin:path|dirname":
			case "plugin:path|basename":
			case "plugin:path|extname":
				return `${(args as Record<string, unknown>)?.path ?? ""}` as T;
			case "plugin:path|is_absolute":
				return true as T;

			case "plugin:store|load": {
				const record = args as Record<string, unknown> | undefined;
				const path = `${record?.path ?? ""}`;
				const defaults = (
					record?.options as Record<string, unknown> | undefined
				)?.defaults as Record<string, unknown> | undefined;
				let rid = storesByPath.get(path);
				if (!rid) {
					rid = nextResourceId++;
					storesByPath.set(path, rid);
					storeDataByRid.set(rid, new Map(Object.entries(defaults ?? {})));
				}
				return rid as T;
			}
			case "plugin:store|get_store": {
				const path = `${(args as Record<string, unknown> | undefined)?.path ?? ""}`;
				return (storesByPath.get(path) ?? null) as T;
			}
			case "plugin:store|set": {
				const record = args as Record<string, unknown> | undefined;
				const store = storeDataByRid.get(Number(record?.rid));
				store?.set(`${record?.key ?? ""}`, record?.value);
				return undefined as T;
			}
			case "plugin:store|get": {
				const record = args as Record<string, unknown> | undefined;
				const store = storeDataByRid.get(Number(record?.rid));
				const key = `${record?.key ?? ""}`;
				return [store?.get(key), store?.has(key) ?? false] as T;
			}
			case "plugin:store|has": {
				const record = args as Record<string, unknown> | undefined;
				const store = storeDataByRid.get(Number(record?.rid));
				return (store?.has(`${record?.key ?? ""}`) ?? false) as T;
			}
			case "plugin:store|delete": {
				const record = args as Record<string, unknown> | undefined;
				const store = storeDataByRid.get(Number(record?.rid));
				store?.delete(`${record?.key ?? ""}`);
				return undefined as T;
			}
			case "plugin:store|clear":
			case "plugin:store|reset": {
				const store = storeDataByRid.get(
					Number((args as Record<string, unknown> | undefined)?.rid),
				);
				store?.clear();
				return undefined as T;
			}
			case "plugin:store|keys": {
				const store = storeDataByRid.get(
					Number((args as Record<string, unknown> | undefined)?.rid),
				);
				return Array.from(store?.keys() ?? []) as T;
			}
			case "plugin:store|values": {
				const store = storeDataByRid.get(
					Number((args as Record<string, unknown> | undefined)?.rid),
				);
				return Array.from(store?.values() ?? []) as T;
			}
			case "plugin:store|entries": {
				const store = storeDataByRid.get(
					Number((args as Record<string, unknown> | undefined)?.rid),
				);
				return Array.from(store?.entries() ?? []) as T;
			}
			case "plugin:store|length": {
				const store = storeDataByRid.get(
					Number((args as Record<string, unknown> | undefined)?.rid),
				);
				return (store?.size ?? 0) as T;
			}
			case "plugin:store|reload":
			case "plugin:store|save":
				return undefined as T;

			case "plugin:menu|new":
			case "plugin:menu|create_default":
				return [nextResourceId++, "dev-menu"] as T;
			case "plugin:menu|items":
				return [] as T;
			case "plugin:menu|get":
			case "plugin:menu|set_as_app_menu":
			case "plugin:menu|set_as_window_menu":
				return null as T;
			case "plugin:menu|append":
			case "plugin:menu|prepend":
			case "plugin:menu|insert":
			case "plugin:menu|remove":
			case "plugin:menu|popup":
				return undefined as T;

			case "plugin:tray|new":
				return [nextResourceId++, "dev-tray"] as T;
			case "plugin:tray|get_by_id":
			case "plugin:app|default_window_icon":
			case "plugin:image|from_path":
			case "plugin:image|from_bytes":
			case "plugin:image|new":
				return nextResourceId++ as T;
			case "plugin:image|size":
				return { width: 16, height: 16 } as T;
			case "plugin:image|rgba":
				return new ArrayBuffer(16 * 16 * 4) as T;
			case "plugin:tray|remove_by_id":
			case "plugin:tray|set_icon":
			case "plugin:tray|set_menu":
			case "plugin:tray|set_tooltip":
			case "plugin:tray|set_title":
			case "plugin:tray|set_visible":
			case "plugin:tray|set_temp_dir_path":
			case "plugin:tray|set_icon_as_template":
			case "plugin:tray|set_show_menu_on_left_click":
				return undefined as T;

			case "get_app_config_dir":
				return appConfigDir as T;
			case "get_app_config_base_dir":
				return baseConfigDir as T;
			case "create_dir":
			case "create_local_config_dir":
			case "text_file_write": {
				const record = args as Record<string, unknown> | undefined;
				if (typeof record?.filePath === "string") {
					textFiles.set(record.filePath, `${record.content ?? ""}`);
				}
				return undefined as T;
			}
			case "text_file_read": {
				const filePath = (args as Record<string, unknown> | undefined)
					?.filePath;
				if (typeof filePath === "string" && textFiles.has(filePath)) {
					return textFiles.get(filePath) as T;
				}
				throw new Error(`[dev-tauri-shim] file not found: ${filePath}`);
			}
			case "text_file_clear":
				textFiles.clear();
				return undefined as T;

			case "plugin_init":
				return undefined as T;
			case "plugin_register_plugin": {
				const name = (args as Record<string, unknown> | undefined)?.name;
				if (typeof name === "string") {
					pluginStatus.set(name, { name, status: "Installed" });
				}
				return undefined as T;
			}
			case "plugin_get_plugins_status":
				return Array.from(pluginStatus.values()) as T;
			case "plugin_install_plugin":
			case "plugin_install_local_plugin":
				return undefined as T;
			case "plugin_uninstall_plugin": {
				const name = (args as Record<string, unknown> | undefined)?.name;
				if (typeof name === "string") {
					pluginStatus.delete(name);
				}
				return undefined as T;
			}

			case "plugin:global-shortcut|is_registered":
				return false as T;
			case "plugin:global-shortcut|register":
			case "plugin:global-shortcut|unregister":
			case "plugin:global-shortcut|unregister_all":
			case "init_ui_elements":
			case "init_ui_elements_cache":
			case "set_enable_proxy":
			case "set_run_log":
			case "hot_load_page_init":
			case "create_draw_window":
			case "create_webview_shared_buffer":
			case "set_support_webview_shared_buffer":
			case "video_record_init":
			case "ocr_init":
				return undefined as T;

			case "get_capture_state":
				return { capturing: false } as T;
			case "get_read_clipboard_state":
				return { reading: false } as T;
			case "is_admin":
			case "has_video_record_window":
			case "has_focused_full_screen_window":
				return false as T;
			case "get_selected_text":
				return "" as T;
			case "video_record_get_microphone_device_names":
			case "get_window_elements":
				return [] as T;
			case "read_image_from_clipboard":
			case "capture_current_monitor":
			case "capture_all_monitors":
			case "capture_full_screen":
				return new ArrayBuffer(0) as T;

			default:
				return undefined as T;
		}
	};

	devWindow.__SNOW_SHOT_DEV_TAURI_SHIM__ = true;
	devWindow.__TAURI_OS_PLUGIN_INTERNALS__ = {
		platform: "windows",
		version: "10.0.0",
		family: "windows",
		os_type: "windows",
		arch: "x86_64",
		exe_extension: "exe",
		eol: "\r\n",
	};
	devWindow.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
		unregisterListener: () => undefined,
	};
	devWindow.__TAURI_INTERNALS__ = {
		metadata: {
			currentWindow: {
				label: "main",
			},
		},
		plugins: {
			path: {
				sep: "\\",
				delimiter: ";",
			},
		},
		invoke,
		transformCallback: (callback) => {
			const id = nextCallbackId++;
			callbacks.set(id, callback);
			return id;
		},
		unregisterCallback: (id) => {
			callbacks.delete(id);
		},
		convertFileSrc: (filePath, protocol = "asset") =>
			`${protocol}://localhost/${encodeURIComponent(filePath)}`,
	};
};

installTauriBrowserShim();
