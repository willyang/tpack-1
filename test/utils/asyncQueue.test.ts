import * as assert from "assert"
import * as asyncQueue from "../../src/utils/asyncQueue"

export namespace asyncQueueTest {

	export async function asyncQueueTest() {
		let value = 1
		const q = new asyncQueue.AsyncQueue()

		await q
		assert.strictEqual(++value, 2)
		setTimeout(() => q.next(), 1)

		await q
		assert.strictEqual(++value, 3)
		setTimeout(() => q.next(), 1)

		await q
		assert.strictEqual(++value, 4)
		setTimeout(() => q.next(), 1)
	}

	export async function asyncQueue2Test() {
		let value = 1
		const q = new asyncQueue.AsyncQueue()

		async function fn(current) {
			await q
			assert.strictEqual(++value, current)
			setTimeout(() => q.next(), 1)
		}

		fn(2)
		fn(3)
		fn(4)

		await q
		q.next()
	}

}