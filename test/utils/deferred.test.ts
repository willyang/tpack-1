import * as assert from "assert"
import * as deferred from "../../src/utils/deferred"

export namespace deferredTest {

	export async function deferredTest() {
		let value = 1
		const q = new deferred.Deferred()
		q.reject()
		q.reject()
		q.resolve()
		setTimeout(() => {
			q.resolve()
			assert.strictEqual(++value, 3)
		}, 1)
		assert.strictEqual(++value, 2)
		await q.promise
		assert.strictEqual(++value, 4)
	}

}