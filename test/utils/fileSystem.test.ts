import * as assert from "assert"
import * as fs from "fs"
import * as path from "path"
import * as fileSystem from "../../src/utils/fileSystem"
import { init, root, simulateIOError, uninit } from "../helpers/fsHelper"

export namespace fsTest {

	export async function beforeEach() {
		await init({
			"dir1": {
				"sub1": {
					"f3.txt": "f3.txt",
					"f4.txt": "f4.txt"
				},
				"sub2": {
					"f5.txt": "f5.txt"
				}
			},
			"dir2": {},
			"f1.txt": "f1.txt",
			"f2.txt": "f2.txt"
		})
	}

	export async function afterEach() {
		await uninit()
	}

	export async function getStatTest() {
		assert.strictEqual((await new fileSystem.FileSystem().getStat("dir1")).isDirectory(), true)
		assert.strictEqual((await new fileSystem.FileSystem().getStat("f1.txt")).isFile(), true)
	}

	export async function getLinkStatTest() {
		assert.strictEqual((await new fileSystem.FileSystem().getLinkStat("dir1")).isDirectory(), true)
		assert.strictEqual((await new fileSystem.FileSystem().getLinkStat("f1.txt")).isFile(), true)
	}

	export async function ensureNotExistsTest() {
		assert.strictEqual(await new fileSystem.FileSystem().ensureNotExists("dir1"), "dir1_2")
		assert.strictEqual(await new fileSystem.FileSystem().ensureNotExists("f1.txt"), "f1_2.txt")
		assert.strictEqual(await new fileSystem.FileSystem().ensureNotExists("non-exists"), "non-exists")

		fs.writeFileSync("f1_99.txt", "f1_99.txt")
		assert.strictEqual(await new fileSystem.FileSystem().ensureNotExists("f1_99.txt"), "f1_100.txt")

		assert.strictEqual(await new fileSystem.FileSystem().ensureNotExists("f1.txt", "(0)"), "f1(0).txt")

		fs.writeFileSync("f1(99).txt", "f1(99).txt")
		assert.strictEqual(await new fileSystem.FileSystem().ensureNotExists("f1(99).txt", "(0)"), "f1(100).txt")
	}

	export async function ensureDirExistsTest() {
		assert.strictEqual(await new fileSystem.FileSystem().ensureDirExists("foo/goo.txt"), true)
		assert.strictEqual(fs.existsSync("foo"), true)
		assert.strictEqual(await new fileSystem.FileSystem().ensureDirExists("foo/goo.txt"), false)
	}

	export async function createDirTest() {
		assert.strictEqual(await new fileSystem.FileSystem().createDir("foo/goo"), true)
		assert.strictEqual(fs.existsSync("foo/goo"), true)
		assert.strictEqual(await new fileSystem.FileSystem().createDir("foo/goo"), false)
	}

	export async function deleteDirTest() {
		assert.strictEqual(fs.existsSync("dir1"), true)
		assert.strictEqual(await new fileSystem.FileSystem().deleteDir("dir1"), 3)
		assert.strictEqual(fs.existsSync("dir1"), false)
		assert.strictEqual(await new fileSystem.FileSystem().deleteDir("dir1"), 0)
	}

	export async function cleanDirTest() {
		assert.strictEqual(await new fileSystem.FileSystem().cleanDir("dir1"), 3)
		assert.strictEqual(fs.existsSync("dir1"), true)
		assert.strictEqual(fs.existsSync("dir1/sub2"), false)

		assert.strictEqual(await new fileSystem.FileSystem().cleanDir("dir1/sub3"), 0)
		assert.strictEqual(await new fileSystem.FileSystem().cleanDir("dir1/non-exists"), 0)
	}

	export async function deleteParentDirIfEmptyTest() {
		assert.strictEqual(await new fileSystem.FileSystem().deleteParentDirIfEmpty("dir1/sub3/foo.txt"), false)
		assert.strictEqual(fs.existsSync("dir1/sub3"), false)

		assert.strictEqual(await new fileSystem.FileSystem().deleteParentDirIfEmpty("dir1/sub1/foo.txt"), false)
		assert.strictEqual(fs.existsSync("dir1/sub1"), true)

		assert.strictEqual(await new fileSystem.FileSystem().deleteParentDirIfEmpty("dir2/foo.txt"), true)
		assert.strictEqual(fs.existsSync("dir2"), false)

		fs.mkdirSync("empty1")
		fs.mkdirSync("empty1/empty2")
		assert.strictEqual(await new fileSystem.FileSystem().deleteParentDirIfEmpty("empty1/empty2/foo.txt"), true)
		assert.strictEqual(fs.existsSync("empty1"), false)
	}

