import { en } from "./en";
import { enAppearance } from "./en/appearance";
import { zhHans } from "./zhHans";
import { zhHant } from "./zhHant";
import { zhHantAppearance } from "./zhHant/appearance";

export const messages = {
	"zh-Hans": zhHans,
	"zh-Hant": { ...zhHans, ...zhHant, ...zhHantAppearance },
	en: { ...zhHans, ...en, ...enAppearance },
};
