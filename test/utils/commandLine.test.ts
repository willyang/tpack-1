import * as assert from "assert"
import * as commandLine from "../../src/utils/commandLine"

export namespace commandLineTest {

	export function colorTest() {
		assert.strictEqual(commandLine.color("ABCDEFG", commandLine.ConsoleColor.red), "\u001b[31mABCDEFG\u001b[39m")
	}

	export function boldTest() {
		assert.strictEqual(commandLine.bold("ABCDEFG"), "\u001b[1mABCDEFG\u001b[0m")
	}

	export function removeAnsiCodesTest() {
		assert.strictEqual(commandLine.removeAnsiCodes("ABCDEFG"), "ABCDEFG")
		assert.strictEqual(commandLine.removeAnsiCodes("\u001b[37mABCDEFG\u001b[39m"), "ABCDEFG")
	}

	export function splitLogTest() {
		assert.deepStrictEqual(commandLine.splitLog("ABCDEFG"), ["ABCDEFG"])
		assert.deepStrictEqual(commandLine.splitLog("ABCDEFG", 1), ["A", "B", "C", "D", "E", "F", "G"])
		assert.deepStrictEqual(commandLine.splitLog("你好世界", 1), ["你", "好", "世", "界"])
		assert.deepStrictEqual(commandLine.splitLog("ABCDEFG", 5), ["ABCD", "EFG"])
		assert.deepStrictEqual(commandLine.splitLog("你好世界", 5), ["你好", "世界"])
		assert.deepStrictEqual(commandLine.splitLog("你好A世界", 5), ["你好", "A世", "界"])
		assert.deepStrictEqual(commandLine.splitLog("你好世界", 12), ["你好世界"])
		assert.deepStrictEqual(commandLine.splitLog("你好世界A", 12), ["你好世界A"])

		assert.deepStrictEqual(commandLine.splitLog("hello world", 5), ["hell", "o", "worl", "d"])
		assert.deepStrictEqual(commandLine.splitLog("hello world", 6), ["hello", "world"])
		assert.deepStrictEqual(commandLine.splitLog("hello world", 7), ["hello", "world"])
		assert.deepStrictEqual(commandLine.splitLog("hello world", 8), ["hello", "world"])

		assert.deepStrictEqual(commandLine.splitLog("\u001b[37mABCDEFG\u001b[39m", 5), ["\u001b[37mABCD", "EFG\u001b[39m"])
	}

