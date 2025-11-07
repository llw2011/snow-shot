import { invoke } from "@tauri-apps/api/core";

export const hotLoadPageInit = async (pageLimit: number) => {
	const result = await invoke<void>("hot_load_page_init", { pageLimit });
	return result;
};

export const hotLoadPageAddPage = async () => {
	const result = await invoke<void>("hot_load_page_add_page");
	return result;
};
