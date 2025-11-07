import { appWarn } from "./log";

/**
 * 播放音效的通用函数
 * @param soundPath 音效文件路径
 * @param volume 音量 (0-1)
 */
export const playSound = (soundPath: string, volume: number = 1) => {
	try {
		const audio = new Audio(soundPath);
		audio.volume = Math.max(0, Math.min(1, volume)); // 确保音量在0-1范围内
		audio.play().catch((error) => {
			appWarn(`[audio][playSound] Failed to play sound (${soundPath}):`, error);
		});
	} catch (error) {
		appWarn(
			`[audio][playSound] Failed to create audio object (${soundPath}):`,
			error,
		);
	}
};

export const playCameraShutterSound = () => {
	playSound("/audios/camera_shutter.mp3");
};
