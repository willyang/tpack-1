import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "./common"

/** 表示一个 LessCSS 插件 */
export default class Less extends Compiler implements Processor {
	get outExt() { return ".css" }
	get vendorName() { return "less" }
	init(less: any, options: any, builder: Builder) {
		less.logger.addListener({
			debug: (msg: string) => { builder.logger.debug(msg) },
			info: (msg: string) => { builder.logger.debug(msg) },
			warn: (msg: string) => { builder.logger.warning(msg) },
			error: (msg: string) => { builder.logger.error(msg) }
		})
	}
	async compile(module: Module, options: any, less: any, builder: Builder) {
		try {
			const result = await less.render(module.content, {
				filename: module.originalPath,
				sourceMap: builder.sourceMap ? {} : undefined,
				...options
			})
			module.content = result.css
			if (result.map) {
				module.applySourceMap(result.map)
			}
			for (const ref of result.imports) {
				module.addReference(ref, {
					source: Less.name,
					type: "@import"
				})
			}
		} catch (e) {
			module.addError({
				source: Less.name,
				error: e,
				message: e.message,
				fileName: e.filename,
				line: e.line - 1,
				column: e.column
			})
		}
	}
}