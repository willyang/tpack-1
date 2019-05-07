import * as assert from "assert"
import * as base64 from "../../src/utils/base64"

export namespace base64Test {

	export function encodeBase64Test() {
		assert.strictEqual(base64.encodeBase64("foo"), "Zm9v")
		assert.strictEqual(base64.encodeBase64(Buffer.from("foo")), "Zm9v")

		assert.strictEqual(base64.encodeBase64(""), "")
		assert.strictEqual(base64.encodeBase64(Buffer.from("")), "")
	}

	export function decodeBase64Test() {
		assert.strictEqual(base64.decodeBase64("Zm9v"), "foo")

		assert.strictEqual(base64.decodeBase64(""), "")
		assert.strictEqual(base64.decodeBase64("A"), "", "Should ignore error")
	}

	export function encodeDataURITest() {
		assert.strictEqual(base64.encodeDataURI("text/javascript", "foo"), "data:text/javascript;base64,Zm9v")
		assert.strictEqual(base64.encodeDataURI("text/javascript", Buffer.from("foo")), "data:text/javascript;base64,Zm9v")
	}

	export function decodeDataURITest() {
		assert.strictEqual(base64.decodeDataURI("data:text/javascript;base64,Zm9v")!.mimeType, "text/javascript")
		assert.strictEqual(base64.decodeDataURI("data:text/javascript;base64,Zm9v")!.data.toString(), "foo")

		assert.strictEqual(base64.decodeDataURI("data:text/javascript;base64,")!.mimeType, "text/javascript")
		assert.strictEqual(base64.decodeDataURI("data:text/javascript;base64,")!.data.toString(), "")

		assert.strictEqual(base64.decodeDataURI("data:text/javascript;base64"), null)
	}

}