import * as assert from "assert"
import * as ansi from "../../src/utils/ansi"

export namespace ansiTest {

	export function colorTest() {
		assert.strictEqual(ansi.color("ABCDEFG", ansi.ConsoleColor.red), "\u001b[31mABCDEFG\u001b[39m")
	}

	export function boldTest() {
		assert.strictEqual(ansi.bold("ABCDEFG"), "\u001b[1mABCDEFG\u001b[0m")
	}

	export function removeAnsiCodesTest() {
		assert.strictEqual(ansi.removeAnsiCodes("ABCDEFG"), "ABCDEFG")
		assert.strictEqual(ansi.removeAnsiCodes("\u001b[37mABCDEFG\u001b[39m"), "ABCDEFG")
	}

	export function splitStringTest() {
		assert.deepStrictEqual(ansi.splitString("ABCDEFG"), ["ABCDEFG"])
		assert.deepStrictEqual(ansi.splitString("ABCDEFG", 0, 0), ["A", "B", "C", "D", "E", "F", "G"])
		assert.deepStrictEqual(ansi.splitString("ABCDEFG", 0, 1), ["A", "B", "C", "D", "E", "F", "G"])
		assert.deepStrictEqual(ansi.splitString("ABCDEFG", 0, 2), ["A", "B", "C", "D", "E", "F", "G"])
		assert.deepStrictEqual(ansi.splitString("ABCDEFG", 2, 2), ["A", "  B", "  C", "  D", "  E", "  F", "  G"])

		assert.deepStrictEqual(ansi.splitString("ABCDEFG", 0, 5), ["ABCD", "EFG"])
		assert.deepStrictEqual(ansi.splitString("ABCDEFG", 2, 5), ["ABCD", "  EF", "  G"])

		assert.deepStrictEqual(ansi.splitString("ABC DEFG", 0, 5), ["ABC", "DEFG"])
		assert.deepStrictEqual(ansi.splitString("ABC DEFG", 2, 5), ["ABC", "  DE", "  FG"])

		assert.deepStrictEqual(ansi.splitString("你好世界", 0, 1), ["你", "好", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好世界", 0, 2), ["你", "好", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好世界", 0, 3), ["你", "好", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好世界", 0, 4), ["你", "好", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好世界", 0, 5), ["你好", "世界"])
		assert.deepStrictEqual(ansi.splitString("你好世界", 2, 5), ["你好", "  世", "  界"])

		assert.deepStrictEqual(ansi.splitString("你好A世界", 0, 1), ["你", "好", "A", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好A世界", 0, 2), ["你", "好", "A", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好A世界", 0, 3), ["你", "好", "A", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好A世界", 0, 4), ["你", "好A", "世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好A世界", 0, 5), ["你好", "A世", "界"])
		assert.deepStrictEqual(ansi.splitString("你好A世界", 2, 5), ["你好", "  A", "  世", "  界"])
		assert.deepStrictEqual(ansi.splitString("你好世界", 0, 12), ["你好世界"])
		assert.deepStrictEqual(ansi.splitString("你好世界A", 0, 12), ["你好世界A"])

		assert.deepStrictEqual(ansi.splitString("hello world", 0, 5), ["hell", "o", "worl", "d"])
		assert.deepStrictEqual(ansi.splitString("hello world", 0, 6), ["hello", "world"])
		assert.deepStrictEqual(ansi.splitString("hello world", 0, 7), ["hello", "world"])
		assert.deepStrictEqual(ansi.splitString("hello world", 0, 8), ["hello", "world"])
		assert.deepStrictEqual(ansi.splitString("hello world", 0, Infinity), ["hello world"])

		assert.deepStrictEqual(ansi.splitString("hello\nworld", 0, 8), ["hello", "world"])
		assert.deepStrictEqual(ansi.splitString("hello\nworld", 0, 4), ["hel", "lo", "wor", "ld"])
		assert.deepStrictEqual(ansi.splitString("hello\nworld", 2, 6), ["hello", "  wor", "  ld"])
		assert.deepStrictEqual(ansi.splitString("hello\r\nworld", 2, 6), ["hello", "  wor", "  ld"])
		assert.deepStrictEqual(ansi.splitString("hello\rworld", 2, 6), ["hello", "  wor", "  ld"])

		assert.deepStrictEqual(ansi.splitString("\u001b[37mABCDEFG\u001b[39m", 0, 5), ["\u001b[37mABCD", "EFG\u001b[39m"])

		assert.deepStrictEqual(ansi.splitString("hello    world", 2, 6), ["hello", "    ", "  wor", "  ld"])
		assert.deepStrictEqual(ansi.splitString("hello    world", 0, 5), ["hell", "o   ", "worl", "d"])
	}

	export function truncateStringTest() {
		assert.strictEqual(ansi.truncateString("ABCDEFG"), "ABCDEFG")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 1), "")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 2), ".")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 3), "..")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 4), "...")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 5), "A...")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 6), "A...G")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 7), "AB...G")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 8), "AB...FG")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 9), "ABC...FG")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 10), "ABCDEFG")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 11), "ABCDEFG")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 12), "ABCDEFG")
		assert.strictEqual(ansi.truncateString("ABCDEFG", undefined, 13), "ABCDEFG")

		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 4), "...")
		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 5), "...")
		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 6), "你...")
		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 7), "你...D")
		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 8), "你A...D")
		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 9), "你A...D")
		assert.strictEqual(ansi.truncateString("你A好B世C界D", undefined, 10), "你A...界D")
		assert.strictEqual(ansi.truncateString("ABCDEFG好", undefined, 8), "AB...好")

		assert.strictEqual(ansi.truncateString("\u001b[37mABCDEFG\u001b[39m", undefined, 6), "\u001b[37mA...G\u001b[39m")
		assert.strictEqual(ansi.truncateString("\u001b[37mABCDEFG好\u001b[39m", undefined, 8), "\u001b[37mAB...好\u001b[39m")
		assert.strictEqual(ansi.truncateString("\u001b[37mABCDEFG\u001b[39m", undefined, 13), "\u001b[37mABCDEFG\u001b[39m")
		assert.strictEqual(ansi.truncateString("\u001b[37m你A好B世C界D", undefined, 4), "\u001b[37m...")
		assert.strictEqual(ansi.truncateString("你\u001b[37mA好B世C界D", undefined, 5), "\u001b[37m...")
		assert.strictEqual(ansi.truncateString("你\u001b[37mA好\u001b[39mB世C界D", undefined, 5), "\u001b[37m\u001b[39m...")

		assert.strictEqual(ansi.truncateString("ABCDEFG好", "|", 8), "ABC|G好")
		assert.strictEqual(ansi.truncateString("ABCDEFG好", "", 8), "ABCFG好")
	}

	export function formatListTest() {
		assert.strictEqual(ansi.formatList([], 2, 20), "")
		assert.strictEqual(ansi.formatList(["xx", "yy"], 2, 20), "xx  yy")
	}

	export function formatTableTest() {
		assert.strictEqual(ansi.formatTable([["A", "B", "C"], ["AB", "BB", "CB"]]), [
			"A   B   C ",
			"AB  BB  CB"
		].join("\n"))
		assert.strictEqual(ansi.formatTable([["A", "B", "C"], ["ABC", "BBC", "CBC"]], ["left", "center", "right"]), [
			"A     B     C",
			"ABC  BBC  CBC"
		].join("\n"))
		assert.strictEqual(ansi.formatTable([["A", "B", "C"], ["ABC", "BBCD", "CBC"]], ["left", "center", "right"]), [
			"A     B      C",
			"ABC  BBCD  CBC"
		].join("\n"))
	}

	export function formatCodeFrameTest() {
		assert.strictEqual(ansi.formatCodeFrame("A", 0, undefined, undefined, undefined, false, false, undefined, Infinity, Infinity), "A")
		assert.strictEqual(ansi.formatCodeFrame("\u001b\u009b", 0, undefined, undefined, undefined, false, false, undefined, Infinity, Infinity), "␛␛")
		assert.strictEqual(ansi.formatCodeFrame("A", 0, 0, undefined, undefined, true, true, undefined, 15, 0), [
			' > 1 | A',
			'     | ^'
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("\0\tA\r\n\tB\n\tC", 1, 1, undefined, undefined, true, true, undefined, 15, 0), [
			"   1 | \0    A",
			" > 2 |     B",
			"     |     ^",
			"   3 |     C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\r\nB\nC", 1, 0, undefined, undefined, true, true, undefined, 15, 0), [
			"   1 | A",
			" > 2 | B",
			"     | ^",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\rBCDEF\nC", 1, 2, undefined, undefined, true, true, undefined, 15, 0), [
			"   1 | A",
			" > 2 | BCDEF",
			"     |   ^",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEF\nC", 1, 2, 1, 3, true, true, undefined, 15, 0), [
			"   1 | A",
			" > 2 | BCDEF",
			"     |   ~",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBC你EF\nC", 1, 2, 1, 3, true, true, undefined, 15, 0), [
			"   1 | A",
			" > 2 | BC你EF",
			"     |   ~~",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, true, true, undefined, 12, 0), [
			"   1 | A",
			" > 2 | BCDE",
			"     |   ~~",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 6, 1, 6, true, true, undefined, 12, 0), [
			"   1 | ",
			" > 2 | FGH",
			"     |   ^",
			"   3 | "
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 5, 1, 6, true, true, undefined, 12, 0), [
			"   1 | ",
			" > 2 | EFGH",
			"     |   ~",
			"   3 | "].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 4, 1, 6, true, true, undefined, 12, 0), [
			"   1 | ",
			" > 2 | DEFG",
			"     |   ~~",
			"   3 | "
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 3, 1, 6, true, true, undefined, 12, 0), [
			"   1 | ",
			" > 2 | CDEF",
			"     |   ~~",
			"   3 | "
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCD你GH\nC", 1, 3, 1, 6, true, true, undefined, 12, 0), [
			"   1 | ",
			" > 2 | D你G",
			"     |  ~~~",
			"   3 | "
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, true, false, undefined, 12, 0), [
			"   1 | A",
			" > 2 | BCDE",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, true, false, undefined, 12, 2), [
			" > 2 | BCDE",
			"   3 | C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, true, false, undefined, 12, 1), [
			" > 2 | BCDE"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, false, true, undefined, 12, 0), [
			"A",
			"BCDEF",
			"  ~~~",
			"C"
		].join('\n'))
		assert.strictEqual(ansi.formatCodeFrame("A\nBCDEFGH\nC", 1, 2, 1, 9, false, true, undefined, 12, 1), [
			"BCDEF",
			"  ~~~"
		].join("\n"))
	}

	export function ansiToHTMLTest() {
		assert.strictEqual(ansi.ansiToHTML("xy"), "xy")
		assert.strictEqual(ansi.ansiToHTML("\u001b[1mxy"), `<span style="font-weight: bold">xy</span>`)
	}

	export function getStringWidthTest() {
		assert.strictEqual(ansi.getStringWidth("xy"), 2)
		assert.strictEqual(ansi.getStringWidth(""), 0)
		assert.strictEqual(ansi.getStringWidth("中文"), 4)
		assert.strictEqual(ansi.getStringWidth("中y"), 3)
	}

	export function getCharWidthTest() {
		assert.strictEqual(ansi.getCharWidth("x".charCodeAt(0)), 1)
		assert.strictEqual(ansi.getCharWidth("中".charCodeAt(0)), 2)
	}

}