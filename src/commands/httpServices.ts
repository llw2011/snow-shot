// endpoint: String,
// region: String,
// access_key_id: String,
// secret_access_key: String,
// bucket: String,
// path_prefix: Option<String>,
// force_path_style: bool,
// data: Vec<u8>,
// filename: String,

import { invoke } from "@tauri-apps/api/core";
import { Base64 } from "js-base64";

export const uploadToS3 = async (
	endpoint: string,
	region: string,
	access_key_id: string,
	secret_access_key: string,
	bucket: string,
	path_prefix: string | undefined,
	force_path_style: boolean,
	data: Uint8Array | ArrayBuffer,
	filename: string,
	content_type: string | undefined,
) => {
	const result = await invoke<string>("upload_to_s3", data, {
		headers: {
			"x-endpoint": Base64.encode(endpoint),
			"x-region": Base64.encode(region),
			"x-access-key-id": Base64.encode(access_key_id),
			"x-secret-access-key": Base64.encode(secret_access_key),
			"x-bucket": Base64.encode(bucket),
			"x-path-prefix": Base64.encode(path_prefix ?? ""),
			"x-force-path-style": Base64.encode(force_path_style.toString()),
			"x-content-type": Base64.encode(content_type ?? ""),
			"x-filename": Base64.encode(filename),
		},
	});
	return result;
};
