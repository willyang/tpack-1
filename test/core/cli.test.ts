import * as assert from "assert"
import { init, uninit } from "../helpers/fsHelper"
import * as cli from "../../src/core/cli"

export namespace cliTest {

	export async function loadConfigFileTest() {
		await init({
			"myconfig.js": `export const foo = 1`
		})
		try {
			assert.strictEqual(cli.loadConfigFile("myconfig.js").foo, 1)
		} finally {
			await uninit()
		}

		await init({
			"myconfig2.js": `import util from "util";export function foo(name){ return util.isString(name) }`
		})
		try {
			assert.strictEqual(cli.loadConfigFile("myconfig2.js").foo("foo"), true)
		} finally {
			await uninit()
		}
	}

}