	export function ellipsisLogTest() {
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG"), "ABCDEFG")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 1), "")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 2), ".")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 3), "..")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 4), "...")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 5), "A...")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 6), "A...G")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 7), "AB...G")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 8), "AB...FG")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 9), "ABC...FG")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 10), "ABCDEFG")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 11), "ABCDEFG")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 12), "ABCDEFG")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG", 13), "ABCDEFG")

		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 4), "...")
		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 5), "...")
		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 6), "你...")
		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 7), "你...D")
		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 8), "你A...D")
		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 9), "你A...D")
		assert.strictEqual(commandLine.ellipsisLog("你A好B世C界D", 10), "你A...界D")
		assert.strictEqual(commandLine.ellipsisLog("ABCDEFG好", 8), "AB...好")

		assert.strictEqual(commandLine.ellipsisLog("\u001b[37mABCDEFG\u001b[39m", 6), "\u001b[37mA...G\u001b[39m")
		assert.strictEqual(commandLine.ellipsisLog("\u001b[37mABCDEFG好\u001b[39m", 8), "\u001b[37mAB...好\u001b[39m")
		assert.strictEqual(commandLine.ellipsisLog("\u001b[37mABCDEFG\u001b[39m", 13), "\u001b[37mABCDEFG\u001b[39m")
		assert.strictEqual(commandLine.ellipsisLog("\u001b[37m你A好B世C界D", 4), "\u001b[37m...")
		assert.strictEqual(commandLine.ellipsisLog("你\u001b[37mA好B世C界D", 5), "\u001b[37m...")
		assert.strictEqual(commandLine.ellipsisLog("你\u001b[37mA好\u001b[39mB世C界D", 5), "\u001b[37m\u001b[39m...")
	}

	export function formatListTest() {
		assert.strictEqual(commandLine.formatList([], 2, 20), ``)
		assert.strictEqual(commandLine.formatList(["xx", "yy"], 2, 20), `xx  yy`)
	}

	export function formatCodeFrameTest() {
		assert.strictEqual(commandLine.formatCodeFrame("A", 0, undefined, undefined, undefined, Infinity, Infinity, false, false), "A")
		assert.strictEqual(commandLine.formatCodeFrame("\u001b\u009b", 0, undefined, undefined, undefined, Infinity, Infinity, false, false), "␛␛")
		assert.strictEqual(commandLine.formatCodeFrame("A", 0, 0, undefined, undefined, 15, 0, true, true), [
			' > 1 | A',
			'     | ^'
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("\0\tA\r\n\tB\n\tC", 1, 1, undefined, undefined, 15, 0, true, true), [
			"   1 | \0    A",
			" > 2 |     B",
			"     |     ^",
			"   3 |     C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\r\nB\nC", 1, 0, undefined, undefined, 15, 0, true, true), [
			"   1 | A",
			" > 2 | B",
			"     | ^",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\rBCDEF\nC", 1, 2, undefined, undefined, 15, 0, true, true), [
			"   1 | A",
			" > 2 | BCDEF",
			"     |   ^",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEF\nC", 1, 2, 1, 3, 15, 0, true, true), [
			"   1 | A",
			" > 2 | BCDEF",
			"     |   ~",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBC你EF\nC", 1, 2, 1, 3, 15, 0, true, true), [
			"   1 | A",
			" > 2 | BC你EF",
			"     |   ~~",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, 12, 0, true, true), [
			"   1 | A",
			" > 2 | BCDE",
			"     |   ~~",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 6, 1, 6, 12, 0, true, true), [
			"   1 | ",
			" > 2 | FGH",
			"     |   ^",
			"   3 | "
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 5, 1, 6, 12, 0, true, true), [
			"   1 | ",
			" > 2 | EFGH",
			"     |   ~",
			"   3 | "].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 4, 1, 6, 12, 0, true, true), [
			"   1 | ",
			" > 2 | DEFG",
			"     |   ~~",
			"   3 | "
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 3, 1, 6, 12, 0, true, true), [
			"   1 | ",
			" > 2 | CDEF",
			"     |   ~~",
			"   3 | "
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCD你GH\nC", 1, 3, 1, 6, 12, 0, true, true), [
			"   1 | ",
			" > 2 | D你G",
			"     |  ~~~",
			"   3 | "
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, 12, 0, true, false), [
			"   1 | A",
			" > 2 | BCDE",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, 12, 2, true, false), [
			" > 2 | BCDE",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, 12, 1, true, false), [
			" > 2 | BCDE"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, 12, 0, false, true), [
			"A",
			"BCDEF",
			"  ~~~",
			"C"
		].join('\n'))
		assert.strictEqual(commandLine.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, 12, 1, false, true), [
			"BCDEF",
			"  ~~~"
		].join("\n"))
	}

	export function formatTableTest() {
		assert.strictEqual(commandLine.formatTable([["A", "B", "C"], ["AB", "BB", "CB"]]), [
			"A   B   C ",
			"AB  BB  CB"
		].join("\n"))
		assert.strictEqual(commandLine.formatTable([["A", "B", "C"], ["ABC", "BBC", "CBC"]], ["left", "center", "right"]), [
			"A     B     C",
			"ABC  BBC  CBC"
		].join("\n"))
		assert.strictEqual(commandLine.formatTable([["A", "B", "C"], ["ABC", "BBCD", "CBC"]], ["left", "center", "right"]), [
			"A     B      C",
			"ABC  BBCD  CBC"
		].join("\n"))
	}

	export function getStringWidthTest() {
		assert.strictEqual(commandLine.getStringWidth("xy"), 2)
		assert.strictEqual(commandLine.getStringWidth(""), 0)
		assert.strictEqual(commandLine.getStringWidth("中文"), 4)
		assert.strictEqual(commandLine.getStringWidth("中y"), 3)
	}

	export function getCharWidthTest() {
		assert.strictEqual(commandLine.getCharWidth("x".charCodeAt(0)), 1)
		assert.strictEqual(commandLine.getCharWidth("中".charCodeAt(0)), 2)
	}

	export function ansiToHTMLTest() {
		assert.strictEqual(commandLine.ansiToHTML("xy"), "xy")
		assert.strictEqual(commandLine.ansiToHTML("\u001b[1mxy"), `<span style="font-weight: bold">xy</span>`)
	}

}