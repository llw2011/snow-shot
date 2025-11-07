const RANDOM_STRING_CHARS =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const randomString = (length: number) => {
	let result = "";
	for (let i = length; i > 0; --i) {
		result +=
			RANDOM_STRING_CHARS[
				Math.floor(Math.random() * RANDOM_STRING_CHARS.length)
			];
	}
	return result;
};
