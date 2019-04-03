import * as assert from "assert"
import { EventEmitter } from "../../src/utils/eventEmitter"

export namespace eventEmitterTest {

	export function eventEmitterTest() {
		const ee = new EventEmitter()
		const func = (arg1: any, arg2: any) => {
			assert.strictEqual(arg1, "arg1")
			assert.strictEqual(arg2, "arg2")
		}
		ee.on("foo", func)
		ee.emit("foo", "arg1", "arg2")
		ee.off("foo", func)
		ee.emit("foo", "arg1-error", "arg2-error")

		ee.on("foo", func)
		ee.on("foo", func)
		ee.on("foo", func)
		ee.emit("foo", "arg1", "arg2")
		ee.off("foo", func)
		ee.emit("foo", "arg1", "arg2")
		ee.off("foo")
		ee.emit("foo", "arg1-error", "arg2-error")

		ee.on("foo", () => false)
		ee.on("foo", () => { assert.ok(false) })
		ee.emit("foo")
		ee.off()
	}

}