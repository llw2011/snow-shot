import { en } from "./en";
import { zhHans } from "./zhHans";
import { zhHant } from "./zhHant";

export const messages = {
	"zh-Hans": zhHans,
	"zh-Hant": { ...zhHans, ...zhHant },
	en: { ...zhHans, ...en },
};
