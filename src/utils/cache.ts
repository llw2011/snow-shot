// 缓存数据类型
export interface CacheData<T> {
	data: T;
	timestamp: number;
}

// 缓存配置
export interface CacheOptions {
	/** 缓存过期时间（毫秒），默认 5 分钟 */
	duration?: number;
	/** 缓存键名 */
	key: string;
}

// 缓存键前缀
const CACHE_PREFIX = "app-cache:";

// 获取完整的缓存键
const getCacheKey = (key: string) => `${CACHE_PREFIX}${key}`;

// 从 localStorage 获取缓存
const getCacheFromStorage = <T>(key: string): CacheData<T> | null => {
	try {
		const cacheKey = getCacheKey(key);
		const cached = localStorage.getItem(cacheKey);
		if (!cached) return null;

		return JSON.parse(cached) as CacheData<T>;
	} catch (error) {
		console.error(`读取缓存失败 [${key}]:`, error);
		return null;
	}
};

// 设置缓存到 localStorage
const setCacheToStorage = <T>(key: string, data: CacheData<T>): void => {
	try {
		const cacheKey = getCacheKey(key);
		localStorage.setItem(cacheKey, JSON.stringify(data));
	} catch (error) {
		console.error(`保存缓存失败 [${key}]:`, error);
	}
};

// 从 localStorage 删除缓存
const removeCacheFromStorage = (key: string): void => {
	try {
		const cacheKey = getCacheKey(key);
		localStorage.removeItem(cacheKey);
	} catch (error) {
		console.error(`删除缓存失败 [${key}]:`, error);
	}
};

/**
 * 带缓存的高阶函数
 * 将异步函数包装为带缓存功能的函数
 *
 * @param fn 原始异步函数
 * @param options 缓存配置选项
 * @returns 带缓存功能的新函数
 *
 * @example
 * ```ts
 * const getChatModelsWithCache = withCache(
 *   getChatModels,
 *   { key: 'chat-models', duration: 5 * 60 * 1000 }
 * );
 * ```
 */
export const withCache = <T>(
	fn: () => Promise<T | undefined>,
	options: CacheOptions,
) => {
	const { duration = 5 * 60 * 1000, key } = options;

	return async (): Promise<T | undefined> => {
		try {
			// 检查缓存
			const cached = getCacheFromStorage<T>(key);
			if (cached) {
				const now = Date.now();
				// 缓存未过期，返回缓存数据
				if (now - cached.timestamp < duration) {
					return cached.data;
				}
				// 缓存已过期，删除旧缓存
				removeCacheFromStorage(key);
			}

			// 执行原始函数
			const result = await fn();

			// 存储结果到缓存
			if (result !== undefined) {
				const cacheData: CacheData<T> = {
					data: result,
					timestamp: Date.now(),
				};
				setCacheToStorage(key, cacheData);
			}

			return result;
		} catch (error) {
			console.error(`缓存操作失败 [${key}]:`, error);
			// 缓存失败时直接执行原始函数
			return await fn();
		}
	};
};

/**
 * 清除指定缓存
 * @param key 缓存键名
 */
export const clearCache = (key: string) => {
	removeCacheFromStorage(key);
};

/**
 * 清除所有缓存
 */
export const clearAllCache = () => {
	try {
		// 获取所有 localStorage 的键
		const keys = Object.keys(localStorage);
		// 只删除以缓存前缀开头的键
		keys.forEach((key) => {
			if (key.startsWith(CACHE_PREFIX)) {
				localStorage.removeItem(key);
			}
		});
	} catch (error) {
		console.error("清除所有缓存失败:", error);
	}
};
