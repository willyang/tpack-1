import { dirname } from "path"
import { Processor, Builder } from "../core/builder"
import { Module } from "../core/module"
import { Compiler } from "./common"

export default class Stylus extends Compiler implements Processor {
	get outExt() { return ".css" }
	get vendorName() { return "stylus" }
	compile(module: Module, options: any, stylus: any, builder: Builder) {
		return new Promise<void>(resolve => {
			const style = stylus(module.content, {
				filename: module.originalPath,
				paths: [builder.rootDir],
				sourcemap: module.generatesSourceMap ? {
					comment: false,
					basePath: dirname(module.originalPath)
				} : false,
				...options
			})
			style.define("url", stylus.resolver({
				nocheck: true,
			}))
			style.render((error: any, text: string) => {
				if (error) {
					if (error.name === "ParseError") {
						const match = /^(.*):(\d):(\d+)\n/.exec(error.message)
						if (match) {
							module.addError({
								source: Stylus.name,
								error: error,
								message: (/\n\n(.*)\n/.exec(error.message) || [0, error.message])[1],
								fileName: match[1],
								line: +match[2] - 1,
								column: +match[3] - 1
							})
						} else {
							module.addError({
								source: Stylus.name,
								error: error,
								message: error.message
							})
						}
					} else {
						module.addError({
							source: Stylus.name,
							error: error,
							message: (/\n\n(?:(?:Type)?Error\: )?(.*)\n/.exec(error.message) || [0, error.message])[1],
							fileName: builder.resolvePath(error.filename),
							line: error.lineno - 1,
							column: error.column - 1,
							content: error.input,
							detail: error.stylusStack
						})
					}
				} else {
					module.content = text
					const map = style.sourcemap
					if (map) {
						module.applySourceMap(map)
					}
					for (const ref of style.deps()) {
						module.addReference(ref, {
							source: Stylus.name,
							type: "@import"
						})
					}
				}
				resolve()
			})
		})
	}
}