import * as assert from "assert"
import * as deferred from "../../src/utils/deferred"

export namespace deferredTest {

	export async function deferredTest() {
		const q = new deferred.Deferred()
		await q

		let value = 1
		q.reject()
		q.reject()
		q.resolve()
		setTimeout(() => {
			q.resolve()
			assert.strictEqual(++value, 3)
		}, 1)
		assert.strictEqual(++value, 2)

		await q
		assert.strictEqual(++value, 4)
	}

}