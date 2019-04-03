import * as assert from "assert"
import * as bufferWriter from "../../src/utils/bufferWriter"

export namespace bufferWriterTest {

	export function capacityTest() {
		const writer = new bufferWriter.BufferWriter({ capacity: 2 })
		assert.strictEqual(writer.length, 0)
		assert.strictEqual(writer.capacity, 2)
		writer.capacity = 100
		assert.strictEqual(writer.capacity, 100)
		writer.ensureCapacity(101)
		assert.ok(writer.capacity >= 101)
	}

	export function writeTest() {
		const writer = new bufferWriter.BufferWriter()
		writer.write(Buffer.from([49]))
		writer.write(Buffer.from([47, 99]))
		assert.deepStrictEqual(writer.toBuffer().toJSON().data, [49, 47, 99])

		assert.strictEqual(new bufferWriter.BufferWriter().toBuffer().toString(), "")
	}

}