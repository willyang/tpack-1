import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "./common"

export default class Sass extends Compiler implements Processor {
	get outExt() { return ".css" }
	get vendorName() { return "node-sass" }
	compile(module: Module, options: any, sass: any, builder: Builder) {
		return new Promise<void>(resolve => {
			sass.render({
				file: module.originalPath,
				data: module.content,
				indentedSyntax: /^\.sass$/i.test(module.originalPath),
				sourceMap: module.generatesSourceMap,
				omitSourceMapUrl: true,
				outFile: module.originalPath,
				outputStyle: "expanded",
				includePaths: [builder.rootDir],
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
						for (let i = 0; i < map.sources.length; i++) {
							map.sources[i] = module.resolvePath(map.sources[i])
						}
						module.applySourceMap(map)
					}
					for (const ref of result.stats.includedFiles) {
						module.addReference(ref, {
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