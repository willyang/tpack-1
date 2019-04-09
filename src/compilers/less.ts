import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"

export default class Less implements Processor {

	private _less?: typeof less

	constructor(readonly options: Less.Options) { }

	async process(module: Module, builder: Builder) {

		// 更新文件名
		module.ext = ".css"
		if (!module.content) {
			return
		}

		// 载入 less 插件
		let less = this._less!
		if (!less) {
			less = await builder.require("less")
			// @ts-ignore
			less.logger.addListener({
				debug: (msg: string) => { builder.logger.verbose(msg) },
				info: (msg: string) => { builder.logger.verbose(msg) },
				warn: (msg: string) => { builder.logger.warning(msg) },
				error: (msg: string) => { builder.logger.error(msg) }
			})
		}

		// 编译
		try {
			const result = await less.render(module.content, {
				filename: module.originalPath,
				sourceMap: builder.sourceMap ? {} : undefined,
				...this.options
			})
			module.content = result.css
			if (result.map) {
				module.applySourceMap(result.map)
			}
			for (const dep of result.imports) {
				module.addDependency(dep, {
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