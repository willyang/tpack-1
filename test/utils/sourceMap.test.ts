import * as assert from "assert"
import * as sourceMap from "../../src/utils/sourceMap"

export namespace sourceMapTest {

	const map = {
		version: 3,
		file: "example.js",
		sourceRoot: "sourceRoot",
		sources: [
			"source.js"
		],
		sourcesContent: [
			"sourceContent"
		],
		names: [
			"name"
		],
		mappings: ";AAAAA,IAAA;;AAAA,MAAA,GAAS,SAAC,CAAD"
	}

	function clean(obj?: sourceMap.SourceLocation | sourceMap.SourceLocation[]) {
		if (Array.isArray(obj)) {
			obj.forEach(clean)
		} else if (obj) {
			if (obj.line == undefined && obj.column == undefined) {
				obj = null
			} else {
				delete obj.mapping
				if (obj.name == undefined) {
					delete obj.name
				}
			}
		}
		return obj
	}

	export function toSourceMapStringTest() {
		assert.deepStrictEqual(JSON.parse(sourceMap.toSourceMapString(map)), map)
		assert.deepStrictEqual(JSON.parse(sourceMap.toSourceMapString(JSON.stringify(map))), map)
		assert.deepStrictEqual(JSON.parse(sourceMap.toSourceMapString(sourceMap.toSourceMapObject(map))), map)
		assert.deepStrictEqual(JSON.parse(sourceMap.toSourceMapString(sourceMap.toSourceMapBuilder(map))), map)
	}

	export function toSourceMapObjectTest() {
		assert.deepStrictEqual(sourceMap.toSourceMapObject(map), map)
		assert.deepStrictEqual(sourceMap.toSourceMapObject(JSON.stringify(map)), map)
		assert.deepStrictEqual(sourceMap.toSourceMapObject(sourceMap.toSourceMapObject(map)), map)
		assert.deepStrictEqual(sourceMap.toSourceMapObject(sourceMap.toSourceMapBuilder(map)), map)
		try { sourceMap.toSourceMapObject({ sections: [] } as any); } catch (e) { }
		try { sourceMap.toSourceMapObject({ version: 2 } as any); } catch (e) { }
	}

	export function toSourceMapBuilderTest() {
		assert.deepStrictEqual(sourceMap.toSourceMapBuilder(map).toJSON(), map)
		assert.deepStrictEqual(sourceMap.toSourceMapBuilder(JSON.stringify(map)).toJSON(), map)
		assert.deepStrictEqual(sourceMap.toSourceMapBuilder(sourceMap.toSourceMapObject(map)).toJSON(), map)
		assert.deepStrictEqual(sourceMap.toSourceMapBuilder(sourceMap.toSourceMapBuilder(map)).toJSON(), map)
	}

	export function addSourceTest() {
		const b = new sourceMap.SourceMapBuilder()
		assert.strictEqual(b.addSource("foo"), 0)
		assert.deepStrictEqual(b.sources, ["foo"])
		assert.strictEqual(b.addSource("goo"), 1)
		assert.deepStrictEqual(b.sources, ["foo", "goo"])
	}

	export function addNameTest() {
		const b = new sourceMap.SourceMapBuilder()
		assert.strictEqual(b.addName("b"), 0)
		assert.deepStrictEqual(b.names, ["b"])
	}

	export function getSourceContentTest() {
		const b = new sourceMap.SourceMapBuilder()
		assert.strictEqual(b.getSourceContent("b"), undefined)
		b.addSource("b")
		b.setSourceContent("b", "A")
		assert.strictEqual(b.getSourceContent("b"), "A")
	}

	export function setSourceContentTest() {
		const b = new sourceMap.SourceMapBuilder()
		b.addSource("b")
		b.setSourceContent("b", "A")
		assert.deepStrictEqual(b.sourcesContent, ["A"])
		b.setSourceContent("b", "B")
		assert.deepStrictEqual(b.sourcesContent, ["B"])
		b.setSourceContent("c", "C")
	}

