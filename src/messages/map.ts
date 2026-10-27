import { en } from "./en";
import { enAppearance } from "./en/appearance";
import { enWorkbench } from "./en/workbench";
import { zhHans } from "./zhHans";
import { zhHant } from "./zhHant";
import { zhHantAppearance } from "./zhHant/appearance";
import { zhHantWorkbench } from "./zhHant/workbench";

/** Translated messages only, without the Simplified Chinese fallback. */
export const translatedMessages = {
	"zh-Hant": { ...zhHant, ...zhHantAppearance, ...zhHantWorkbench },
	en: { ...en, ...enAppearance, ...enWorkbench },
};

export const messages = {
	"zh-Hans": zhHans,
	"zh-Hant": { ...zhHans, ...translatedMessages["zh-Hant"] },
	en: { ...zhHans, ...translatedMessages.en },
};
