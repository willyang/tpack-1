import * as assert from "assert"
import * as lineColumn from "../../src/utils/lineColumn"

export namespace lineColumnTest {

	export function indexToLineColumnTest() {
		assert.deepStrictEqual(lineColumn.indexToLineColumn("012\n456", 4), { line: 1, column: 0 })

		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", -1), { line: 0, column: -1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 0), { line: 0, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 1), { line: 0, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 2), { line: 1, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 3), { line: 1, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 4), { line: 2, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 5), { line: 2, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 6), { line: 2, column: 2 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 7), { line: 3, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 8), { line: 3, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 9), { line: 3, column: 2 })

		const cache: number[] = []
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", -1, cache), { line: 0, column: -1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 0, cache), { line: 0, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 1, cache), { line: 0, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 2, cache), { line: 1, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 3, cache), { line: 1, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 4, cache), { line: 2, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 5, cache), { line: 2, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 6, cache), { line: 2, column: 2 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 7, cache), { line: 3, column: 0 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 8, cache), { line: 3, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 9, cache), { line: 3, column: 2 })
		
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 9, cache), { line: 3, column: 2 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 3, cache), { line: 1, column: 1 })
		assert.deepStrictEqual(lineColumn.indexToLineColumn("0\r2\n4\r\n7", 7, cache), { line: 3, column: 0 })
	}

	export function lineColumnToIndexTest() {
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("012\n456", { line: 1, column: 0 }), 4)

		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 0, column: -1 }), -1)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 0, column: 0 }), 0)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 0, column: 1 }), 1)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 1, column: 0 }), 2)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 1, column: 1 }), 3)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 2, column: 0 }), 4)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 2, column: 1 }), 5)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 2, column: 2 }), 6)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 0 }), 7)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 1 }), 8)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 2 }), 9)
		
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 4, column: 0 }), 8)

		const cache: number[] = []
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 0, column: -1 }, cache), -1)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 0, column: 0 }, cache), 0)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 0, column: 1 }, cache), 1)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 1, column: 0 }, cache), 2)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 1, column: 1 }, cache), 3)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 2, column: 0 }, cache), 4)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 2, column: 1 }, cache), 5)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 2, column: 2 }, cache), 6)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 0 }, cache), 7)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 1 }, cache), 8)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 2 }, cache), 9)
		
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 2 }, cache), 9)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 1, column: 1 }, cache), 3)
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 3, column: 0 }, cache), 7)
		
		assert.deepStrictEqual(lineColumn.lineColumnToIndex("0\r2\n4\r\n7", { line: 4, column: 0 }, cache), 8)
	}

}