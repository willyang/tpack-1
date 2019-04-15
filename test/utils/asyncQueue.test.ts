import * as assert from "assert"
import * as asyncQueue from "../../src/utils/asyncQueue"

export namespace asyncQueueTest {

	export async function runTest() {
		let value = 1
		const q = new asyncQueue.AsyncQueue()
		assert.strictEqual(await q.run(async () => {
			await sleep(2)
			return ++value
		}), 2)
		assert.deepStrictEqual(await Promise.all([q.run(async () => {
			await sleep(2)
			return ++value
		}), q.run(async () => {
			await sleep(1)
			return ++value
		})]), [3, 4])

		function sleep(ms: number) {
			return new Promise(r => setTimeout(r, ms))
		}
	}

}