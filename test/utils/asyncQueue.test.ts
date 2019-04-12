import * as assert from "assert"
import * as asyncQueue from "../../src/utils/asyncQueue"

export namespace asyncQueueTest {

	export async function runTest() {
		let value = 1
		const q = new asyncQueue.AsyncQueue()

		q.run(() => {
			assert.strictEqual(++value, 2)
			return new Promise(r => setTimeout(r, 2))
		})

		q.run(() => {
			assert.strictEqual(++value, 3)
			return new Promise(r => setTimeout(r, 1))
		})

		q.run(() => {
			assert.strictEqual(++value, 4)
			return new Promise(r => setTimeout(r, 1))
		})

		assert.strictEqual(q.isEmpty, false)
		await q.promise()
		assert.strictEqual(q.isEmpty, true)
	}

	export async function runPromiseTest() {
		let value = 1
		const q = new asyncQueue.AsyncQueue()
		assert.strictEqual(await q.runPromise(async () => {
			await sleep(2)
			return ++value
		}), 2)
		assert.strictEqual(await q.runPromise(async () => {
			await sleep(1)
			return ++value
		}), 3)
		assert.strictEqual(await q.runPromise(async () => {
			await sleep(1)
			return ++value
		}), 4)

		await q.promise()

		function sleep(timeout) {
			return new Promise(r => setTimeout(r, timeout))
		}
	}

}