import * as assert from "assert"
import * as np from "path"
import * as path from "../../src/utils/path"

export namespace pathTest {

	export function resolvePathTest() {
		assert.strictEqual(path.resolvePath(""), process.cwd())
		assert.strictEqual(path.resolvePath("."), process.cwd())
		assert.strictEqual(path.resolvePath("goo/.."), process.cwd())
		assert.strictEqual(path.resolvePath(".foo"), process.cwd() + np.sep + ".foo")
		assert.strictEqual(path.resolvePath("foo"), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("goo/../foo/goo.txt"), process.cwd() + np.sep + "foo" + np.sep + "goo.txt")

		assert.strictEqual(path.resolvePath("./"), process.cwd())
		assert.strictEqual(path.resolvePath("goo/../"), process.cwd())
		assert.strictEqual(path.resolvePath(".foo/"), process.cwd() + np.sep + ".foo")
		assert.strictEqual(path.resolvePath("foo/"), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("goo/../foo/goo.txt/"), process.cwd() + np.sep + "foo" + np.sep + "goo.txt")

		assert.strictEqual(path.resolvePath("", ""), process.cwd())
		assert.strictEqual(path.resolvePath("", "."), process.cwd())
		assert.strictEqual(path.resolvePath("", "goo/.."), process.cwd())
		assert.strictEqual(path.resolvePath("", ".foo"), process.cwd() + np.sep + ".foo")
		assert.strictEqual(path.resolvePath("", "foo"), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("", "goo/../foo/goo.txt"), process.cwd() + np.sep + "foo" + np.sep + "goo.txt")

		assert.strictEqual(path.resolvePath(".", ""), process.cwd())
		assert.strictEqual(path.resolvePath(".", "."), process.cwd())
		assert.strictEqual(path.resolvePath(".", "goo/.."), process.cwd())
		assert.strictEqual(path.resolvePath(".", ".foo"), process.cwd() + np.sep + ".foo")
		assert.strictEqual(path.resolvePath(".", "foo"), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath(".", "goo/../foo/goo.txt"), process.cwd() + np.sep + "foo" + np.sep + "goo.txt")

		assert.strictEqual(path.resolvePath("./", ""), process.cwd())
		assert.strictEqual(path.resolvePath("./", "."), process.cwd())
		assert.strictEqual(path.resolvePath("./", "goo/.."), process.cwd())
		assert.strictEqual(path.resolvePath("./", ".foo"), process.cwd() + np.sep + ".foo")
		assert.strictEqual(path.resolvePath("./", "foo"), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("./", "goo/../foo/goo.txt"), process.cwd() + np.sep + "foo" + np.sep + "goo.txt")

		assert.strictEqual(path.resolvePath("foo", ""), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("foo", "."), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("foo", ".."), process.cwd())
		assert.strictEqual(path.resolvePath("foo", ".goo"), process.cwd() + np.sep + "foo" + np.sep + ".goo")
		assert.strictEqual(path.resolvePath("foo", "goo"), process.cwd() + np.sep + "foo" + np.sep + "goo")
		assert.strictEqual(path.resolvePath("foo", "../goo/hoo.txt"), process.cwd() + np.sep + "goo" + np.sep + "hoo.txt")

		assert.strictEqual(path.resolvePath("foo/", ""), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("foo/", "."), process.cwd() + np.sep + "foo")
		assert.strictEqual(path.resolvePath("foo/", ".."), process.cwd())
		assert.strictEqual(path.resolvePath("foo/", ".goo"), process.cwd() + np.sep + "foo" + np.sep + ".goo")
		assert.strictEqual(path.resolvePath("foo/", "goo"), process.cwd() + np.sep + "foo" + np.sep + "goo")
		assert.strictEqual(path.resolvePath("foo/", "../goo/hoo.txt"), process.cwd() + np.sep + "goo" + np.sep + "hoo.txt")

		assert.strictEqual(path.resolvePath("goo/../foo/goo", "../hoo/koo"), process.cwd() + np.sep + "foo" + np.sep + "hoo" + np.sep + "koo")
		assert.strictEqual(path.resolvePath("goo/../foo/goo/", "../hoo/koo/"), process.cwd() + np.sep + "foo" + np.sep + "hoo" + np.sep + "koo")
		assert.strictEqual(path.resolvePath("goo/../foo/goo.txt", "../hoo/koo.txt"), process.cwd() + np.sep + "foo" + np.sep + "hoo" + np.sep + "koo.txt")

		if (np.sep === "\\") {
			assert.strictEqual(path.resolvePath("C:\\Windows\\System32", "b"), "C:\\Windows\\System32\\b")
			assert.strictEqual(path.resolvePath("C:\\Windows\\System32\\", "b"), "C:\\Windows\\System32\\b")
			assert.strictEqual(path.resolvePath("C:\\Windows/System32", "b\\d"), "C:\\Windows\\System32\\b\\d")
			assert.strictEqual(path.resolvePath("C:\\Windows/System32", "../abc/d"), "C:\\Windows\\abc\\d")
			assert.strictEqual(path.resolvePath("d:/root/", "c:/../a"), "c:\\a")
			assert.strictEqual(path.resolvePath("d:\\a/b\\c/d", ""), "d:\\a\\b\\c\\d")
			assert.strictEqual(path.resolvePath("c:/ignore", "c:/some/file"), "c:\\some\\file")
			assert.strictEqual(path.resolvePath("\\\\server\\root", "relative\\"), "\\\\server\\root\\relative")
		}
	}

