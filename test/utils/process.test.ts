import * as assert from "assert"
import * as proc from "../../src/utils/process"

export namespace processTest {

	export async function execTest() {
		assert.strictEqual((await proc.exec("echo 1")).stdout.trim(), "1")
		assert.strictEqual((await proc.exec("exit 1")).status, 1)
	}

}