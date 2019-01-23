'use strict';
const mimicFn = require('mimic-fn');
const isPromise = require('p-is-promise');
const mapAgeCleaner = require('map-age-cleaner');

const cacheStore = new WeakMap();

const defaultCacheKey = (...args) => {
	if (args.length === 0) {
		return '__defaultKey';
	}

	if (args.length === 1) {
		const [firstArgument] = args;
		if (
			firstArgument === null ||
			firstArgument === undefined ||
			(typeof firstArgument !== 'function' && typeof firstArgument !== 'object')
		) {
			return firstArgument;
		}
	}

	return JSON.stringify(args);
};

module.exports = (fn, options) => {
	options = Object.assign(
		{
			cacheKey: defaultCacheKey,
			cache: new Map(),
			cachePromiseRejection: false,
		},
		options,
	);

	if (typeof options.maxAge === 'number') {
		mapAgeCleaner(options.cache);
	}

	const {cache} = options;
	options.maxAge = options.maxAge || 0;

	const setData = async (key, data) => {
		await cache.set(key, {
			data,
			maxAge: Date.now() + options.maxAge,
		});
	};

	const memoized = async function(...args) {
		const key = options.cacheKey(...args);

		if (await cache.has(key)) {
			const c = await cache.get(key);

			return c.data;
		}

		const ret = fn.call(this, ...args);

		await setData(key, ret);

		if (isPromise(ret) && options.cachePromiseRejection === false) {
			// Remove rejected promises from cache unless `cachePromiseRejection` is set to `true`
			ret.catch(() => cache.delete(key));
		}

		return ret;
	};

	mimicFn(memoized, fn);

	cacheStore.set(memoized, options.cache);

	return memoized;
};

module.exports.clear = async fn => {
	const cache = cacheStore.get(fn);

	if (cache && typeof cache.clear === 'function') {
		await cache.clear();
	}
};