	export async function deleteFileTest() {
		assert.strictEqual(await new fileSystem.FileSystem().deleteFile("f1.txt"), true)
		assert.strictEqual(fs.existsSync("f1.txt"), false)

		assert.strictEqual(await new fileSystem.FileSystem().deleteFile("non-exists.txt"), false)
	}

	export async function walkTest() {
		const dirs: string[] = []
		const files: string[] = []
		await new fileSystem.FileSystem().walk(".", {
			other() {

			},
			error(e) {
				assert.ifError(e)
			},
			dir(p) {
				dirs.push(path.relative(root, p).split(path.sep).join("/"))
			},
			file(p) {
				files.push(path.relative(root, p).split(path.sep).join("/"))
			}
		})
		assert.deepStrictEqual(dirs.sort(), ["", "dir1", "dir1/sub1", "dir1/sub2", "dir2"])
		assert.deepStrictEqual(files.sort(), ["dir1/sub1/f3.txt", "dir1/sub1/f4.txt", "dir1/sub2/f5.txt", "f1.txt", "f2.txt"])

		await new fileSystem.FileSystem().walk("non-exists", {})
	}

	export async function globTest() {
		assert.deepStrictEqual((await new fileSystem.FileSystem().glob("*")).sort().map(p => path.relative(root, p).split(path.sep).join("/")), ["dir1/sub1/f3.txt", "dir1/sub1/f4.txt", "dir1/sub2/f5.txt", "f1.txt", "f2.txt"])
		assert.deepStrictEqual((await new fileSystem.FileSystem().glob("dir1")).sort().map(p => path.relative(root, p).split(path.sep).join("/")), ["dir1/sub1/f3.txt", "dir1/sub1/f4.txt", "dir1/sub2/f5.txt"])
	}

	export async function readDirTest() {
		assert.deepStrictEqual(await new fileSystem.FileSystem().readDir("."), ["dir1", "dir2", "f1.txt", "f2.txt"])
	}

	export async function readFileTest() {
		assert.strictEqual(await new fileSystem.FileSystem().readFile("f1.txt", "utf-8"), "f1.txt")
		assert.strictEqual(await new fileSystem.FileSystem().readFile("dir1/sub1/f4.txt", "utf-8"), "f4.txt")
		assert.strictEqual(await new fileSystem.FileSystem().readFile("non-exists", "utf-8", false), null)
	}

	export async function writeFileTest() {
		assert.strictEqual(await new fileSystem.FileSystem().writeFile("foo/goo.txt", "A"), true)
		assert.strictEqual(fs.readFileSync("foo/goo.txt", "utf-8"), "A")
		assert.strictEqual(await new fileSystem.FileSystem().writeFile("foo/goo.txt", "你好"), true)
		assert.strictEqual(fs.readFileSync("foo/goo.txt", "utf-8"), "你好")
		assert.strictEqual(await new fileSystem.FileSystem().writeFile("foo/goo.txt", "你不好", false), false)
		assert.strictEqual(fs.readFileSync("foo/goo.txt", "utf-8"), "你好")
	}

	export async function appendFileTest() {
		await new fileSystem.FileSystem().appendFile("foo/goo.txt", "A")
		assert.strictEqual(fs.readFileSync("foo/goo.txt", "utf-8"), "A")
		await new fileSystem.FileSystem().appendFile("foo/goo.txt", "你好")
		assert.strictEqual(fs.readFileSync("foo/goo.txt", "utf-8"), "A你好")
	}