	export function relativePathTest() {
		assert.strictEqual(path.relativePath("", ""), "")
		assert.strictEqual(path.relativePath("", "."), "")
		assert.strictEqual(path.relativePath("", ".."), "..")
		assert.strictEqual(path.relativePath("", ".foo"), ".foo")
		assert.strictEqual(path.relativePath("", "foo"), "foo")
		assert.strictEqual(path.relativePath("", "../foo/goo.txt"), "../foo/goo.txt")

		assert.strictEqual(path.relativePath(".", ""), "")
		assert.strictEqual(path.relativePath(".", "."), "")
		assert.strictEqual(path.relativePath(".", ".."), "..")
		assert.strictEqual(path.relativePath(".", ".foo"), ".foo")
		assert.strictEqual(path.relativePath(".", "foo"), "foo")
		assert.strictEqual(path.relativePath(".", "../foo/goo.txt"), "../foo/goo.txt")

		assert.strictEqual(path.relativePath(".", ""), "")
		assert.strictEqual(path.relativePath(".", "./"), "")
		assert.strictEqual(path.relativePath(".", "../"), "..")
		assert.strictEqual(path.relativePath(".", ".foo/"), ".foo")
		assert.strictEqual(path.relativePath(".", "foo/"), "foo")
		assert.strictEqual(path.relativePath(".", "../foo/goo.txt/"), "../foo/goo.txt")

		assert.strictEqual(path.relativePath("./", ""), "")
		assert.strictEqual(path.relativePath("./", "./"), "")
		assert.strictEqual(path.relativePath("./", "../"), "..")
		assert.strictEqual(path.relativePath("./", ".foo/"), ".foo")
		assert.strictEqual(path.relativePath("./", "foo/"), "foo")
		assert.strictEqual(path.relativePath("./", "../foo/goo.txt/"), "../foo/goo.txt")

		assert.strictEqual(path.relativePath("foo", "foo"), "")
		assert.strictEqual(path.relativePath("foo", "foo2"), "../foo2")
		assert.strictEqual(path.relativePath("foo", "../foo/goo"), "../../foo/goo")
		assert.strictEqual(path.relativePath("foo/goo", "foo/goo"), "")
		assert.strictEqual(path.relativePath("foo/goo", "foo/goo/hoo/koo.txt"), "hoo/koo.txt")

		assert.strictEqual(path.relativePath("foo/", "foo"), "")
		assert.strictEqual(path.relativePath("foo/", "foo2"), "../foo2")
		assert.strictEqual(path.relativePath("foo/", "../foo/goo"), "../../foo/goo")
		assert.strictEqual(path.relativePath("foo/goo/", "foo/goo"), "")
		assert.strictEqual(path.relativePath("foo/goo/", "foo/goo/hoo/koo.txt"), "hoo/koo.txt")

		assert.strictEqual(path.relativePath("foo/", "foo/"), "")
		assert.strictEqual(path.relativePath("foo/", "foo2/"), "../foo2")
		assert.strictEqual(path.relativePath("foo/", "../foo/goo/"), "../../foo/goo")
		assert.strictEqual(path.relativePath("foo/goo/", "foo/goo/"), "")
		assert.strictEqual(path.relativePath("foo/goo/", "foo/goo/hoo/koo.txt/"), "hoo/koo.txt")

		assert.strictEqual(path.relativePath(process.cwd(), np.resolve("foo/goo.txt")), "foo/goo.txt")
	}

