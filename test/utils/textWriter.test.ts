import * as assert from "assert"
import * as sourceMap from "../../src/utils/sourceMap"
import * as textWriter from "../../src/utils/textWriter"

export namespace textWriterTest {

	export function writeTest() {
		const writer = new textWriter.TextWriter()

		writer.write("A")
		assert.strictEqual(writer.toString(), "A")

		writer.write("_B_", 1, 2)
		assert.strictEqual(writer.toString(), "AB")
	}

	export function writeSourceMapTest() {
		const writer = new textWriter.SourceMapTextWriter()

		writer.write("A")
		assert.strictEqual(writer.toString(), "A")

		writer.write("_B_", 1, 2)
		assert.strictEqual(writer.toString(), "AB")

		writer.write("C", undefined, undefined, "goo.js")
		assert.strictEqual(writer.toString(), "ABC")

		writer.write("_D_", 1, 2, "hoo.js", undefined, 2, 0)
		assert.strictEqual(writer.toString(), "ABCD")

		writer.write("", 0, 0, "empty.js")
		assert.strictEqual(writer.toString(), "ABCD")

		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true), null)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true), null)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 2, true, true)!.sourcePath, "goo.js")

		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 2, true, true)!.line, 0)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 2, true, true)!.column, 0)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 3, true, true)!.sourcePath, "hoo.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 3, true, true)!.line, 2)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 3, true, true)!.column, 0)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 4, true, true)!.sourcePath, "empty.js")
	}

	export function indentTest() {
		const writer = new textWriter.TextWriter()
		writer.indent()
		writer.write("A")
		writer.unindent()
		assert.strictEqual(writer.toString(), "\tA")

		writer.indent()
		writer.write("\nB")
		writer.unindent()
		assert.strictEqual(writer.toString(), "\tA\n\tB")

		writer.indent()
		writer.write("\r\nR")
		writer.unindent()
		assert.strictEqual(writer.toString(), "\tA\n\tB\r\n\tR")
	}

	export function indentSourceMapTest() {
		const writer = new textWriter.SourceMapTextWriter()
		writer.indent()
		writer.write("A")
		writer.unindent()
		assert.strictEqual(writer.toString(), "\tA")

		writer.indent()
		writer.write("\nB")
		writer.unindent()
		assert.strictEqual(writer.toString(), "\tA\n\tB")

		writer.indent()
		writer.write("\r\nR")
		writer.unindent()
		assert.strictEqual(writer.toString(), "\tA\n\tB\r\n\tR")
	}

	export function mergeSourceMapTest() {
		const map = new sourceMap.SourceMapBuilder()
		map.file = "goo.js"
		map.addMapping(1, 1, "hoo.js", 100, 101, "B")
		map.addMapping(1, 2, "hoo2.js", 200, 201, "C")

		const writer = new textWriter.SourceMapTextWriter()
		writer.write("\r\nABC", undefined, undefined, "goo.js", map, 0, 0)
		assert.strictEqual(writer.toString(), "\r\nABC")

		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 0, true, true), null)

		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 1, true, true)!.sourcePath, "hoo.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 1, true, true)!.line, 100)
		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 1, true, true)!.column, 101)
		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 1, true, true)!.name, "B")

		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 2, true, true)!.sourcePath, "hoo2.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 2, true, true)!.line, 200)
		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 2, true, true)!.column, 201)
		assert.strictEqual(writer.sourceMapBuilder.getSource(1, 2, true, true)!.name, "C")
	}

	export function mergeSourceMapTest2() {
		const map = new sourceMap.SourceMapBuilder()
		map.file = "goo.js"
		map.addMapping(0, 0, "hoo1.js", 11, 1, "A")
		map.addMapping(0, 1, "hoo2.js", 12, 2, "B")
		map.addMapping(0, 2, "hoo3.js", 13, 3, "C")
		map.addMapping(0, 3, "hoo4.js", 14, 4, "D")

		const writer = new textWriter.SourceMapTextWriter()
		writer.write("ABC", 1, undefined, "goo.js", map, 0, 1)
		assert.strictEqual(writer.toString(), "BC")

		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.sourcePath, "hoo2.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.line, 12)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.column, 2)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.name, "B")

		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.sourcePath, "hoo3.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.line, 13)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.column, 3)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.name, "C")
	}

	export function mergeSourceMapTest3() {
		const map = new sourceMap.SourceMapBuilder()
		map.file = "goo.js"
		map.addMapping(0, 0, "hoo1.js", 11, 1, "A")
		map.addMapping(0, 1, "hoo2.js", 12, 2, "B")
		map.addMapping(0, 2, "hoo3.js", 13, 3, "C")
		map.addMapping(1, 3, "hoo4.js", 14, 4, "D")

		const writer = new textWriter.SourceMapTextWriter()
		writer.write("AB\rC", 1, undefined, "goo.js", map, 0, 1)
		assert.strictEqual(writer.toString(), "B\rC")

		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.sourcePath, "hoo2.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.line, 12)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.column, 2)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 0, true, true)!.name, "B")

		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.sourcePath, "hoo3.js")
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.line, 13)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.column, 3)
		assert.strictEqual(writer.sourceMapBuilder.getSource(0, 1, true, true)!.name, "C")

		assert.strictEqual(writer.sourceMap.version, 3)
	}

	export function mergeSourceMapTest4() {
		const writer = new textWriter.SourceMapTextWriter()
		writer.write("A\n", 0, 2, "other.js")
		writer.write("B\n", 0, 2, "other.js")
		assert.strictEqual(writer.toString(), "A\nB\n")
	}

}