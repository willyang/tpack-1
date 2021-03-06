import * as assert from "assert"
import * as fs from "fs"
import { resolve as resolvePath } from "path"
import * as watcher from "../../src/utils/watcher"
import { init, root, uninit } from "../helpers/fsHelper"

export namespace watcherTest {

	export async function beforeEach() {
		await init({})
	}

	export async function afterEach() {
		await uninit()
	}

	export async function watchDirAndCreateFile() {
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.delay = 10
			w.on("create", path => {
				assert.strictEqual(path, resolvePath("foo/你好.txt"))
				assert.strictEqual(fs.readFileSync("foo/你好.txt", "utf-8"), "A")
				w.close(resolve)
			})
			w.add(root, () => {
				fs.mkdirSync("foo/")
				fs.writeFileSync("foo/你好.txt", "A")
			})
		})
	}

	export async function watchDirAndChangeFile() {
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.delay = 10
			w.on("create", path => {
				assert.strictEqual(path, resolvePath("foo/你好.txt"))
				assert.strictEqual(fs.readFileSync("foo/你好.txt", "utf-8"), "A")
				fs.writeFileSync("foo/你好.txt", "B")
			})
			w.on("change", path => {
				assert.strictEqual(path, resolvePath("foo/你好.txt"))
				assert.strictEqual(fs.readFileSync("foo/你好.txt", "utf-8"), "B")
				w.close(resolve)
			})
			w.add(root, () => {
				fs.mkdirSync("foo/")
				fs.writeFileSync("foo/你好.txt", "A")
			})
		})
	}

	export async function watchDirAndDeleteFile() {
		await new Promise(resolve => {
			fs.mkdirSync("foo/")
			fs.writeFileSync("foo/你好.txt", "A")
			const w = new watcher.Watcher()
			w.delay = 10
			w.on("delete", path => {
				assert.strictEqual(path, resolvePath("foo/你好.txt"))
				assert.strictEqual(fs.existsSync("foo/你好.txt"), false)
				w.close(resolve)
			})
			w.on("create", path => { assert.fail(path) })
			w.on("change", path => { assert.fail(path) })
			w.add(root, () => {
				fs.unlinkSync("foo/你好.txt")
			})
		})
	}

	export async function watchDirAndChangeDir() {
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.delay = 10
			w.on("delete", path => { assert.fail(path) })
			w.on("create", path => { assert.fail(path) })
			w.on("change", path => { assert.fail(path) })
			w.add(root, () => {
				fs.mkdirSync("foo/")
				fs.mkdirSync("foo/goo")
				w.close(resolve)
			})
		})
	}

	export async function watchDirAndDeleteDir() {
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.delay = 10
			w.on("createDir", path => {
				assert.strictEqual(path, resolvePath("foo"))
				fs.rmdirSync("foo")
			})
			w.on("deleteDir", path => {
				assert.strictEqual(path, resolvePath("foo"))
				w.close(resolve)
			})
			w.add(root, () => {
				fs.mkdirSync("foo")
			})
		})
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.delay = 10
			w.on("createDir", path => { assert.fail(path) })
			w.on("deleteDir", path => { assert.fail(path) })
			w.add(root, () => {
				fs.mkdirSync("foo")
				fs.rmdirSync("foo")
				setTimeout(() => {
					w.close(resolve)
				}, 12)
			})
		})
	}

	export async function watchFileAndChangeFile() {
		// MAC 有时需要 7s
		this.timeout(10000)
		await new Promise(resolve => {
			let step = 0
			fs.mkdirSync("foo/")
			fs.writeFileSync("foo/你好.txt", "O")
			const w = new watcher.Watcher()
			w.delay = 10
			w.usePolling = false
			w.on("delete", path => { assert.fail(path) })
			w.on("create", path => { assert.fail(path) })
			w.on("change", (path: string) => {
				switch (step++) {
					case 0:
						assert.strictEqual(path, resolvePath("foo/你好.txt"))
						assert.strictEqual(fs.readFileSync("foo/你好.txt", "utf-8"), "A")
						fs.writeFileSync("foo/你好.txt", "B")
						break
					case 1:
						assert.strictEqual(path, resolvePath("foo/你好.txt"))
						assert.strictEqual(fs.readFileSync("foo/你好.txt", "utf-8"), "B")
						w.close(resolve)
						break
				}
			})
			w.add("foo/你好.txt", () => {
				fs.writeFileSync("foo/你好.txt", "A")
			})
		})
	}

	export async function watchFileAndDeleteFile() {
		await new Promise(resolve => {
			fs.mkdirSync("foo/")
			fs.writeFileSync("foo/你好.txt", "A")
			const w = new watcher.Watcher()
			w.delay = 10
			w.usePolling = false
			w.on("delete", path => {
				assert.strictEqual(path, resolvePath("foo/你好.txt"))
				assert.strictEqual(fs.existsSync("foo/你好.txt"), false)

				w.close(resolve)
			})
			w.on("create", path => { assert.fail(path) })
			w.add("foo/你好.txt", () => {
				if (process.platform === "darwin") {
					setTimeout(() => {
						fs.unlinkSync("foo/你好.txt")
					}, 1000)
				} else {
					fs.unlinkSync("foo/你好.txt")
				}
			})
		})
	}

	export async function addTest() {
		await new Promise(resolve => {
			fs.mkdirSync("foo/")
			fs.mkdirSync("foo/sub1")
			const w = new watcher.Watcher()
			w.add("foo", error => {
				assert.ifError(error)
				assert.strictEqual(w.isWatching, true)
				w.add("foo/sub1", () => {
					w.add(root, () => {
						w.close(resolve)
					})
				})
			})
		})
	}

	export async function removeTest() {
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.add(root, () => {
				assert.strictEqual(w.isWatching, true)
				w.remove(root)
				assert.strictEqual(w.isWatching, false)
				w.close(resolve)
			})
		})
	}

	export async function ignoredTest() {
		await new Promise(resolve => {
			const w = new watcher.Watcher()
			w.delay = 10
			w.ignored = () => true
			w.on("create", path => { assert.fail(path) })
			w.add(root, () => {
				fs.mkdirSync("foo/")
				fs.writeFileSync("foo/你好.txt", "A")
				setTimeout(() => {
					w.close(resolve)
				}, 12)
			})
		})
	}

	export namespace recursiveTest {
		if (process.platform !== "darwin" && new watcher.Watcher().watchOptions.recursive) {
			for (const key in watcherTest) {
				if (key.endsWith("Test") && key !== "recursiveTest") {
					recursiveTest[key] = function () {
						const oldAdd = watcher.Watcher.prototype.add
						const oldClose = watcher.Watcher.prototype.close
						watcher.Watcher.prototype.add = function () {
							this.watchOptions.recursive = false
							return oldAdd.apply(this, arguments)
						}
						watcher.Watcher.prototype.close = function () {
							watcher.Watcher.prototype.add = oldAdd
							watcher.Watcher.prototype.close = oldClose
							return oldClose.apply(this, arguments)
						}
						return watcherTest[key].call(this, arguments)
					}
				}
			}
		}

	}

}