	export function normalizePathTest() {
		assert.strictEqual(path.normalizePath(""), ".")
		assert.strictEqual(path.normalizePath("."), ".")
		assert.strictEqual(path.normalizePath("./"), "./")
		assert.strictEqual(path.normalizePath(".foo"), ".foo")
		assert.strictEqual(path.normalizePath(".."), "..")
		assert.strictEqual(path.normalizePath("../"), "../")
		assert.strictEqual(path.normalizePath("foo.js"), "foo.js")
		assert.strictEqual(path.normalizePath("./foo.js"), "foo.js")
		assert.strictEqual(path.normalizePath("/foo.js"), np.sep + "foo.js")
		assert.strictEqual(path.normalizePath("foo/../goo.js"), "goo.js")
		assert.strictEqual(path.normalizePath("/foo/../goo.js"), np.sep + "goo.js")
		assert.strictEqual(path.normalizePath("**/*.js"), "**/*.js")
		assert.strictEqual(path.normalizePath("./**/*.js"), "**/*.js")
		assert.strictEqual(path.normalizePath("./fixtures///d/../b/c.js"), "fixtures/b/c.js")
		assert.strictEqual(path.normalizePath("/foo/../../../bar"), np.sep + "bar")
		assert.strictEqual(path.normalizePath("foo//goo//../koo"), "foo/koo")
		assert.strictEqual(path.normalizePath("foo//goo//./koo"), "foo/goo/koo")
		assert.strictEqual(path.normalizePath("foo//goo//."), "foo/goo")
		assert.strictEqual(path.normalizePath("foo//goo//.//"), "foo/goo/")
		assert.strictEqual(path.normalizePath("p/a/b/c/../../../x/y/z"), "p/x/y/z")
		assert.strictEqual(path.normalizePath("a/b/c/../../../x/y/z"), "x/y/z")

		if (np.sep === "\\") {
			assert.strictEqual(path.normalizePath("c:/../a/b/c"), "c:\\a\\b\\c")
			assert.strictEqual(path.normalizePath("C:\\Windows\\System32"), "C:\\Windows\\System32")
		}
	}

	export function isAbsolutePathTest() {
		assert.strictEqual(path.isAbsolutePath("/"), true)
		assert.strictEqual(path.isAbsolutePath("directory/directory"), false)
		assert.strictEqual(path.isAbsolutePath("directory\\directory"), false)
		assert.strictEqual(path.isAbsolutePath("/home/foo"), true)
		assert.strictEqual(path.isAbsolutePath("/home/foo/.."), true)
		assert.strictEqual(path.isAbsolutePath("bar/"), false)
		assert.strictEqual(path.isAbsolutePath("./baz"), false)

		if (np.sep === "\\") {
			assert.strictEqual(path.isAbsolutePath("\\\\server\\file"), true)
			assert.strictEqual(path.isAbsolutePath("\\\\server"), true)
			assert.strictEqual(path.isAbsolutePath("\\\\"), true)
			assert.strictEqual(path.isAbsolutePath("c"), false)
			assert.strictEqual(path.isAbsolutePath("c:"), false)
			assert.strictEqual(path.isAbsolutePath("c:\\"), true)
			assert.strictEqual(path.isAbsolutePath("c:/"), true)
			assert.strictEqual(path.isAbsolutePath("c://"), true)
			assert.strictEqual(path.isAbsolutePath("C:/Users/"), true)
			assert.strictEqual(path.isAbsolutePath("C:\\Users\\"), true)
		}
	}

	export function getDirTest() {
		assert.strictEqual(path.getDir("."), ".")
		assert.strictEqual(path.getDir("foo.txt"), ".")
		assert.strictEqual(path.getDir(".foo"), ".")
		assert.strictEqual(path.getDir(".foo/"), ".")
		assert.strictEqual(path.getDir("foo/goo.txt"), "foo")
		assert.strictEqual(path.getDir("../goo.txt"), "..")
		assert.strictEqual(path.getDir("/user/root/foo.txt"), "/user/root")
		assert.strictEqual(path.getDir("/user/root/foo"), "/user/root")
		assert.strictEqual(path.getDir("/user/root/foo/"), "/user/root")
	}

