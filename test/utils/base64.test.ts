import * as assert from "assert"
import * as base64 from "../../src/utils/base64"

export namespace base64Test {

	export function encodeBase64Test() {
		assert.strictEqual(base64.encodeBase64("foo"), "Zm9v")
		assert.strictEqual(base64.encodeBase64(Buffer.from("foo")), "Zm9v")
	}

	export function decodeBase64Test() {
		assert.strictEqual(base64.decodeBase64("Zm9v"), "foo")
	}

	export function encodeDataUriTest() {
		assert.strictEqual(base64.encodeDataUri("text/javascript", "foo"), "data:text/javascript;base64,Zm9v")
		assert.strictEqual(base64.encodeDataUri("text/javascript", Buffer.from("foo")), "data:text/javascript;base64,Zm9v")
	}

	export function decodeDataUriTest() {
		assert.strictEqual(base64.decodeDataUri("data:text/javascript;base64,Zm9v")!.mimeType, "text/javascript")
		assert.strictEqual(base64.decodeDataUri("data:text/javascript;base64,Zm9v")!.data.toString(), "foo")
		assert.strictEqual(base64.decodeDataUri("data:text/javascript;base64"), null)
	}

}