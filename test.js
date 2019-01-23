import test from 'ava';
import delay from 'delay';
import mem from '.';

test('memoize', async t => {
	let i = 0;
	const f = () => i++;
	const memoized = mem(f);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized('foo'), 1);
	t.is(await memoized('foo'), 1);
	t.is(await memoized('foo'), 1);
	t.is(await memoized('foo', 'bar'), 2);
	t.is(await memoized('foo', 'bar'), 2);
	t.is(await memoized('foo', 'bar'), 2);
});

test('memoize with multiple non-primitive arguments', async t => {
	let i = 0;
	const memoized = mem(() => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized({foo: true}, {bar: false}), 1);
	t.is(await memoized({foo: true}, {bar: false}), 1);
	t.is(await memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(await memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test.failing('memoize with regexp arguments', async t => {
	let i = 0;
	const memoized = mem(() => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(/Sindre Sorhus/), 1);
	t.is(await memoized(/Sindre Sorhus/), 1);
	t.is(await memoized(/Elvin Peng/), 2);
	t.is(await memoized(/Elvin Peng/), 2);
});

test.failing('memoize with Symbol arguments', async t => {
	let i = 0;
	const arg1 = Symbol('fixture1');
	const arg2 = Symbol('fixture2');
	const memoized = mem(() => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(arg1), 1);
	t.is(await memoized(arg1), 1);
	t.is(await memoized(arg2), 2);
	t.is(await memoized(arg2), 2);
	t.is(await memoized({foo: arg1}), 3);
	t.is(await memoized({foo: arg1}), 3);
	t.is(await memoized({foo: arg2}), 4);
	t.is(await memoized({foo: arg2}), 4);
});

test('maxAge option', async t => {
	let i = 0;
	const f = () => i++;
	const memoized = mem(f, {maxAge: 100});
	t.is(await memoized(1), 0);
	t.is(await memoized(1), 0);
	await delay(50);
	t.is(await memoized(1), 0);
	await delay(200);
	t.is(await memoized(1), 1);
});

test('maxAge option deletes old items', async t => {
	let i = 0;
	const f = () => i++;
	const cache = new Map();
	const deleted = [];
	const remove = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return remove(item);
	};
	const memoized = mem(f, {maxAge: 100, cache});
	t.is(await memoized(1), 0);
	t.is(await memoized(1), 0);
	t.is(cache.has(1), true);
	await delay(50);
	t.is(await memoized(1), 0);
	t.is(deleted.length, 0);
	await delay(200);
	t.is(await memoized(1), 1);
	t.is(deleted.length, 1);
	t.is(deleted[0], 1);
});

test('maxAge items are deleted even if function throws', async t => {
	let i = 0;
	const f = () => {
		if (i === 1) {
			throw new Error('failure');
		}
		return i++;
	};
	const cache = new Map();
	const memoized = mem(f, {maxAge: 100, cache});
	t.is(await memoized(1), 0);
	t.is(await memoized(1), 0);
	t.is(cache.size, 1);
	await delay(50);
	t.is(await memoized(1), 0);
	await delay(200);
	await t.throwsAsync(() => memoized(1), 'failure'); // eslint-disable-line no-return-await
	t.is(cache.size, 0);
});

test('cacheKey option', async t => {
	let i = 0;
	const f = () => i++;
	const memoized = mem(f, {cacheKey: x => x});
	t.is(await memoized(1), 0);
	t.is(await memoized(1), 0);
	t.is(await memoized(1, 2), 0);
	t.is(await memoized(2), 1);
	t.is(await memoized(2, 1), 1);
});

test('cache option', async t => {
	let i = 0;
	const f = () => i++;
	const memoized = mem(f, {
		cache: new WeakMap(),
		cacheKey: x => x
	});
	const foo = {};
	const bar = {};
	t.is(await memoized(foo), 0);
	t.is(await memoized(foo), 0);
	t.is(await memoized(bar), 1);
	t.is(await memoized(bar), 1);
});

test('promise support', async t => {
	let i = 0;
	const memoized = mem(async () => i++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(10), 1);
});

test('do not cache rejected promises', async t => {
	let i = 0;
	const memoized = mem(async () => {
		i++;

		if (i === 1) {
			throw new Error('foo bar');
		}

		return i;
	});

	await t.throwsAsync(memoized(), 'foo bar');

	const first = await memoized();
	const second = await memoized();
	const third = await memoized();

	t.is(await first, 2);
	t.is(await second, 2);
	t.is(await third, 2);
});

test('cache rejected promises if enabled', async t => {
	let i = 0;
	const memoized = mem(
		async () => {
			i++;

			if (i === 1) {
				throw new Error('foo bar');
			}

			return i;
		},
		{
			cachePromiseRejection: true
		}
	);

	await t.throwsAsync(memoized(), 'foo bar');
	await t.throwsAsync(memoized(), 'foo bar');
	await t.throwsAsync(memoized(), 'foo bar');
});

test('preserves the original function name', t => {
	t.is(mem(function foo() {}).name, 'foo'); // eslint-disable-line func-names, prefer-arrow-callback
});

test('.clear()', async t => {
	let i = 0;
	const f = () => i++;
	const memoized = mem(f);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	mem.clear(memoized);
	t.is(await memoized(), 1);
	t.is(await memoized(), 1);
});

test('prototype support', async t => {
	const f = function() {
		return this.i++;
	};

	const Unicorn = function() {
		this.i = 0;
	};
	Unicorn.prototype.foo = mem(f);

	const unicorn = new Unicorn();

	t.is(await unicorn.foo(), 0);
	t.is(await unicorn.foo(), 0);
	t.is(await unicorn.foo(), 0);
});