	export function setDirTest() {
		assert.strictEqual(path.setDir("/user/root/foo", ""), "foo")
		assert.strictEqual(path.setDir("/user/root/foo", "."), "foo")
		assert.strictEqual(path.setDir("/user/root/foo", "./"), "foo")
		assert.strictEqual(path.setDir("/user/root/foo", "/"), np.sep + "foo")
		assert.strictEqual(path.setDir("/user/root/foo.txt", "goo"), "goo/foo.txt")
		assert.strictEqual(path.setDir("/user/root/foo", "goo"), "goo/foo")
		assert.strictEqual(path.setDir("/user/root/foo", "goo/"), "goo/foo")

		assert.strictEqual(path.setDir("/user/root/foo", "other", "/user"), "other/root/foo")
		assert.strictEqual(path.setDir("/user/root/foo", "", "/user/root"), "foo")
		assert.strictEqual(path.setDir("/user/root/foo", ".", "/user/root"), "foo")
		assert.strictEqual(path.setDir("/user/root/foo", "./", "/user/root"), "foo")
		assert.strictEqual(path.setDir("/user/root/foo", "/", "/user/root"), np.sep + "foo")
		assert.strictEqual(path.setDir("/user/root/foo.txt", "goo", "/user/root"), "goo/foo.txt")
		assert.strictEqual(path.setDir("/user/root/foo", "goo", "/user/root"), "goo/foo")
		assert.strictEqual(path.setDir("/user/root/foo", "goo/", "/user/root"), "goo/foo")
	}

	export function getFileNameTest() {
		assert.strictEqual(path.getFileName("/user/root/foo.txt"), "foo.txt")
		assert.strictEqual(path.getFileName("/user/root/foo.txt", true), "foo.txt")
		assert.strictEqual(path.getFileName("/user/root/foo.min.js"), "foo.min.js")
		assert.strictEqual(path.getFileName("/user/root/foo"), "foo")
		assert.strictEqual(path.getFileName("/user/root/foo/"), "foo")
		assert.strictEqual(path.getFileName(""), "")
		assert.strictEqual(path.getFileName("."), ".")
		assert.strictEqual(path.getFileName(".."), "..")
		assert.strictEqual(path.getFileName(".foo"), ".foo")
		assert.strictEqual(path.getFileName("foo/.goo", false), ".goo")

		assert.strictEqual(path.getFileName("/user/root/foo.txt", false), "foo")
		assert.strictEqual(path.getFileName("/user/root/foo.min.js", false), "foo.min")
		assert.strictEqual(path.getFileName("/user/root/foo", false), "foo")
		assert.strictEqual(path.getFileName("/user/root/foo/", false), "foo")
		assert.strictEqual(path.getFileName("", false), "")
		assert.strictEqual(path.getFileName(".", false), ".")
		assert.strictEqual(path.getFileName("..", false), "..")
		assert.strictEqual(path.getFileName(".foo", false), ".foo")
		assert.strictEqual(path.getFileName("foo/.goo", false), ".goo")
	}

	export function setFileNameTest() {
		assert.strictEqual(path.setFileName("/user/root/foo.txt", "goo"), "/user/root/goo")
		assert.strictEqual(path.setFileName("/user/root/foo.txt", "goo", true), "/user/root/goo")
		assert.strictEqual(path.setFileName("/user/root/foo.min.js", "goo"), "/user/root/goo")
		assert.strictEqual(path.setFileName("/user/root/foo", "goo"), "/user/root/goo")
		assert.strictEqual(path.setFileName("/user/root/", "goo"), "/user/goo")
		assert.strictEqual(path.setFileName("", "goo"), "goo")
		assert.strictEqual(path.setFileName(".", "goo"), "goo")
		assert.strictEqual(path.setFileName("..", "goo"), "goo")
		assert.strictEqual(path.setFileName(".foo", "goo"), "goo")
		assert.strictEqual(path.setFileName("foo/.foo", "goo"), "foo/goo")

		assert.strictEqual(path.setFileName("/user/root/foo.txt", "goo", false), "/user/root/goo.txt")
		assert.strictEqual(path.setFileName("/user/root/foo.min.js", "goo", false), "/user/root/goo.js")
		assert.strictEqual(path.setFileName("/user/root/foo", "goo", false), "/user/root/goo")
		assert.strictEqual(path.setFileName("/user/root/", "goo", false), "/user/goo")
		assert.strictEqual(path.setFileName("", "goo", false), "goo")
		assert.strictEqual(path.setFileName(".", "goo", false), "goo")
		assert.strictEqual(path.setFileName("..", "goo", false), "goo")
		assert.strictEqual(path.setFileName(".foo", "goo", false), "goo")
		assert.strictEqual(path.setFileName("foo/.foo", "goo", false), "foo/goo")
	}

