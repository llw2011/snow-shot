import { removeDir, textFileClear } from "@/commands/file";
import { getConfigDirPath } from "./environment";

export const clearAllConfig = async () => {
	await Promise.all([textFileClear(), removeDir(await getConfigDirPath())]);
};
