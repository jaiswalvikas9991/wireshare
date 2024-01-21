export const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

const logPassed = (test: unknown) => console.log('Passed: ', test);
const logTimedOut = (test: unknown) => console.log('%c' + 'Timeout : ' + test, 'color:#cc2900');
const logWaiting = (last: number, test: unknown) => {
	if (Date.now() - last > 1000) {
		last = Date.now();
		console.log('%c' + 'waiting for: ' + test, 'color:#809fff');
	}
};
/**
 * Waits for the test function to return a truthy value
 * example usage:
 *    wait for an element to exist, then save it to a variable
 *        let el = await waitFor(() => document.querySelector('#el_id')))
 *    timeout_ms and frequency are optional parameters
 */
export async function waitFor<T>(
	test: () => T | Promise<T>,
	timeout_ms = 20 * 1000,
	timeBetweenChecks = 200
) {
	let last = Date.now();

	const endTime = Date.now() + timeout_ms;

	let result = null;
	while (!result) {
		const mayBePromise = test();
		if (mayBePromise instanceof Promise) {
			result = await mayBePromise;
		}
		else {
			result = mayBePromise;
		}
		if (Date.now() > endTime) {
			logTimedOut(test);
			return null;
		}
		logWaiting(last, test);
		await sleep(timeBetweenChecks);
	}
	logPassed(test);
	return result;
}

/**
 * Return will always be of size 5
**/
export const toBase256 = (base10: number) => {
	const base = 256;
	const ans = [];
	while (base10 != 0) {
		ans.push(base10 % base);
		base10 = Math.floor(base10 / base);
	}
	while (ans.length < 5) ans.push(0);
	if (ans.length > 5) throw new Error('Number if very very big');
	return ans.reverse();
};

// TODO: Potential for improvement
export const toBase10 = (base256: number[]) => {
	if (base256.length > 5) throw new Error('Too Big number');
	let ans = 0;
	base256.reverse();
	const base = 256;
	for (let i = 0; i < base256.length; i++) ans += Math.pow(base, i) * base256[i];
	return ans;
};
