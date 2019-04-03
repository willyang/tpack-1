import * as assert from "assert"
import * as location from "../../src/utils/location"

export namespace locationTest {

	export function indexToLocationTest() {
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", -1), { line: 0, column: 0 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 0), { line: 0, column: 0 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 1), { line: 0, column: 1 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 2), { line: 1, column: 0 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 3), { line: 1, column: 1 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 4), { line: 2, column: 0 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 5), { line: 2, column: 1 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 6), { line: 2, column: 2 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 7), { line: 3, column: 0 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 8), { line: 3, column: 1 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 9), { line: 3, column: 2 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 10), { line: 3, column: 3 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\rc\r\nd", 10), { line: 3, column: 3 })

		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 3), { line: 1, column: 1 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 7), { line: 3, column: 0 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 1), { line: 0, column: 1 })

		const cache: number[] = []
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 6, cache), { line: 2, column: 2 })
		assert.deepStrictEqual(location.indexToLocation("a\nb\nc\r\nd", 2, cache), { line: 1, column: 0 })
	}

	export function locationToIndexTest() {
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 0, column: 0 }), 0)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 0, column: 0 }), 0)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 0, column: 1 }), 1)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 1, column: 0 }), 2)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 1, column: 1 }), 3)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 2, column: 0 }), 4)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 2, column: 1 }), 5)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 2, column: 2 }), 6)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 3, column: 0 }), 7)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 3, column: 1 }), 8)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 3, column: 2 }), 8)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 3, column: 3 }), 8)
		assert.deepStrictEqual(location.locationToIndex("a\nb\rc\r\nd", { line: 3, column: 3 }), 8)

		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 1, column: 1 }), 3)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 3, column: 0 }), 7)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 0, column: 1 }), 1)

		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: -1000, column: 0 }), 0)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 1000, column: 0 }), 8)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 0, column: -1000 }), 0)
		assert.deepStrictEqual(location.locationToIndex("a\nb\nc\r\nd", { line: 0, column: 1000 }), 8)
	}

}