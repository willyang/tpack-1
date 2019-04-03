import * as assert from "assert"
import * as np from "path"
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
			}
		})
	}

	export function afterEach() {
		uninit()
	}

	export async function resolveTest() {
		const r = new resolver.Resolver({
			modules: ["web_components"],
			alias: {
				"abc1": "./xyz1",
				"abc2$": "./xyz2",
				"abc3*": "./xyz3",
				"abc4*": false,
			}
		})
		const traces = []
		traces["verbose"] = true
		assert.strictEqual(await r.resolve("./entry", np.resolve("dir"), traces), np.join(root, "dir/entry"))
		assert.strictEqual(await r.resolve("x", np.resolve("dir"), traces), np.join(root, "dir/web_components/x"))
		assert.strictEqual(await r.resolve("y", np.resolve("dir"), traces), np.join(root, "web_components/y"))
		assert.strictEqual(await r.resolve("module1", np.resolve("dir"), traces), np.join(root, "web_components/module1/index.js"))
		assert.strictEqual(await r.resolve("module2", np.resolve("dir"), traces), np.join(root, "web_components/module2/entry.js"))

		assert.strictEqual(await r.resolve("abc1", np.resolve("dir"), traces), np.join(root, "dir/xyz1"))
		assert.strictEqual(await r.resolve("abc2", np.resolve("dir"), traces), np.join(root, "dir/xyz2"))
		assert.strictEqual(await r.resolve("abc3", np.resolve("dir"), traces), np.join(root, "dir/xyz3"))
		assert.strictEqual(await r.resolve("abc4", np.resolve("dir"), traces), false)
		assert.strictEqual(await r.resolve("abc5", np.resolve("dir"), traces), false)
		assert.strictEqual(await r.resolve("abc6", np.resolve("dir"), traces), np.join(root, "dir/xyz3"))

		assert.strictEqual(await r.resolve(".", np.resolve("web_components/module2"), traces), np.join(root, "web_components/module2/entry.js"))
		assert.strictEqual(await r.resolve(np.join(root, "web_components/module2/entry.js"), np.resolve("web_components/module2"), traces), np.join(root, "web_components/module2/entry.js"))
	}

}