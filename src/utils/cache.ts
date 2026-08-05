// 缓存数据类型
interface CacheData<T> {
	data: T;
	timestamp: number;
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

export const getCachedData = <T>(
	key: string,
	duration = 5 * 60 * 1000,
): T | undefined => {
	const cached = getCacheFromStorage<T>(key);
	if (!cached) {
		return undefined;
	}

	if (Date.now() - cached.timestamp < duration) {
		return cached.data;
	}

	removeCacheFromStorage(key);
	return undefined;
};

export const setCachedData = <T>(key: string, data: T): void => {
	setCacheToStorage(key, {
		data,
		timestamp: Date.now(),
	});
};