	export function prependFileNameTest() {
		assert.strictEqual(path.prependFileName("/user/root/foo.txt", "prepend"), "/user/root/prependfoo.txt")
		assert.strictEqual(path.prependFileName("/user/root/foo.min.js", "prepend"), "/user/root/prependfoo.min.js")
		assert.strictEqual(path.prependFileName("/user/root/foo", "prepend"), "/user/root/prependfoo")
		assert.strictEqual(path.prependFileName("/user/root/foo/", "prepend"), "/user/root/prependfoo")
		assert.strictEqual(path.prependFileName(".goo", "prepend"), "prepend.goo")
		assert.strictEqual(path.prependFileName("foo/.goo", "prepend"), "foo/prepend.goo")
	}

	export function appendFileNameTest() {
		assert.strictEqual(path.appendFileName("/user/root/foo.txt", "append"), "/user/root/fooappend.txt")
		assert.strictEqual(path.appendFileName("/user/root/foo.min.js", "append"), "/user/root/fooappend.min.js")
		assert.strictEqual(path.appendFileName("/user/root/foo", "append"), "/user/root/fooappend")
		assert.strictEqual(path.appendFileName("/user/root/foo/", "append"), "/user/root/fooappend")
		assert.strictEqual(path.appendFileName(".goo", "append"), "append.goo")
		assert.strictEqual(path.appendFileName("foo/.goo", "append"), "foo/append.goo")
	}

	export function getExtTest() {
		assert.strictEqual(path.getExt("/user/root/foo"), "")
		assert.strictEqual(path.getExt("/user/root/foo.txt"), ".txt")
		assert.strictEqual(path.getExt("/user/root/foo.min.js"), ".js")
		assert.strictEqual(path.getExt("/user/root/.foo"), "")
		assert.strictEqual(path.getExt("/user/root/.foo/"), "")
	}

	export function setExtTest() {
		assert.strictEqual(path.setExt("/user/root/foo.txt", ".jpg"), "/user/root/foo.jpg")
		assert.strictEqual(path.setExt("/user/root/foo.txt", ""), "/user/root/foo")
		assert.strictEqual(path.setExt("/user/root/foo", ".jpg"), "/user/root/foo.jpg")
		assert.strictEqual(path.setExt("/user/root/foo", ""), "/user/root/foo")
		assert.strictEqual(path.setExt("/user/root/.foo", ".txt"), "/user/root/.foo.txt")
		assert.strictEqual(path.setExt("/user/root/.foo/", ".txt"), "/user/root/.foo/.txt")
	}

	export function pathEqualsTest() {
		assert.strictEqual(path.pathEquals(null, null), true)
		assert.strictEqual(path.pathEquals(null, "foo/goo/hoo"), false)
		assert.strictEqual(path.pathEquals("foo/goo/hoo", null), false)
		assert.strictEqual(path.pathEquals("foo/goo/hoo", "foo/goo/hoo2"), false)
		assert.strictEqual(path.pathEquals("foo/goo/hoo", "foo/goo/hoo"), true)
	}

