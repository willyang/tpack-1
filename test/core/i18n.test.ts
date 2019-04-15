import * as assert from "assert"
import * as i18n from "../../src/core/i18n"

export namespace i18nTest {

	export function translateTest() {
		const service = new i18n.LocaleService("en-US")
		service.dict.set("hello", "你好")
		assert.strictEqual(service.translate("x"), "x")
		assert.strictEqual(service.translate("hello"), "你好")
	}

	export function i18nTest() {
		const service = new i18n.LocaleService("en-US")
		service.dict.set("hello", "你好")
		service.dict.set("hello{0}world", "你好{0}世界")
		service.dict.set("hello{0}world{1}", "你好{0}世界{1}")
		assert.strictEqual(service.i18n`hello`, "你好")
		assert.strictEqual(service.i18n`hello${","}world`, "你好,世界")
		assert.strictEqual(service.i18n`hello${","}world${"!"}`, "你好,世界!")
		assert.strictEqual(service.i18n`hello2`, "hello2")
		assert.strictEqual(service.i18n`hello2${","}world`, "hello2,world")
		assert.strictEqual(service.i18n`hello2${","}world${"!"}`, "hello2,world!")
	}

}