	export async function copyDirTest() {
		assert.strictEqual(await new fileSystem.FileSystem().copyDir("dir1", "foo/copydir"), 3)
		assert.strictEqual(fs.readFileSync("foo/copydir/sub1/f3.txt", "utf-8"), "f3.txt")
		assert.strictEqual(fs.readFileSync("foo/copydir/sub1/f4.txt", "utf-8"), "f4.txt")
		assert.strictEqual(fs.readFileSync("foo/copydir/sub2/f5.txt", "utf-8"), "f5.txt")

		fs.writeFileSync("foo/copydir/sub2/f5.txt", "f5.txt_1")
		assert.strictEqual(await new fileSystem.FileSystem().copyDir("dir1", "foo/copydir", false), 0)
		assert.strictEqual(fs.readFileSync("foo/copydir/sub1/f3.txt", "utf-8"), "f3.txt")
		assert.strictEqual(fs.readFileSync("foo/copydir/sub1/f4.txt", "utf-8"), "f4.txt")
		assert.strictEqual(fs.readFileSync("foo/copydir/sub2/f5.txt", "utf-8"), "f5.txt_1")
	}

	export async function copyFileTest() {
		assert.strictEqual(await new fileSystem.FileSystem().copyFile("f1.txt", "foo/copyf1.txt"), true)
		assert.strictEqual(fs.readFileSync("foo/copyf1.txt", "utf-8"), "f1.txt")

		fs.writeFileSync("foo/copyf1.txt", "f1.txt_1")
		assert.strictEqual(await new fileSystem.FileSystem().copyFile("f1.txt", "foo/copyf1.txt", false), false)
		assert.strictEqual(fs.readFileSync("foo/copyf1.txt", "utf-8"), "f1.txt_1")
	}

	export async function moveDirTest() {
		assert.strictEqual(await new fileSystem.FileSystem().moveDir("dir1", "foo/movedir"), 3)
		assert.strictEqual(fs.existsSync("dir1"), false)
		assert.strictEqual(fs.readFileSync("foo/movedir/sub1/f3.txt", "utf-8"), "f3.txt")
		assert.strictEqual(fs.readFileSync("foo/movedir/sub1/f4.txt", "utf-8"), "f4.txt")
		assert.strictEqual(fs.readFileSync("foo/movedir/sub2/f5.txt", "utf-8"), "f5.txt")

		fs.writeFileSync("foo/movedir/sub2/f5.txt", "f5.txt_1")
		assert.strictEqual(await new fileSystem.FileSystem().moveDir("foo/movedir", "foo/movedir", false), 0)
		assert.strictEqual(fs.readFileSync("foo/movedir/sub1/f3.txt", "utf-8"), "f3.txt")
		assert.strictEqual(fs.readFileSync("foo/movedir/sub1/f4.txt", "utf-8"), "f4.txt")
		assert.strictEqual(fs.readFileSync("foo/movedir/sub2/f5.txt", "utf-8"), "f5.txt_1")
	}

	export async function moveFileTest() {
		assert.strictEqual(await new fileSystem.FileSystem().moveFile("f1.txt", "foo/movef1.txt"), true)
		assert.strictEqual(fs.existsSync("f1.txt"), false)
		assert.strictEqual(fs.readFileSync("foo/movef1.txt", "utf-8"), "f1.txt")

		assert.strictEqual(await new fileSystem.FileSystem().moveFile("foo/movef1.txt", "foo/movef1.txt", false), false)
		assert.strictEqual(fs.readFileSync("foo/movef1.txt", "utf-8"), "f1.txt")
	}

	export async function getRealPathTest() {
		assert.strictEqual(await new fileSystem.FileSystem().getRealPath("f1.txt"), path.resolve("f1.txt"))
		assert.strictEqual(await new fileSystem.FileSystem().getRealPath("F1.txt"), path.resolve("f1.txt"))
		assert.strictEqual(await new fileSystem.FileSystem().getRealPath("non-exists.txt"), null)
	}

	export async function shouldOmitEMFiles() {
		await simulateIOError(async () => {
			const promises = []
			promises.push(new fileSystem.FileSystem().readFile("f1.txt", "utf-8"))
			promises.push(new fileSystem.FileSystem().readFile("f1.txt", "utf-8"))
			promises.push(new fileSystem.FileSystem().readFile("f1.txt", "utf-8"))
			promises.push(new fileSystem.FileSystem().readFile("f1.txt", "utf-8"))
			promises.push(new fileSystem.FileSystem().readFile("f1.txt", "utf-8"))
			assert.deepStrictEqual(await Promise.all(promises), ["f1.txt", "f1.txt", "f1.txt", "f1.txt", "f1.txt"])
		}, "readFile", ["EMFILE", "ENFILE", "EAGAIN"])
	}

}