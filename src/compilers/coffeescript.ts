import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "./common"

/** 表示一个 CoffeeScript 插件 */
export default class Coffee extends Compiler implements Processor {
	get outExt() { return ".js" }
	get vendorName() { return "coffee-script" }
	async compile(module: Module, options: any, cs: any, builder: Builder) {
		try {
			const result = cs.compile(module.content, options)
			module.content = result.js || result;
			if (result.v3SourceMap) {
				module.applySourceMap(result.v3SourceMap)
			}
		} catch (e) {
			return module.addError({
				source: Coffee.name,
				error: e,
				line: e.location && e.location.first_line,
				column: e.location && e.location.first_column,
				endLine: e.location && e.location.last_line,
				endColumn: e.location && e.location.last_column + 1
			})
		}
	}
}