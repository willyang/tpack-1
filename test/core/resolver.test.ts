import * as assert from "assert"
import { resolve, join } from "path"
import * as resolver from "../../src/core/resolver"
import { init, uninit, root } from "../helpers/fsHelper"

export namespace resolverTest {

	export async function beforeEach() {
		await init({
			"dir": {
				"entry": "entry",
				"web_components": {
					"x": "x",
					"x.js": "x.js",
				},
				"xyz1": "xyz1",
				"xyz2": "xyz2",
				"xyz3": "xyz3",
				"package.json": JSON.stringify({
					browser: {
						"abc5": false,
						"abc6": "./xyz3",
					}
				}),
			},
			"web_components": {
				"y": "y",
				"module1": {
					"index.js": "index.js"
				},
				"module2": {
					"package.json": JSON.stringify({
						main: "./entry.js"
					}),
					"entry.js": "entry.js"
				}
			},
			"error": {
				"dir1": {
					"package.json": ""
				},
				"dir2": {
					"package.json": "null"
				},
				"dir3": {},
				"dir4": {
					"package.json": JSON.stringify({
						main: null
					})
				},
				"dir5": {
					"package.json": JSON.stringify({
						main: {}
					})
				},
				"dir6": {
					"package.json": {}
				}
			}
		})
	}

	export async function afterEach() {
		await uninit()
	}

	export async function resolveTest() {
		await resolveTest(true)
		await resolveTest(false)
		await resolveTest(true, { trace: [] })
		await resolveTest(false, { trace: [] })

		async function resolveTest(cache: boolean, context?: resolver.ResolveContext) {
			const r = new resolver.Resolver({
				modules: ["web_components"],
				alias: {
					"abc1": "./xyz1",
					"abc2$": "./xyz2",
					"abc3*": "./xyz3",
					"abc4*": false,
				},
				cache: cache
			})
			assert.strictEqual(await r.resolve("./entry", resolve("dir"), context), join(root, "dir/entry"))
			assert.strictEqual(await r.resolve("x", resolve("dir"), context), join(root, "dir/web_components/x"))
			assert.strictEqual(await r.resolve("y", resolve("dir"), context), join(root, "web_components/y"))
			assert.strictEqual(await r.resolve("module1", resolve("dir"), context), join(root, "web_components/module1/index.js"))
			assert.strictEqual(await r.resolve("module2", resolve("dir"), context), join(root, "web_components/module2/entry.js"))

			assert.strictEqual(await r.resolve("abc1", resolve("dir"), context), join(root, "dir/xyz1"))
			assert.strictEqual(await r.resolve("abc2", resolve("dir"), context), join(root, "dir/xyz2"))
			assert.strictEqual(await r.resolve("abc3", resolve("dir"), context), join(root, "dir/xyz3"))
			assert.strictEqual(await r.resolve("abc4", resolve("dir"), context), false)
			assert.strictEqual(await r.resolve("abc5", resolve("dir"), context), false)
			assert.strictEqual(await r.resolve("abc6", resolve("dir"), context), join(root, "dir/xyz3"))
			assert.strictEqual(await r.resolve("abc6", resolve("dir"), context), join(root, "dir/xyz3"))

			assert.strictEqual(await r.resolve("./dir1", resolve("error"), context), null)
			assert.strictEqual(await r.resolve("./dir2", resolve("error"), context), null)
			assert.strictEqual(await r.resolve("./dir3", resolve("error"), context), null)
			assert.strictEqual(await r.resolve("./dir3", resolve("error"), context), null)
			assert.strictEqual(await r.resolve("./dir4", resolve("error"), context), null)
			assert.strictEqual(await r.resolve("./dir5", resolve("error"), context), null)
			assert.strictEqual(await r.resolve("./dir6", resolve("error"), context), null)

			assert.strictEqual(await r.resolve(".", resolve("web_components/module2"), context), join(root, "web_components/module2/entry.js"))
			assert.strictEqual(await r.resolve(join(root, "web_components/module2/entry.js"), resolve("web_components/module2"), context), join(root, "web_components/module2/entry.js"))
		}
	}

	export async function caseSensitiveTest() {
		const r = new resolver.Resolver({
			enforceCaseSensitive: true
		})

		assert.strictEqual(await r.resolve("./entry", resolve("dir")), join(root, "dir/entry"))
		assert.strictEqual(await r.resolve("./Entry", resolve("dir"), { trace: [] }), null)
	}
}