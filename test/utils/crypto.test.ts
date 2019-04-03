import * as assert from "assert"
import * as crypto from "../../src/utils/crypto"

export namespace cryptoTest {

	export function sha1Test() {
		assert.strictEqual(crypto.sha1("foo"), "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33")
	}

	export function md5Test() {
		assert.strictEqual(crypto.md5("foo"), "acbd18db4cc2f85cedef654fccc4a4d8")
	}

}