	export function containsPathTest() {
		assert.strictEqual(path.containsPath(".", "."), true)
		assert.strictEqual(path.containsPath(".", "foo"), true)
		assert.strictEqual(path.containsPath(".", "foo/goo"), true)
		assert.strictEqual(path.containsPath(".", "../foo/goo"), false)

		assert.strictEqual(path.containsPath("..", ".."), true)
		assert.strictEqual(path.containsPath("..", "foo"), true)
		assert.strictEqual(path.containsPath("..", "foo/goo"), true)
		assert.strictEqual(path.containsPath("..", "../foo/goo"), true)

		assert.strictEqual(path.containsPath("/", "/"), true)
		assert.strictEqual(path.containsPath("/", "/foo"), true)
		assert.strictEqual(path.containsPath("/", "/foo/goo"), true)

		assert.strictEqual(path.containsPath("user/root/foo", "user/root/foo"), true)
		assert.strictEqual(path.containsPath("user/root/foo", "user/root/foo2"), false)
		assert.strictEqual(path.containsPath("user/root/foo", "user/root/foo/goo"), true)

		assert.strictEqual(path.containsPath("../foo", "../foo"), true)
		assert.strictEqual(path.containsPath("../foo", "../foo2"), false)
		assert.strictEqual(path.containsPath("../foo", "../foo/goo"), true)
		assert.strictEqual(path.containsPath("../foo", "."), false)
		assert.strictEqual(path.containsPath("../foo", ".."), false)

		assert.strictEqual(path.containsPath("/user/root", "/user/root"), true)
		assert.strictEqual(path.containsPath("/user/root", "/user/root/foo"), true)
		assert.strictEqual(path.containsPath("/user/root/foo.txt", "foo.txt"), false)
		assert.strictEqual(path.containsPath("/user/root/foo", "/user/root/foo2"), false)

		assert.strictEqual(path.containsPath("../..", "../foo/goo"), true)
		assert.strictEqual(path.containsPath("goo1/goo2/../foo", "goo1/goo2/../../foo"), false)
		assert.strictEqual(path.containsPath("goo1/goo2/../../foo", "goo1/goo2/.."), false)
		assert.strictEqual(path.containsPath("goo1/.", "goo1/.."), false)
		assert.strictEqual(path.containsPath("goo1/..", "goo1/."), true)
	}

	export function commonDirTest() {
		assert.strictEqual(path.commonDir("", ""), np.resolve("."))
		assert.strictEqual(path.commonDir("", "."), np.resolve("."))
		assert.strictEqual(path.commonDir(".", "."), np.resolve("."))
		assert.strictEqual(path.commonDir(".", "foo"), np.resolve("."))
		assert.strictEqual(path.commonDir(".", "foo/goo"), np.resolve("."))
		assert.strictEqual(path.commonDir("goo1/.", "goo1/.."), np.resolve("."))
		assert.strictEqual(path.commonDir("goo1/.", "goo1/../foo/goo"), np.resolve("."))

		assert.strictEqual(path.commonDir("goo1/..", "goo1/."), np.resolve("."))
		assert.strictEqual(path.commonDir("goo1/..", "goo1/.."), np.resolve("."))
		assert.strictEqual(path.commonDir("goo1/..", "goo1/foo"), np.resolve("."))
		assert.strictEqual(path.commonDir("goo1/..", "goo1/foo/goo"), np.resolve("."))
		assert.strictEqual(path.commonDir("goo1/..", "goo1/../foo/goo"), np.resolve("."))

		assert.strictEqual(path.commonDir("foo/goo", "foo/goo2"), np.resolve("foo"))
		assert.strictEqual(path.commonDir("foo/goo", "foo/goo/hoo"), np.resolve("foo/goo"))
		assert.strictEqual(path.commonDir("foo/goo/hoo", "foo/goo/hoo2"), np.resolve("foo/goo"))

		assert.strictEqual(path.commonDir("foo/goo/hoo", "foo/goo"), np.resolve("foo/goo"))
		assert.strictEqual(path.commonDir("foo/goo/hoo", "foo2/goo/hoo"), np.resolve("."))
		assert.strictEqual(path.commonDir("foo/goo/hoo", "foo/goo/hoo"), np.resolve("foo/goo/hoo"))

		assert.strictEqual(path.commonDir("/", "/"), np.resolve("/"))
		assert.strictEqual(path.commonDir("/foo/goo", "/foo/goo2"), np.resolve("/foo"))

		assert.strictEqual(path.commonDir("goo/../foo", "goo/../foo2"), np.resolve("."))
		assert.strictEqual(path.commonDir("goo/../foo", "goo/../foo/goo"), np.resolve("foo"))
		assert.strictEqual(path.commonDir("goo/../foo", "goo/foo2/goo"), np.resolve("."))
		assert.strictEqual(path.commonDir("goo/../foo", "goo/."), np.resolve("."))

		assert.strictEqual(path.commonDir(null, ""), null)
		assert.strictEqual(path.commonDir("", null), null)
		assert.strictEqual(path.commonDir(null, null), null)

		if (np.sep === "\\") {
			assert.strictEqual(path.commonDir("R:/foo", "H:/foo"), null)
			assert.strictEqual(path.commonDir("R:", "H:"), null)
		}
	}

}