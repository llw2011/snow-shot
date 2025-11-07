import { Base64 } from "js-base64";

export const encodeParamsValue = (value: string) => {
	return encodeURIComponent(Base64.encode(value));
};

export const decodeParamsValue = (value: string) => {
	return Base64.decode(decodeURIComponent(value));
};