	export function parseTest() {
		new sourceMap.SourceMapBuilder({} as any)
		const b = new sourceMap.SourceMapBuilder(map)
		assert.strictEqual(b.version, map.version)
		assert.strictEqual(b.file, map.file)
		assert.strictEqual(b.sourceRoot, map.sourceRoot)
		assert.deepStrictEqual(b.sources, map.sources)
		assert.deepStrictEqual(b.names, map.names)
		assert.deepStrictEqual(b.mappings, [
			[],
			[
				{ generatedColumn: 0, sourceIndex: 0, sourceLine: 0, sourceColumn: 0, nameIndex: 0 },
				{ generatedColumn: 4, sourceIndex: 0, sourceLine: 0, sourceColumn: 0 }
			],
			[],
			[
				{ generatedColumn: 0, sourceIndex: 0, sourceLine: 0, sourceColumn: 0 },
				{ generatedColumn: 6, sourceIndex: 0, sourceLine: 0, sourceColumn: 0 },
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 0, sourceColumn: 9 },
				{ generatedColumn: 18, sourceIndex: 0, sourceLine: 0, sourceColumn: 10 },
				{ generatedColumn: 19, sourceIndex: 0, sourceLine: 0, sourceColumn: 9 }
			]
		])

		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "A"
		})
		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "AA"
		})
		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "AAA"
		})
		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "AAAA"
		})
		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "AAAAA"
		})
		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "AAAAAAAAA"
		})
		new sourceMap.SourceMapBuilder({
			version: 3,
			sources: ["foo.js"],
			mappings: "AAAA,AAAAA,AAAAAA,AAAAAAAAA,AAAAAAAA,,;;a,9,+,/,g,h"
		})
	}

	export function toJSONAndToStringTest() {
		new sourceMap.SourceMapBuilder().toJSON()
		assert.deepStrictEqual(sourceMap.toSourceMapBuilder(map).toJSON(), map)
		assert.deepStrictEqual(JSON.parse(sourceMap.toSourceMapBuilder(map).toString()), map)
		assert.deepStrictEqual(JSON.parse(JSON.stringify(sourceMap.toSourceMapBuilder(map))), map)
		const a = new sourceMap.SourceMapBuilder()
		a.addMapping(10002, 1043433)
		const b = new sourceMap.SourceMapBuilder(a.toString())
		assert.strictEqual(b.mappings[10002][0].generatedColumn, 1043433)
	}

	export function getSourceTest() {
		const b = sourceMap.toSourceMapBuilder(map)
		assert.deepStrictEqual(clean(b.getSource(0, 0, true, true)), null)
		assert.deepStrictEqual(clean(b.getSource(0, 1, true, true)), null)
		assert.deepStrictEqual(clean(b.getSource(0, 2, true, true)), null)
		assert.deepStrictEqual(clean(b.getSource(1, 0, true, true)), { sourcePath: "source.js", line: 0, column: 0, name: "name" })
		assert.deepStrictEqual(clean(b.getSource(1, 1, true, true)), { sourcePath: "source.js", line: 0, column: 1, name: "name" })
		assert.deepStrictEqual(clean(b.getSource(1, 2, true, true)), { sourcePath: "source.js", line: 0, column: 2, name: "name" })
		assert.deepStrictEqual(clean(b.getSource(1, 3, true, true)), { sourcePath: "source.js", line: 0, column: 3, name: "name" })
		assert.deepStrictEqual(clean(b.getSource(1, 4, true, true)), { sourcePath: "source.js", line: 0, column: 0 })
		assert.deepStrictEqual(clean(b.getSource(1, 5, true, true)), { sourcePath: "source.js", line: 0, column: 1 })
		assert.deepStrictEqual(clean(b.getSource(1, 6, true, true)), { sourcePath: "source.js", line: 0, column: 2 })
		assert.deepStrictEqual(clean(b.getSource(2, 0, true, true)), { sourcePath: "source.js", line: 1, column: 0 })
		assert.deepStrictEqual(clean(b.getSource(2, 1, true, true)), { sourcePath: "source.js", line: 1, column: 1 })
		assert.deepStrictEqual(clean(b.getSource(3, 0, true, true)), { sourcePath: "source.js", line: 0, column: 0 })
		assert.deepStrictEqual(clean(b.getSource(3, 1, true, true)), { sourcePath: "source.js", line: 0, column: 1 })
		assert.deepStrictEqual(clean(b.getSource(3, 5, true, true)), { sourcePath: "source.js", line: 0, column: 5 })
		assert.deepStrictEqual(clean(b.getSource(3, 6, true, true)), { sourcePath: "source.js", line: 0, column: 0 })
		assert.deepStrictEqual(clean(b.getSource(3, 7, true, true)), { sourcePath: "source.js", line: 0, column: 1 })
		assert.deepStrictEqual(clean(b.getSource(3, 8, true, true)), { sourcePath: "source.js", line: 0, column: 2 })
		assert.deepStrictEqual(clean(b.getSource(3, 9, true, true)), { sourcePath: "source.js", line: 0, column: 9 })
		assert.deepStrictEqual(clean(b.getSource(3, 10, true, true)), { sourcePath: "source.js", line: 0, column: 10 })
		assert.deepStrictEqual(clean(b.getSource(3, 17, true, true)), { sourcePath: "source.js", line: 0, column: 17 })
		assert.deepStrictEqual(clean(b.getSource(3, 18, true, true)), { sourcePath: "source.js", line: 0, column: 10 })
		assert.deepStrictEqual(clean(b.getSource(3, 19, true, true)), { sourcePath: "source.js", line: 0, column: 9 })
		assert.deepStrictEqual(clean(b.getSource(3, 20, true, true)), { sourcePath: "source.js", line: 0, column: 10 })
		assert.deepStrictEqual(clean(b.getSource(3, 21, true, true)), { sourcePath: "source.js", line: 0, column: 11 })
		assert.deepStrictEqual(clean(b.getSource(4, 0, true, true)), { sourcePath: "source.js", line: 1, column: 0 })
		assert.deepStrictEqual(clean(b.getSource(4, 1, true, true)), { sourcePath: "source.js", line: 1, column: 1 })

		assert.deepStrictEqual(clean(b.getSource(1, 21, true, true)), { sourcePath: "source.js", line: 0, column: 17 })
		assert.deepStrictEqual(clean(b.getSource(3, 27, true, true)), { sourcePath: "source.js", line: 0, column: 17 })

		assert.deepStrictEqual(clean(b.getSource(0, 0, false, false)), null)
		assert.deepStrictEqual(clean(b.getSource(1, 5, false, false)), { sourcePath: "source.js", line: 0, column: 0 })
		assert.deepStrictEqual(clean(b.getSource(100, 1, false, false)), null)

	}

	export function getAllGeneratedTest() {
		const b = sourceMap.toSourceMapBuilder(map)
		assert.deepStrictEqual(clean(b.getAllGenerated("source.js", 0, 0)), [
			{ line: 1, column: 0 },
			{ line: 1, column: 4 },
			{ line: 3, column: 0 },
			{ line: 3, column: 6 },
		])
		assert.deepStrictEqual(clean(b.getAllGenerated("source.js", 0, 17)), [
			{ line: 3, column: 18 }
		])
		assert.deepStrictEqual(clean(b.getAllGenerated("source.js", 0)), [
			{ line: 1, column: 0 },
			{ line: 1, column: 4 },
			{ line: 3, column: 0 },
			{ line: 3, column: 6 },
			{ line: 3, column: 9 },
			{ line: 3, column: 18 },
			{ line: 3, column: 19 }
		])
		assert.deepStrictEqual(clean(b.getAllGenerated("foo.js", 0)), [])
	}

	export function addMappingTest() {
		const b = new sourceMap.SourceMapBuilder()
		b.addMapping(0, 10, "foo.js", 1, 2)
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 }
			]
		])
		b.addMapping(0, 10, "foo.js", 1, 3)
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			]
		])
		b.addMapping(0, 9, "foo.js", 1, 3)
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			]
		])
		b.addMapping(1, 9, "foo.js", 1, 3, "name")
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			],
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 }
			]
		])
		b.addMapping(1, 5, "foo.js", 1, 3, "name")
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			],
			[
				{ generatedColumn: 5, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 },
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 }
			]
		])
		b.addMapping(1, 8, "foo.js", 2, 7)
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			],
			[
				{ generatedColumn: 5, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 },
				{ generatedColumn: 8, sourceIndex: 0, sourceLine: 2, sourceColumn: 7 },
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 }
			]
		])
		b.addMapping(1, 6)
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			],
			[
				{ generatedColumn: 5, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 },
				{ generatedColumn: 6 },
				{ generatedColumn: 8, sourceIndex: 0, sourceLine: 2, sourceColumn: 7 },
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 }
			]
		])
		b.addMapping(1, 8)
		assert.deepStrictEqual(b.mappings, [
			[
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 2 },
				{ generatedColumn: 10, sourceIndex: 0, sourceLine: 1, sourceColumn: 3 }
			],
			[
				{ generatedColumn: 5, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 },
				{ generatedColumn: 6 },
				{ generatedColumn: 8 },
				{ generatedColumn: 9, sourceIndex: 0, sourceLine: 1, sourceColumn: 3, nameIndex: 0 }
			]
		])
	}

	export function eachMappingTest() {
		const b = new sourceMap.SourceMapBuilder()
		b.addMapping(0, 10, "a.js", 1, 2)
		b.addMapping(0, 9, "a.js", 1, 3)
		const columns: number[] = []
		b.eachMapping((generatedLine, generatedColumn) => {
			columns.push(generatedColumn)
		})
		assert.deepStrictEqual(columns, [9, 10])
	}

	export function applySourceMapTest() {
		const a = new sourceMap.SourceMapBuilder()
		a.addMapping(1, 1, "foo.js", 101, 99)
		a.addMapping(1, 6, "foo.js", 101, 103)
		a.addMapping(2, 0, "foo.js", 102, 0)
		const b = new sourceMap.SourceMapBuilder()
		b.file = "foo.js"
		b.addMapping(101, 101, "goo.js", 201, 202, "name")
		b.addMapping(101, 109, "goo.js", 201, 202)
		b.addMapping(102, 0, "goo.js", 301, 302, "name2")
		a.applySourceMap(b, undefined)
		assert.deepStrictEqual(clean(a.getSource(1, 1, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 2, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 3, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 4, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 5, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 6, true, true)), { sourcePath: "goo.js", line: 201, column: 204, name: "name" })
		assert.deepStrictEqual(clean(a.getSource(1, 7, true, true)), { sourcePath: "goo.js", line: 201, column: 205, name: "name" })
		assert.deepStrictEqual(clean(a.getSource(2, 0, true, true)), { sourcePath: "goo.js", line: 301, column: 302, name: "name2" })
		assert.deepStrictEqual(clean(a.getSource(3, 0, true, true)), { sourcePath: "goo.js", line: 302, column: 0, name: "name2" })
		const c = new sourceMap.SourceMapBuilder()
		c.file = "path"
		a.applySourceMap(c)
		assert.deepStrictEqual(clean(a.getSource(1, 1, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 2, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 3, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 4, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 5, true, true)), null)
		assert.deepStrictEqual(clean(a.getSource(1, 6, true, true)), { sourcePath: "goo.js", line: 201, column: 204, name: "name" })
		assert.deepStrictEqual(clean(a.getSource(1, 7, true, true)), { sourcePath: "goo.js", line: 201, column: 205, name: "name" })
		assert.deepStrictEqual(clean(a.getSource(2, 0, true, true)), { sourcePath: "goo.js", line: 301, column: 302, name: "name2" })
		assert.deepStrictEqual(clean(a.getSource(3, 0, true, true)), { sourcePath: "goo.js", line: 302, column: 0, name: "name2" })
	}

	export function computeLinesTest() {
		const b = new sourceMap.SourceMapBuilder()
		b.addMapping(1, 1, "a.js", 101, 101)
		b.addMapping(3, 1, "a.js", 201, 201)
		assert.strictEqual(b.mappings.length, 4)
		assert.strictEqual(b.mappings[0], undefined)
		assert.deepStrictEqual(b.mappings[1], [
			{ generatedColumn: 1, sourceIndex: 0, sourceLine: 101, sourceColumn: 101 }
		])
		assert.strictEqual(b.mappings[2], undefined)
		assert.deepStrictEqual(b.mappings[3], [
			{ generatedColumn: 1, sourceIndex: 0, sourceLine: 201, sourceColumn: 201 }
		])
		b.computeLines()
		assert.deepStrictEqual(b.mappings[0], [])
		assert.deepStrictEqual(b.mappings[2], [
			{ generatedColumn: 0, sourceIndex: 0, sourceLine: 102, sourceColumn: 0 }
		])
		assert.deepStrictEqual(b.mappings[3], [
			{ generatedColumn: 0, sourceIndex: 0, sourceLine: 103, sourceColumn: 0 },
			{ generatedColumn: 1, sourceIndex: 0, sourceLine: 201, sourceColumn: 201 }
		])
	}

	export function getSourceMapURLTest() {
		assert.strictEqual(sourceMap.getSourceMapURL("\n/*# sourceMappingURL=a.js */"), "a.js")
		assert.strictEqual(sourceMap.getSourceMapURL("a\n/*# sourceMappingURL=a.js */"), "a.js")
		assert.strictEqual(sourceMap.getSourceMapURL("a\n//# sourceMappingURL=a.js"), "a.js")
		assert.strictEqual(sourceMap.getSourceMapURL("/*# sourceMappingURL=a.js */"), "a.js")
		assert.strictEqual(sourceMap.getSourceMapURL("//# sourceMappingURL=a.js"), "a.js")
		assert.strictEqual(sourceMap.getSourceMapURL("//# sourceMappingURL=a.js"), "a.js")
		assert.strictEqual(sourceMap.getSourceMapURL("//@ sourceMappingURL="), "")
		assert.strictEqual(sourceMap.getSourceMapURL("//@ sourceMap"), null)
	}

	export function setSourceMapURLTest() {
		assert.strictEqual(sourceMap.setSourceMapURL("", "a.js"), "\n/*# sourceMappingURL=a.js */")
		assert.strictEqual(sourceMap.setSourceMapURL("a", "a.js"), "a\n/*# sourceMappingURL=a.js */")
		assert.strictEqual(sourceMap.setSourceMapURL("a", "a.js", true), "a\n//# sourceMappingURL=a.js")
		assert.strictEqual(sourceMap.setSourceMapURL("/*# sourceMappingURL=b.js */", "a.js"), "/*# sourceMappingURL=a.js */")
		assert.strictEqual(sourceMap.setSourceMapURL("//# sourceMappingURL=b.js", "a.js", true), "//# sourceMappingURL=a.js")
		assert.strictEqual(sourceMap.setSourceMapURL("//@ sourceMappingURL=b.js", "a.js", true), "//# sourceMappingURL=a.js")
		assert.strictEqual(sourceMap.setSourceMapURL("//@ sourceMappingURL=b.js", ""), "")
	}

	export function createSourceMapURLCommentTest() {
		assert.strictEqual(sourceMap.createSourceMapURLComment("a.js"), "/*# sourceMappingURL=a.js */")
		assert.strictEqual(sourceMap.createSourceMapURLComment("a.js", true), "//# sourceMappingURL=a.js")
	}

}