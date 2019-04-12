import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "./common"

/** 表示一个 Sass 插件 */
export default class Sass extends Compiler implements Processor {
	get outExt() { return ".css" }
	get vendorName() { return "node-sass" }
	async compile(module: Module, options: any, sass: any, builder: Builder) {
		return await new Promise<void>(resolve => {
			sass.render({
				file: module.originalPath,
				data: module.content,
				indentedSyntax: /^\.sass$/i.test(module.originalPath),
				sourceMap: builder.sourceMap,
				omitSourceMapUrl: true,
				outFile: module.originalPath,
				outputStyle: "expanded",
				...options
			}, (error: any, result: any) => {
				if (error) {
					module.addError({
						source: Sass.name,
						error: error,
						message: error.message,
						fileName: error.file,
						line: error.line - 1,
						column: error.column - 1
					})
				} else {
					module.buffer = result.css
					if (result.map) {
						const map = JSON.parse(result.map.toString())
						for (var i = 0; i < map.sources.length; i++) {
							map.sources[i] = module.resolve(map.sources[i])
						}
						module.applySourceMap(map)
					}
					for (const dep of result.stats.includedFiles) {
						module.addDependency(dep, {
							source: Sass.name,
							type: "@import"
						})
					}
				}
				resolve()
			})
		})
	}
}